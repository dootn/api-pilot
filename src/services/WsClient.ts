import * as WebSocket from 'ws';
import type * as vscode from 'vscode';
import { ApiRequest, WsMessage, WsStatus, KeyValuePair } from '../types';
import { VariableResolver } from './VariableResolver';
import { ScriptRunner } from './ScriptRunner';
import { HistoryService } from './HistoryService';

interface WsConnection {
  connectionId: string;
  tabId: string;
  request: ApiRequest;
  connectedAt?: number;
  sentCount: number;
  receivedCount: number;
  ws?: WebSocket.WebSocket;
}

export class WsClient {
  /** connectionId -> connection info */
  private connections = new Map<string, WsConnection>();
  /** tabId -> connectionId (one active connection per tab) */
  private tabConnections = new Map<string, string>();
  private scriptRunner = new ScriptRunner();
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
    const resolvedUrl = this.variableResolver.resolve(request.url, envVariables);

    this.postStatus(tabId, 'connecting', connectionId);

    const connection: WsConnection = { connectionId, tabId, request, sentCount: 0, receivedCount: 0 };
    this.connections.set(connectionId, connection);
    this.tabConnections.set(tabId, connectionId);

    try {
      this.openWebSocket(connection, request, resolvedUrl, envVariables);
    } catch (err) {
      this.connections.delete(connectionId);
      this.tabConnections.delete(tabId);
      this.postStatus(tabId, 'error', undefined, String(err));
    }
  }

  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    // Save to history if at least one message was exchanged
    this.saveSessionHistory(conn);

    if (conn.ws) {
      conn.ws.close();
    }

    this.connections.delete(connectionId);
    this.tabConnections.delete(conn.tabId);
    this.postStatus(conn.tabId, 'disconnected');
  }

  send(connectionId: string, msgType: 'text' | 'binary', data: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const payload = msgType === 'binary' ? Buffer.from(data, 'base64') : data;

    if (conn.ws && conn.ws.readyState === WebSocket.WebSocket.OPEN) {
      conn.ws.send(payload);
    } else {
      return;
    }

    conn.sentCount++;

    // Echo the sent message back to the webview for display in the conversation log
    const sentMsg: WsMessage = {
      id: crypto.randomUUID(),
      direction: 'sent',
      timestamp: Date.now(),
      type: msgType,
      data,
      size: typeof payload === 'string' ? Buffer.byteLength(payload) : payload.length,
    };
    this.postMessage(conn.tabId, sentMsg);
  }

  /** Close all connections (called when webview panel is disposed). */
  disposeAll(): void {
    for (const connectionId of this.connections.keys()) {
      this.disconnect(connectionId);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private openWebSocket(
    conn: WsConnection,
    request: ApiRequest,
    resolvedUrl: string,
    envVariables: KeyValuePair[],
  ): void {
    const headers: Record<string, string> = {};
    for (const h of request.headers) {
      if (h.enabled && h.key) {
        headers[h.key] = this.variableResolver.resolve(h.value, envVariables);
      }
    }

    conn.ws = new WebSocket.WebSocket(resolvedUrl, { headers });

    conn.ws.on('open', () => {
      conn.connectedAt = Date.now();
      this.postStatus(conn.tabId, 'connected', conn.connectionId);
    });

    conn.ws.on('message', (rawData, isBinary) => {
      const buf = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData as ArrayBuffer);
      const data = isBinary ? buf.toString('base64') : buf.toString('utf8');
      const msg: WsMessage = {
        id: crypto.randomUUID(),
        direction: 'received',
        timestamp: Date.now(),
        type: isBinary ? 'binary' : 'text',
        data,
        size: buf.length,
      };
      conn.receivedCount++;
      this.postMessage(conn.tabId, msg, envVariables);
    });

    conn.ws.on('close', () => {
      this.saveSessionHistory(conn);
      this.connections.delete(conn.connectionId);
      this.tabConnections.delete(conn.tabId);
      this.postStatus(conn.tabId, 'disconnected');
    });

    conn.ws.on('error', (err) => {
      this.connections.delete(conn.connectionId);
      this.tabConnections.delete(conn.tabId);
      this.postStatus(conn.tabId, 'error', undefined, err.message);
    });
  }

  private saveSessionHistory(conn: WsConnection): void {
    if (!this.historyService) return;
    const total = conn.sentCount + conn.receivedCount;
    if (total === 0) return;  // nothing exchanged — don't pollute history
    const duration = conn.connectedAt ? Date.now() - conn.connectedAt : 0;
    this.historyService.addWsSession(
      conn.request,
      { messageCount: total, sentCount: conn.sentCount, receivedCount: conn.receivedCount, duration },
      this.maxHistory,
    );
  }

  private postStatus(tabId: string, status: WsStatus, connectionId?: string, error?: string): void {
    this.webview.postMessage({
      type: 'wsStatusChanged',
      tabId,
      payload: { status, connectionId, error },
    });
  }

  private postMessage(tabId: string, message: WsMessage, envVariables?: KeyValuePair[]): void {
    // Run post-script if defined (only for received messages)
    const conn = [...this.connections.values()].find((c) => c.tabId === tabId);
    if (conn?.request.postScript?.trim() && message.direction === 'received' && envVariables) {
      this.scriptRunner.runWsMessageScript(conn.request.postScript, conn.request, message, envVariables);
    }

    this.webview.postMessage({
      type: 'wsMessageReceived',
      tabId,
      payload: message,
    });
  }
}
