import { request, Agent } from 'undici';
import type * as vscode from 'vscode';
import { ApiRequest, SseEvent, SseStatus, KeyValuePair } from '../types';
import { VariableResolver } from './VariableResolver';
import { HistoryService } from './HistoryService';

interface SseConnection {
  connectionId: string;
  tabId: string;
  request: ApiRequest;
  connectedAt?: number;
  receivedCount: number;
  abortController: AbortController;
}

export class SseClient {
  /** connectionId -> connection info */
  private connections = new Map<string, SseConnection>();
  /** tabId -> connectionId */
  private tabConnections = new Map<string, string>();
  private variableResolver = new VariableResolver();

  constructor(
    private webview: vscode.Webview,
    private historyService?: HistoryService,
    private maxHistory = 1000,
  ) {}

  connect(tabId: string, request: ApiRequest, envVariables: KeyValuePair[]): void {
    // Close any existing connection for this tab first
    const existingConnectionId = this.tabConnections.get(tabId);
    if (existingConnectionId) {
      this.disconnect(existingConnectionId);
    }

    const connectionId = crypto.randomUUID();
    const abortController = new AbortController();

    const conn: SseConnection = {
      connectionId,
      tabId,
      request,
      receivedCount: 0,
      abortController,
    };

    this.connections.set(connectionId, conn);
    this.tabConnections.set(tabId, connectionId);
    this.postStatus(tabId, 'connecting', connectionId);

    // Start the SSE stream asynchronously
    this.openSseStream(conn, request, envVariables).catch((err) => {
      // Only report error if connection still exists (not manually disconnected)
      if (this.connections.has(connectionId)) {
        this.connections.delete(connectionId);
        this.tabConnections.delete(tabId);
        const msg = err?.name === 'AbortError' ? undefined : String(err?.message ?? err);
        if (msg) {
          this.postStatus(tabId, 'error', undefined, msg);
        } else {
          this.postStatus(tabId, 'disconnected');
        }
      }
    });
  }

  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.abortController.abort();
    this.saveSessionHistory(conn);
    this.connections.delete(connectionId);
    this.tabConnections.delete(conn.tabId);
    this.postStatus(conn.tabId, 'disconnected');
  }

  disposeAll(): void {
    for (const connectionId of [...this.connections.keys()]) {
      this.disconnect(connectionId);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async openSseStream(
    conn: SseConnection,
    apiRequest: ApiRequest,
    envVariables: KeyValuePair[],
  ): Promise<void> {
    const resolvedRequest = envVariables?.length
      ? this.variableResolver.resolveObject(apiRequest, envVariables)
      : apiRequest;

    const url = this.buildUrl(resolvedRequest);
    const headers = this.buildHeaders(resolvedRequest);

    // Ensure the Accept header is set for SSE
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'accept')) {
      headers['Accept'] = 'text/event-stream';
    }
    // Do not allow keepAlive to interfere
    headers['Cache-Control'] = headers['Cache-Control'] ?? 'no-cache';

    const sslVerify = resolvedRequest.sslVerify ?? true;
    const dispatcher = sslVerify ? undefined : new Agent({ connect: { rejectUnauthorized: false } });

    const response = await request(url, {
      method: 'GET',
      headers,
      signal: conn.abortController.signal,
      // No body timeout — SSE is a long-lived connection
      headersTimeout: 30000,
      bodyTimeout: 0,
      ...(dispatcher ? { dispatcher } : {}),
    });

    // Check that the response is actually SSE
    const contentType = (response.headers['content-type'] ?? '') as string;
    if (!contentType.includes('text/event-stream')) {
      // Still show the event with header info so the user can debug
      conn.connectedAt = Date.now();
      this.postStatus(conn.tabId, 'connected', conn.connectionId);
    } else {
      conn.connectedAt = Date.now();
      this.postStatus(conn.tabId, 'connected', conn.connectionId);
    }

    // Read chunked body line by line
    let buffer = '';

    for await (const chunk of response.body) {
      // Abort check
      if (!this.connections.has(conn.connectionId)) break;

      buffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);

      // SSE events are delimited by double newlines (\n\n or \r\n\r\n)
      // Process all complete events in the buffer
      while (true) {
        const doubleNewline = buffer.indexOf('\n\n');
        const doubleRN = buffer.indexOf('\r\n\r\n');
        let eventEnd = -1;
        let skipLen = 2;

        if (doubleNewline !== -1 && (doubleRN === -1 || doubleNewline <= doubleRN)) {
          eventEnd = doubleNewline;
          skipLen = 2;
        } else if (doubleRN !== -1) {
          eventEnd = doubleRN;
          skipLen = 4;
        } else {
          break;
        }

        const eventBlock = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + skipLen);

        const sseEvent = this.parseEventBlock(eventBlock);
        if (sseEvent && this.connections.has(conn.connectionId)) {
          conn.receivedCount++;
          this.webview.postMessage({
            type: 'sseEventReceived',
            tabId: conn.tabId,
            payload: sseEvent,
          });
        }
      }
    }

    // Stream ended normally
    if (this.connections.has(conn.connectionId)) {
      this.saveSessionHistory(conn);
      this.connections.delete(conn.connectionId);
      this.tabConnections.delete(conn.tabId);
      this.postStatus(conn.tabId, 'disconnected');
    }
  }

  private parseEventBlock(block: string): SseEvent | null {
    const lines = block.split(/\r?\n/);
    let eventId: string | undefined;
    let eventType = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) continue; // comment
      if (line === '') continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) {
        // Field with no value
        if (line === 'data') dataLines.push('');
        continue;
      }

      const field = line.slice(0, colonIdx);
      // Value starts after ': ' (space is optional per spec)
      const value = line.slice(colonIdx + 1).replace(/^ /, '');

      switch (field) {
        case 'id':
          eventId = value;
          break;
        case 'event':
          eventType = value;
          break;
        case 'data':
          dataLines.push(value);
          break;
        case 'retry':
          // Ignore retry field
          break;
      }
    }

    if (dataLines.length === 0) return null;

    const data = dataLines.join('\n');
    return {
      id: crypto.randomUUID(),
      eventId,
      event: eventType,
      data,
      timestamp: Date.now(),
      size: Buffer.byteLength(data, 'utf8'),
    };
  }

  private buildUrl(apiRequest: ApiRequest): string {
    let url = apiRequest.url.trim();
    if (!url.match(/^https?:\/\//i)) {
      url = 'http://' + url;
    }

    const urlObj = new URL(url);
    const enabledParams = apiRequest.params.filter((p) => p.enabled && p.key);
    for (const param of enabledParams) {
      urlObj.searchParams.append(param.key, param.value);
    }

    // API key as query param
    const auth = apiRequest.auth as any;
    if (auth?.type === 'apikey' && auth.in === 'query' && auth.key && auth.value) {
      urlObj.searchParams.append(auth.key, auth.value);
    }

    return urlObj.toString();
  }

  private buildHeaders(apiRequest: ApiRequest): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const h of apiRequest.headers) {
      if (h.enabled && h.key) {
        headers[h.key] = h.value;
      }
    }

    // Auth headers
    const auth = apiRequest.auth as any;
    if (auth?.type === 'bearer' && auth.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth?.type === 'basic' && auth.username) {
      const encoded = Buffer.from(`${auth.username}:${auth.password ?? ''}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    } else if (auth?.type === 'apikey' && auth.in === 'header' && auth.key && auth.value) {
      headers[auth.key] = auth.value;
    }

    return headers;
  }

  private saveSessionHistory(conn: SseConnection): void {
    if (!this.historyService) return;
    if (conn.receivedCount === 0) return;  // nothing received — don't pollute history
    const duration = conn.connectedAt ? Date.now() - conn.connectedAt : 0;
    this.historyService.addSseSession(
      conn.request,
      { eventCount: conn.receivedCount, duration },
      this.maxHistory,
    );
  }

  private postStatus(tabId: string, status: SseStatus, connectionId?: string, error?: string): void {
    this.webview.postMessage({
      type: 'sseStatusChanged',
      tabId,
      payload: { status, connectionId, error },
    });
  }
}
