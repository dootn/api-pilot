import * as vscode from 'vscode';
import { HistoryService } from '../services/HistoryService';
import { HistoryEntry } from '../types';

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HistoryTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private historyService: HistoryService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: HistoryTreeItem): Thenable<HistoryTreeItem[]> {
    if (!element) {
      // Root — show date groups
      const groups = this.historyService.getDateGroups();
      if (groups.length === 0) {
        return Promise.resolve([
          new HistoryTreeItem(
            'No history yet',
            vscode.TreeItemCollapsibleState.None,
            'placeholder'
          ),
        ]);
      }

      return Promise.resolve(
        groups.map((g) => {
          const label = this.formatDateLabel(g.date);
          return new HistoryTreeItem(
            label,
            vscode.TreeItemCollapsibleState.Collapsed,
            'dateGroup',
            undefined,
            g.date,
            `${g.count} requests`
          );
        })
      );
    }

    // Children of a date group
    if (element.groupDate) {
      const entries = this.historyService.getByDate(element.groupDate);
      return Promise.resolve(
        entries.map((entry) => {
          const url = this.shortenUrl(entry.request.url);
          const protocol = entry.request.protocol;
          const isWs = protocol === 'websocket';
          const isSse = protocol === 'sse';
          const isMqtt = protocol === 'mqtt';
          const isGrpc = protocol === 'grpc';

          const methodOrProtocol = isWs
            ? 'WS'
            : isSse
              ? 'SSE'
              : isMqtt
                ? 'MQTT'
                : isGrpc
                  ? 'gRPC'
                  : entry.request.method;

          const label = `${methodOrProtocol} ${url}`;
          const description = isWs
            ? `↑${entry.wsSession?.sentCount ?? 0} ↓${entry.wsSession?.receivedCount ?? 0}`
            : isSse
              ? `↓${entry.sseSession?.eventCount ?? 0}`
              : isMqtt
                ? `↑${entry.mqttSession?.publishedCount ?? 0} ↓${entry.mqttSession?.receivedCount ?? 0}`
                : isGrpc
                  ? `${entry.grpcSession?.methodName ?? ''} ${entry.grpcSession?.statusCode ?? ''}`.trim()
                  : `[${entry.response?.status ?? '?'}]`;

          return new HistoryTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'entry',
            entry,
            undefined,
            description,
            methodOrProtocol
          );
        })
      );
    }

    return Promise.resolve([]);
  }

  private formatDateLabel(dateKey: string): string {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (dateKey === todayKey) return 'Today';
    if (dateKey === yesterdayKey) return 'Yesterday';
    return dateKey;
  }

  private shortenUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname + (u.search ? u.search : '');
    } catch {
      return url.length > 40 ? url.slice(0, 40) + '...' : url;
    }
  }
}

export class HistoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'dateGroup' | 'entry' | 'placeholder',
    public readonly entry?: HistoryEntry,
    public readonly groupDate?: string,
    description?: string,
    method?: string
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.contextValue = itemType;

    if (itemType === 'entry' && entry) {
      // Remove icon to show method name as text only
      // this.iconPath = new vscode.ThemeIcon(iconId);
      this.command = {
        command: 'apiPilot.openRequest',
        title: 'Open Request',
        arguments: [JSON.stringify(entry.request)],
      };
    } else if (itemType === 'dateGroup') {
      this.iconPath = new vscode.ThemeIcon('calendar');
    } else if (itemType === 'placeholder') {
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}
