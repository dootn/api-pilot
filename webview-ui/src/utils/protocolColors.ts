import type { Protocol } from '../types';

export const PROTOCOL_COLORS: Record<string, string> = {
  websocket: 'var(--vscode-terminal-ansiCyan, #4ec9b0)',
  sse: 'var(--vscode-terminal-ansiYellow, #dcdcaa)',
  mqtt: 'var(--vscode-terminal-ansiMagenta, #c586c0)',
  grpc: 'var(--vscode-terminal-ansiBlue, #569cd6)',
  http: 'var(--panel-fg)',
};

export function getProtocolColor(protocol?: Protocol): string {
  return PROTOCOL_COLORS[protocol ?? 'http'] ?? PROTOCOL_COLORS.http;
}

/** HTTP method → color, used across TabBar, Sidebars, etc. */
export const METHOD_COLORS: Record<string, string> = {
  GET: '#4ec9b0',
  POST: '#cca700',
  PUT: '#3794ff',
  DELETE: '#f14c4c',
  PATCH: '#c586c0',
  OPTIONS: '#888',
  HEAD: '#888',
  WS:   'var(--vscode-terminal-ansiCyan, #4ec9b0)',
  SSE:  'var(--vscode-terminal-ansiYellow, #dcdcaa)',
  MQTT: 'var(--vscode-terminal-ansiMagenta, #c586c0)',
  gRPC: 'var(--vscode-terminal-ansiBlue, #569cd6)',
};

/** Connection status → color for WS / SSE / MQTT / gRPC panels. */
export const CONNECTION_STATUS_COLORS: Record<string, string> = {
  connected: 'var(--vscode-terminal-ansiGreen, #4ec9b0)',
  connecting: 'var(--vscode-terminal-ansiYellow, #dcdcaa)',
  disconnected: 'var(--panel-fg)',
  error: 'var(--vscode-errorForeground, #f48771)',
};

/** gRPC call status → color. Reuses connection colors where applicable. */
export const GRPC_STATUS_COLORS: Record<string, string> = {
  idle: CONNECTION_STATUS_COLORS.disconnected,
  connecting: CONNECTION_STATUS_COLORS.connecting,
  streaming: CONNECTION_STATUS_COLORS.connected,
  done: 'var(--vscode-terminal-ansiBlue, #569cd6)',
  error: CONNECTION_STATUS_COLORS.error,
};
