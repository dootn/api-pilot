import Redis from 'ioredis';
import type * as vscode from 'vscode';
import {
  ApiRequest, RedisMessage, RedisOptions, RedisSessionSummary, KeyValuePair,
} from '../types';
import { HistoryService } from './HistoryService';
import { BaseConnectionClient, type BaseConnection } from './BaseConnectionClient';

interface RedisConnection extends BaseConnection {
  request: ApiRequest;
  client: Redis;
  sentCount: number;
  receivedCount: number;
}

/** Parse a Redis CLI-style command string into tokens, respecting quoted strings. */
function parseRedisCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else if (ch === '\\' && i + 1 < input.length) {
        current += input[++i];
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

// Structured result payload sent to the webview (kept small with single-char keys).
type RedisResultData =
  | { t: 'nil' }
  | { t: 'ok'; v: string }          // OK, PONG, status strings
  | { t: 'int'; v: number }
  | { t: 'str'; v: string }
  | { t: 'list'; items: Array<string | null>; col?: string }   // indexed list; col = column header
  | { t: 'map'; colKey: string; entries: Array<[string | null, string | null]> }
  | { t: 'zset'; members: Array<[string, string]> }           // member / score pairs
  | { t: 'scan'; cursor: string; keys: string[] }
  | { t: 'info'; sections: Array<{ name: string; fields: Array<[string, string]> }> };

function itemToString(val: unknown): string | null {
  if (val === null) return null;
  if (typeof val === 'string') return val;
  if (Buffer.isBuffer(val)) return val.toString('utf8');
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.map((v) => itemToString(v) ?? '(nil)').join(', ');
  return String(val);
}

const ZSET_ALWAYS_SCORED = new Set(['ZPOPMIN', 'ZPOPMAX']);
const ZSET_OPT_SCORED = new Set([
  'ZRANGE', 'ZRANGEBYSCORE', 'ZREVRANGE', 'ZRANGEBYLEX', 'ZREVRANGEBYSCORE', 'ZRANDMEMBER',
]);

function parseInfoResult(info: string): RedisResultData {
  const sections: Array<{ name: string; fields: Array<[string, string]> }> = [];
  let sectionName = '';
  let fields: Array<[string, string]> = [];

  for (const raw of info.split('\n')) {
    const line = raw.replace(/\r$/, '').trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      if (sectionName && fields.length > 0) sections.push({ name: sectionName, fields });
      sectionName = line.slice(1).trim();
      fields = [];
    } else {
      const colon = line.indexOf(':');
      if (colon > 0) fields.push([line.slice(0, colon), line.slice(colon + 1)]);
    }
  }
  if (sectionName && fields.length > 0) sections.push({ name: sectionName, fields });
  return sections.length > 0 ? { t: 'info', sections } : { t: 'str', v: info };
}

function formatArrayResult(rawItems: unknown[], verb: string, cmdArgs: string[]): RedisResultData {
  if (rawItems.length === 0) return { t: 'list', items: [] };

  // SCAN → [cursor, [keys...]]
  if (verb === 'SCAN' && rawItems.length === 2 && Array.isArray(rawItems[1])) {
    return {
      t: 'scan',
      cursor: itemToString(rawItems[0]) ?? '0',
      keys: (rawItems[1] as unknown[]).map((k) => itemToString(k) ?? ''),
    };
  }

  const flat = rawItems.map(itemToString);

  // HGETALL → field / value pairs
  if (verb === 'HGETALL' && flat.length % 2 === 0) {
    const entries: Array<[string | null, string | null]> = [];
    for (let i = 0; i < flat.length; i += 2) entries.push([flat[i], flat[i + 1]]);
    return { t: 'map', colKey: 'Field', entries };
  }

  // CONFIG GET → config-key / value pairs
  if (verb === 'CONFIG' && cmdArgs[0]?.toUpperCase() === 'GET' && flat.length % 2 === 0) {
    const entries: Array<[string | null, string | null]> = [];
    for (let i = 0; i < flat.length; i += 2) entries.push([flat[i], flat[i + 1]]);
    return { t: 'map', colKey: 'Config Key', entries };
  }

  // ZPOPMIN / ZPOPMAX always return member / score pairs
  if (ZSET_ALWAYS_SCORED.has(verb) && flat.length % 2 === 0) {
    const members: Array<[string, string]> = [];
    for (let i = 0; i < flat.length; i += 2) members.push([flat[i] ?? '', flat[i + 1] ?? '']);
    return { t: 'zset', members };
  }

  // ZRANGE etc. with WITHSCORES
  if (
    ZSET_OPT_SCORED.has(verb) &&
    cmdArgs.some((a) => a.toUpperCase() === 'WITHSCORES') &&
    flat.length % 2 === 0
  ) {
    const members: Array<[string, string]> = [];
    for (let i = 0; i < flat.length; i += 2) members.push([flat[i] ?? '', flat[i + 1] ?? '']);
    return { t: 'zset', members };
  }

  // HKEYS → list labelled as fields
  if (verb === 'HKEYS') return { t: 'list', items: flat, col: 'Field' };

  return { t: 'list', items: flat };
}

/** Serialize a raw Redis reply to a JSON-encoded structured payload. */
function formatRedisResult(result: unknown, verb: string, cmdArgs: string[]): string {
  let data: RedisResultData;
  if (result === null) {
    data = { t: 'nil' };
  } else if (typeof result === 'number') {
    data = { t: 'int', v: result };
  } else if (typeof result === 'string') {
    if (result === 'OK' || result === 'PONG' || result === 'QUEUED') {
      data = { t: 'ok', v: result };
    } else if (verb === 'INFO') {
      data = parseInfoResult(result);
    } else {
      data = { t: 'str', v: result };
    }
  } else if (Buffer.isBuffer(result)) {
    const str = result.toString('utf8');
    data = verb === 'INFO' ? parseInfoResult(str) : { t: 'str', v: str };
  } else if (Array.isArray(result)) {
    data = formatArrayResult(result, verb, cmdArgs);
  } else {
    data = { t: 'str', v: String(result) };
  }
  return JSON.stringify(data);
}

export class RedisClient extends BaseConnectionClient<RedisConnection> {
  constructor(
    webview: vscode.Webview,
    historyService?: HistoryService,
    maxHistory = 1000,
  ) {
    super(webview, historyService, maxHistory);
  }

  connect(tabId: string, request: ApiRequest, envVariables: KeyValuePair[]): void {
    const existingId = this.tabConnections.get(tabId);
    if (existingId) this.disconnect(existingId);

    const connectionId = crypto.randomUUID();
    this.postStatus(tabId, 'connecting', connectionId);

    const resolvedRequest = envVariables?.length
      ? this.variableResolver.resolveObject(request, envVariables)
      : request;

    const opts: RedisOptions = resolvedRequest.redisOptions ?? {};
    const url = resolvedRequest.url.trim();

    // Build ioredis options
    const redisOpts: ConstructorParameters<typeof Redis>[1] = {
      lazyConnect: true,
      connectTimeout: opts.connectTimeout ?? 10000,
      db: opts.db ?? 0,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      // Disable auto-reconnect — the user drives connections
      retryStrategy: () => null,
    };

    if (opts.username) redisOpts.username = opts.username;
    if (opts.password) redisOpts.password = opts.password;
    if (opts.tls) redisOpts.tls = {};

    let client: Redis;
    try {
      client = new Redis(url, redisOpts as any);
    } catch (err: any) {
      this.postStatus(tabId, 'error', connectionId, err.message);
      return;
    }

    const conn: RedisConnection = {
      connectionId,
      tabId,
      request: resolvedRequest,
      client,
      sentCount: 0,
      receivedCount: 0,
    };

    this.connections.set(connectionId, conn);
    this.tabConnections.set(tabId, connectionId);

    client.on('ready', () => {
      conn.connectedAt = Date.now();
      this.postStatus(tabId, 'connected', connectionId);
    });

    client.on('error', (err: Error) => {
      this.postStatus(tabId, 'error', connectionId, err.message);
    });

    client.on('close', () => {
      if (this.connections.has(connectionId)) {
        this.connections.delete(connectionId);
        this.tabConnections.delete(tabId);
        this.postStatus(tabId, 'disconnected', connectionId);
      }
    });

    client.connect().catch((err: Error) => {
      this.postStatus(tabId, 'error', connectionId, err.message);
    });
  }

  async sendCommand(connectionId: string, command: string): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    // Post the sent message immediately
    conn.sentCount++;
    const sentId = crypto.randomUUID();
    this.webview.postMessage({
      type: 'redisMessageReceived',
      tabId: conn.tabId,
      payload: {
        id: sentId,
        direction: 'sent',
        command,
        response: command,
        timestamp: Date.now(),
      } satisfies RedisMessage,
    });

    try {
      const parts = parseRedisCommand(command);
      if (parts.length === 0) return;
      const [cmd, ...args] = parts;
      const result = await (conn.client as any).call(cmd.toUpperCase(), ...args);
      conn.receivedCount++;
      this.webview.postMessage({
        type: 'redisMessageReceived',
        tabId: conn.tabId,
        payload: {
          id: crypto.randomUUID(),
          direction: 'received',
          command,
          response: formatRedisResult(result, cmd.toUpperCase(), args),
          timestamp: Date.now(),
        } satisfies RedisMessage,
      });
    } catch (err: any) {
      conn.receivedCount++;
      this.webview.postMessage({
        type: 'redisMessageReceived',
        tabId: conn.tabId,
        payload: {
          id: crypto.randomUUID(),
          direction: 'received',
          command,
          response: `(error) ${err.message}`,
          timestamp: Date.now(),
          isError: true,
        } satisfies RedisMessage,
      });
    }
  }

  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    this.connections.delete(connectionId);
    this.tabConnections.delete(conn.tabId);

    try {
      conn.client.disconnect();
    } catch {
      // ignore
    }

    this.saveSessionHistory(conn);
    this.postStatus(conn.tabId, 'disconnected', connectionId);
  }

  protected saveSessionHistory(conn: RedisConnection): void {
    if (!this.historyService || !conn.connectedAt) return;
    const duration = Date.now() - conn.connectedAt;
    const summary: RedisSessionSummary = {
      sentCount: conn.sentCount,
      receivedCount: conn.receivedCount,
      duration,
    };
    this.historyService.saveEntry({
      id: crypto.randomUUID(),
      request: conn.request,
      redisSession: summary,
      timestamp: conn.connectedAt,
    });
  }

  protected postStatus(
    tabId: string,
    status: string,
    connectionId?: string,
    error?: string,
  ): void {
    this.webview.postMessage({
      type: 'redisStatusChanged',
      tabId,
      payload: { status, connectionId, error },
    });
  }
}
