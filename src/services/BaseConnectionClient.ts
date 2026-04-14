import type * as vscode from 'vscode';
import { VariableResolver } from './VariableResolver';
import { HistoryService } from './HistoryService';

export interface BaseConnection {
  connectionId: string;
  tabId: string;
  connectedAt?: number;
}

export abstract class BaseConnectionClient<TConnection extends BaseConnection> {
  protected connections = new Map<string, TConnection>();
  protected tabConnections = new Map<string, string>();
  protected variableResolver = new VariableResolver();

  constructor(
    protected webview: vscode.Webview,
    protected historyService?: HistoryService,
    protected maxHistory = 1000,
  ) {}

  /** Close all connections (called when webview panel is disposed). */
  disposeAll(): void {
    for (const connectionId of [...this.connections.keys()]) {
      this.disconnect(connectionId);
    }
  }

  abstract disconnect(connectionId: string): void;

  protected abstract saveSessionHistory(conn: TConnection): void;
  protected abstract postStatus(tabId: string, status: string, connectionId?: string, error?: string): void;
}
