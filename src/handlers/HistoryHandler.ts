import * as vscode from 'vscode';
import { HandlerContext } from './HandlerContext';

export class HistoryHandler {
  constructor(private ctx: HandlerContext) {}

  handleGetHistory(): void {
    if (!this.ctx.historyService) {
      this.ctx.webview.postMessage({ type: 'history', payload: { groups: [] } });
      return;
    }
    const groups = this.ctx.historyService.getDateGroups();
    const result = groups.map((g) => ({
      date: g.date,
      label: this.formatDateLabel(g.date),
      entries: this.ctx.historyService!.getByDate(g.date),
    }));
    this.ctx.webview.postMessage({ type: 'history', payload: { groups: result } });
  }

  async handleClearHistory(): Promise<void> {
    if (!this.ctx.historyService) return;
    const confirm = await vscode.window.showWarningMessage(
      'Clear all request history?',
      { modal: true },
      'Clear'
    );
    if (confirm === 'Clear') {
      this.ctx.historyService.clear();
      this.ctx.onHistoryChanged?.();
      this.handleGetHistory();
    }
  }

  async handleDeleteHistoryEntry(payload: { id: string }): Promise<void> {
    if (!this.ctx.historyService) return;
    const confirm = await vscode.window.showWarningMessage(
      'Delete this history entry?',
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.ctx.historyService.deleteEntry(payload.id);
      this.ctx.onHistoryChanged?.();
      this.handleGetHistory();
    }
  }

  async handleDeleteHistoryGroup(payload: { date: string; label: string }): Promise<void> {
    if (!this.ctx.historyService) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete all history for "${payload.label}"?`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.ctx.historyService.deleteGroup(payload.date);
      this.ctx.onHistoryChanged?.();
      this.handleGetHistory();
    }
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
}
