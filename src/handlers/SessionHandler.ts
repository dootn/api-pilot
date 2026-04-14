import * as vscode from 'vscode';
import { HandlerContext } from './HandlerContext';
import { parseRequest } from '../services/UniversalParser';

const SESSION_DIR = 'session';
const SESSION_FILE = 'tabs.json';

interface PersistedTab {
  id: string;
  name: string;
  isCustomNamed: boolean;
  method: string;
  url: string;
  params: unknown[];
  headers: unknown[];
  body: unknown;
  auth: unknown;
  activeTab: string;
}

interface TabSession {
  tabs: PersistedTab[];
  activeTabId: string;
  savedAt: number;
}

export class SessionHandler {
  constructor(private ctx: HandlerContext) {}

  handleReady(
    broadcastEnvironments: () => void,
    broadcastCollections: () => void,
  ): void {
    // Send saved tab session if available
    if (this.ctx.storageService) {
      const session = this.ctx.storageService.readJson<TabSession>(SESSION_DIR, SESSION_FILE);
      if (session?.tabs?.length) {
        this.ctx.webview.postMessage({ type: 'loadTabState', payload: session });
      }
    }
    // Send current environments and collections
    broadcastEnvironments();
    broadcastCollections();
    // Send locale based on settings then VS Code language
    const configLocale = vscode.workspace.getConfiguration('api-pilot').get<string>('locale', 'auto');
    let locale = 'en';
    if (configLocale === 'auto') {
      locale = vscode.env.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
    } else if (configLocale === 'zh-CN' || configLocale === 'en') {
      locale = configLocale;
    }
    this.ctx.webview.postMessage({ type: 'setLocale', payload: locale });
    // Send custom HTTP methods
    const customMethods = vscode.workspace.getConfiguration('api-pilot').get<string[]>('customHttpMethods', []);
    this.ctx.webview.postMessage({ type: 'setCustomMethods', payload: customMethods.map((m) => m.trim().toUpperCase()).filter(Boolean) });
  }

  handleSaveTabState(session: TabSession): void {
    this.ctx.storageService?.writeJson(SESSION_DIR, SESSION_FILE, session);
  }

  async handleImportRequest(payload: { input: string; newTab?: boolean }): Promise<void> {
    try {
      const request = parseRequest(payload.input);
      this.ctx.webview.postMessage({ type: 'loadRequest', payload: { ...request, _newTab: payload.newTab ?? false } });
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to parse request: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
}
