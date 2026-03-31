import * as vscode from 'vscode';
import { HttpClient } from '../services/HttpClient';
import { ScriptRunner } from '../services/ScriptRunner';
import { CollectionService } from '../services/CollectionService';
import { EnvService } from '../services/EnvService';
import { HistoryService } from '../services/HistoryService';
import { StorageService } from '../services/StorageService';
import { exportCurl } from '../services/CurlExporter';
import { WebviewMessage } from '../types/messages';
import { ApiRequest, ConsoleEntry, Environment } from '../types';

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

export class MessageHandler {
  private httpClient: HttpClient;
  private scriptRunner: ScriptRunner;

  constructor(
    private webview: vscode.Webview,
    private collectionService?: CollectionService,
    private envService?: EnvService,
    private historyService?: HistoryService,
    private storageService?: StorageService,
    private onCollectionChanged?: () => void,
    private onHistoryChanged?: () => void
  ) {
    this.httpClient = new HttpClient();
    this.scriptRunner = new ScriptRunner();
  }

  async handle(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'sendRequest':
        await this.handleSendRequest(message.requestId!, message.payload as ApiRequest);
        break;
      case 'cancelRequest':
        this.handleCancelRequest(message.requestId!);
        break;
      case 'saveToCollection':
        this.handleSaveToCollection(message.payload as { collectionId: string; request: ApiRequest });
        break;
      case 'updateCollectionRequest':
        this.handleUpdateCollectionRequest(message.payload as { collectionId: string; request: ApiRequest });
        break;
      case 'getCollections':
        this.handleGetCollections();
        break;
      case 'getEnvironments':
        this.handleGetEnvironments();
        break;
      case 'setActiveEnv':
        this.handleSetActiveEnv(message.payload as string | null);
        break;
      case 'createEnvironment':
        this.handleCreateEnvironment((message.payload as { name: string }).name);
        break;
      case 'updateEnvironment':
        this.handleUpdateEnvironment((message.payload as { env: Environment }).env);
        break;
      case 'deleteEnvironment':
        this.handleDeleteEnvironment((message.payload as { id: string }).id);
        break;
      case 'downloadFile':
        await this.handleDownloadFile(message.payload as {
          filename: string;
          contentType?: string;
          bodyBase64?: string;
          body?: string;
        });
        break;
      case 'saveTabState':
        this.handleSaveTabState(message.payload as TabSession);
        break;
      case 'selectBinaryFile':
        await this.handleSelectBinaryFile(message.requestId!);
        break;
      case 'selectFormDataFile':
        await this.handleSelectFormDataFile(message.requestId!, (message.payload as { fieldKey: string }).fieldKey);
        break;
      case 'copyAsCurl':
        await this.handleCopyAsCurl(message.payload as ApiRequest);
        break;
      case 'ready':
        this.handleReady();
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private async handleSendRequest(requestId: string, apiRequest: ApiRequest): Promise<void> {
    try {
      // Pre-read binary file if needed
      if (apiRequest.body.type === 'binary' && apiRequest.body.binaryPath) {
        try {
          const data = await vscode.workspace.fs.readFile(vscode.Uri.file(apiRequest.body.binaryPath));
          apiRequest.body.binaryData = Buffer.from(data).toString('base64');
        } catch {
          // ignore read error — HttpClient will skip binary body
        }
      }

      // Pre-read form-data files if needed
      if (apiRequest.body.type === 'form-data' && apiRequest.body.formData) {
        for (const field of apiRequest.body.formData) {
          if (field.type === 'file' && field.filePath) {
            try {
              const data = await vscode.workspace.fs.readFile(vscode.Uri.file(field.filePath));
              field.fileData = Buffer.from(data).toString('base64');
            } catch {
              // ignore read error — HttpClient will skip this field
            }
          }
        }
      }

      const envVariables = this.envService?.getActiveVariables() || [];
      const consoleEntries: ConsoleEntry[] = [];

      // Run pre-request script (may modify headers, params, url, etc.)
      if (apiRequest.preScript?.trim()) {
        apiRequest = this.scriptRunner.runPreScript(apiRequest.preScript, apiRequest, envVariables, consoleEntries);
      }

      this.webview.postMessage({
        type: 'requestProgress',
        requestId,
        payload: { status: 'sending' },
      });

      const response = await this.httpClient.send(apiRequest, requestId, envVariables);

      // Run post-response script and collect test results
      const testResults = apiRequest.postScript?.trim()
        ? this.scriptRunner.runPostScript(apiRequest.postScript, apiRequest, response, envVariables, consoleEntries)
        : [];

      // Record to history
      this.historyService?.add(apiRequest, response);
      this.onHistoryChanged?.();

      this.webview.postMessage({
        type: 'requestResult',
        requestId,
        payload: { ...response, testResults, consoleEntries },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.webview.postMessage({
        type: 'requestError',
        requestId,
        payload: { message: errorMessage },
      });
    }
  }

  private handleCancelRequest(requestId: string): void {
    this.httpClient.cancel(requestId);
  }

  private handleUpdateCollectionRequest(payload: { collectionId: string; request: ApiRequest }): void {
    if (!this.collectionService) return;
    const success = this.collectionService.updateRequest(payload.collectionId, payload.request);
    if (success) {
      this.onCollectionChanged?.();
    }
    this.webview.postMessage({
      type: 'saveResult',
      payload: { success },
    });
  }

  private handleSaveToCollection(payload: { collectionId: string; folderId?: string; request: ApiRequest }): void {
    if (!this.collectionService) return;
    const success = this.collectionService.addRequest(payload.collectionId, payload.request, payload.folderId);
    if (success) {
      this.onCollectionChanged?.();
    }
    this.webview.postMessage({
      type: 'saveResult',
      payload: { success },
    });
  }

  private handleGetCollections(): void {
    if (!this.collectionService) {
      this.webview.postMessage({
        type: 'collections',
        payload: [],
      });
      return;
    }
    const collections = this.collectionService.getAll();
    this.webview.postMessage({
      type: 'collections',
      payload: collections,
    });
  }

  private handleGetEnvironments(): void {
    if (!this.envService) {
      this.webview.postMessage({ type: 'environments', payload: [] });
      return;
    }
    const envs = this.envService.getAll();
    const activeId = this.envService.getActiveEnvId();
    this.webview.postMessage({
      type: 'environments',
      payload: { environments: envs, activeEnvId: activeId },
    });
  }

  private handleSetActiveEnv(envId: string | null): void {
    if (!this.envService) return;
    this.envService.setActiveEnvId(envId);
    this.webview.postMessage({
      type: 'activeEnvChanged',
      payload: { activeEnvId: envId },
    });
  }

  private handleCreateEnvironment(name: string): void {
    if (!this.envService) return;
    const env = this.envService.create(name.trim() || 'New Environment');
    this.envService.setActiveEnvId(env.id);
    this.broadcastEnvironments();
  }

  private handleUpdateEnvironment(env: Environment): void {
    if (!this.envService) return;
    this.envService.update(env);
    this.broadcastEnvironments();
  }

  private handleDeleteEnvironment(id: string): void {
    if (!this.envService) return;
    const activeId = this.envService.getActiveEnvId();
    this.envService.delete(id);
    if (activeId === id) {
      this.envService.setActiveEnvId(null);
    }
    this.broadcastEnvironments();
  }

  private broadcastEnvironments(): void {
    if (!this.envService) return;
    const envs = this.envService.getAll();
    const activeId = this.envService.getActiveEnvId();
    this.webview.postMessage({
      type: 'environments',
      payload: { environments: envs, activeEnvId: activeId },
    });
  }

  private handleReady(): void {
    // Send saved tab session if available
    if (this.storageService) {
      const session = this.storageService.readJson<TabSession>(SESSION_DIR, SESSION_FILE);
      if (session?.tabs?.length) {
        this.webview.postMessage({ type: 'loadTabState', payload: session });
      }
    }
    // Also send current environments
    this.handleGetEnvironments();
    // Send locale based on settings then VS Code language
    const configLocale = vscode.workspace.getConfiguration('api-pilot').get<string>('locale', 'auto');
    let locale = 'en';
    if (configLocale === 'auto') {
      locale = vscode.env.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
    } else if (configLocale === 'zh-CN' || configLocale === 'en') {
      locale = configLocale;
    }
    this.webview.postMessage({ type: 'setLocale', payload: locale });
  }

  private handleSaveTabState(session: TabSession): void {
    this.storageService?.writeJson(SESSION_DIR, SESSION_FILE, session);
  }

  private async handleDownloadFile(payload: {
    filename: string;
    contentType?: string;
    bodyBase64?: string;
    body?: string;
  }): Promise<void> {
    const safeName = payload.filename.replace(/[/\\:*?"<>|]/g, '_');
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(safeName),
      filters: { 'All Files': ['*'] },
    });
    if (!uri) return;

    let data: Uint8Array;
    if (payload.bodyBase64) {
      data = Buffer.from(payload.bodyBase64, 'base64');
    } else {
      data = Buffer.from(payload.body ?? '', 'utf-8');
    }

    await vscode.workspace.fs.writeFile(uri, data);
    vscode.window.showInformationMessage(`Saved: ${uri.fsPath.split('/').pop() ?? safeName}`);
  }

  private async handleSelectBinaryFile(requestId: string): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Select File',
    });
    if (uris && uris[0]) {
      const filePath = uris[0].fsPath;
      const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'file';
      this.webview.postMessage({
        type: 'filePicked',
        requestId,
        payload: { path: filePath, name },
      });
    }
  }

  private async handleSelectFormDataFile(requestId: string, fieldKey: string): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Select File',
    });
    if (uris && uris[0]) {
      const filePath = uris[0].fsPath;
      const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'file';
      this.webview.postMessage({
        type: 'formDataFilePicked',
        requestId,
        payload: { fieldKey, path: filePath, name },
      });
    }
  }

  private async handleCopyAsCurl(request: ApiRequest): Promise<void> {
    const curl = exportCurl(request);
    await vscode.env.clipboard.writeText(curl);
    vscode.window.showInformationMessage('cURL copied to clipboard.');
  }

  dispose(): void {
    // Cleanup if needed
  }
}
