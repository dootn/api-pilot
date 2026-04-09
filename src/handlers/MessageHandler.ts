import * as vscode from 'vscode';
import { HttpClient } from '../services/HttpClient';
import { ScriptRunner } from '../services/ScriptRunner';
import { CollectionService } from '../services/CollectionService';
import { EnvService } from '../services/EnvService';
import { HistoryService } from '../services/HistoryService';
import { StorageService } from '../services/StorageService';
import { exportCurl } from '../services/CurlExporter';
import { VariableResolver } from '../services/VariableResolver';
import { WsClient } from '../services/WsClient';
import { SseClient } from '../services/SseClient';
import { MqttClient } from '../services/MqttClient';
import { WebviewMessage } from '../types/messages';
import { ApiRequest, ConsoleEntry, CollectionItem, Environment, SSLInfo } from '../types';
import { parseCurl } from '../services/CurlParser';
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

export class MessageHandler {
  private httpClient: HttpClient;
  private scriptRunner: ScriptRunner;
  private wsClient: WsClient;
  private sseClient: SseClient;
  private mqttClient: MqttClient;

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
    this.wsClient = new WsClient(
      webview,
      historyService,
      vscode.workspace.getConfiguration('api-pilot').get<number>('maxHistory', 1000),
    );
    this.sseClient = new SseClient(
      webview,
      historyService,
      vscode.workspace.getConfiguration('api-pilot').get<number>('maxHistory', 1000),
    );
    this.mqttClient = new MqttClient(
      webview,
      historyService,
      vscode.workspace.getConfiguration('api-pilot').get<number>('maxHistory', 1000),
    );
  }

  /** Clean up all WebSocket/SSE/MQTT connections when the panel is disposed. */
  dispose(): void {
    this.wsClient.disposeAll();
    this.sseClient.disposeAll();
    this.mqttClient.disposeAll();
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
      // --- Collection CRUD ---
      case 'getHistory':
        this.handleGetHistory();
        break;
      case 'createCollection':
        await this.handleCreateCollection();
        break;
      case 'renameCollection':
        await this.handleRenameCollection(message.payload as { id: string; currentName: string });
        break;
      case 'deleteCollection':
        await this.handleDeleteCollection(message.payload as { id: string; name: string });
        break;
      case 'addFolder':
        await this.handleAddFolder(message.payload as { collectionId: string });
        break;
      case 'renameFolder':
        await this.handleRenameFolder(message.payload as { collectionId: string; folderName: string });
        break;
      case 'deleteFolder':
        await this.handleDeleteFolder(message.payload as { collectionId: string; folderName: string; label: string });
        break;
      case 'duplicateFolder':
        this.handleDuplicateFolder(message.payload as { collectionId: string; folderName: string });
        break;
      case 'addSubfolder':
        await this.handleAddSubfolder(message.payload as { collectionId: string; parentFolderName: string });
        break;
      case 'deleteRequest':
        await this.handleDeleteRequest(message.payload as { collectionId: string; requestId: string; name: string });
        break;
      case 'renameRequest':
        await this.handleRenameRequest(message.payload as { collectionId: string; requestId: string; currentName: string });
        break;
      case 'syncRequestName':
        this.handleSyncRequestName(message.payload as { collectionId: string; requestId: string; newName: string });
        break;
      case 'duplicateRequest':
        this.handleDuplicateRequest(message.payload as { collectionId: string; requestId: string });
        break;
      case 'moveRequest':
        await this.handleMoveRequest(message.payload as { collectionId: string; requestId: string; name: string });
        break;
      case 'reorderCollections':
        this.handleReorderCollections(message.payload as { orderedIds: string[] });
        break;
      case 'reorderCollectionItems':
        this.handleReorderCollectionItems(message.payload as { sourceCollectionId: string; sourceFolderPath: string[]; sourceIndex: number; targetCollectionId: string; targetFolderPath: string[]; targetIndex: number });
        break;
      // --- History CRUD ---
      case 'clearHistory':
        await this.handleClearHistory();
        break;
      case 'deleteHistoryEntry':
        await this.handleDeleteHistoryEntry(message.payload as { id: string });
        break;
      case 'deleteHistoryGroup':
        await this.handleDeleteHistoryGroup(message.payload as { date: string; label: string });
        break;
      case 'importRequest':
        await this.handleImportRequest(message.payload as { input: string });
        break;
      // --- WebSocket / Socket.IO ---
      case 'wsConnect':
        this.handleWsConnect(
          (message as any).tabId as string,
          message.payload as ApiRequest,
        );
        break;
      case 'wsDisconnect':
        this.handleWsDisconnect((message.payload as { connectionId: string }).connectionId);
        break;
      case 'wsSend':
        this.handleWsSend(message.payload as {
          connectionId: string;
          msgType: 'text' | 'binary';
          data: string;
        });
        break;
      // --- SSE ---
      case 'sseConnect':
        this.handleSseConnect(
          (message as any).tabId as string,
          message.payload as ApiRequest,
        );
        break;
      case 'sseDisconnect':
        this.handleSseDisconnect((message.payload as { connectionId: string }).connectionId);
        break;
      // --- MQTT ---
      case 'mqttConnect':
        this.handleMqttConnect(
          (message as any).tabId as string,
          message.payload as ApiRequest,
        );
        break;
      case 'mqttDisconnect':
        this.handleMqttDisconnect((message.payload as { connectionId: string }).connectionId);
        break;
      case 'mqttSubscribe':
        this.handleMqttSubscribe(message.payload as { connectionId: string; topic: string; qos: 0 | 1 | 2 });
        break;
      case 'mqttUnsubscribe':
        this.handleMqttUnsubscribe(message.payload as { connectionId: string; topic: string });
        break;
      case 'mqttPublish':
        this.handleMqttPublish(message.payload as { connectionId: string; topic: string; payload: string; qos: 0 | 1 | 2; retain: boolean });
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private handleWsConnect(tabId: string, request: ApiRequest): void {
    const envVariables = this.envService?.getActiveVariables() || [];
    this.wsClient.connect(tabId, request, envVariables);
  }

  private handleWsDisconnect(connectionId: string): void {
    this.wsClient.disconnect(connectionId);
  }

  private handleWsSend(payload: { connectionId: string; msgType: 'text' | 'binary'; data: string }): void {
    this.wsClient.send(payload.connectionId, payload.msgType, payload.data);
  }

  private handleSseConnect(tabId: string, request: ApiRequest): void {
    const envVariables = this.envService?.getActiveVariables() || [];
    this.sseClient.connect(tabId, request, envVariables);
  }

  private handleSseDisconnect(connectionId: string): void {
    this.sseClient.disconnect(connectionId);
  }

  private handleMqttConnect(tabId: string, request: ApiRequest): void {
    const envVariables = this.envService?.getActiveVariables() || [];
    this.mqttClient.connect(tabId, request, envVariables);
  }

  private handleMqttDisconnect(connectionId: string): void {
    this.mqttClient.disconnect(connectionId);
  }

  private handleMqttSubscribe(payload: { connectionId: string; topic: string; qos: 0 | 1 | 2 }): void {
    this.mqttClient.subscribe(payload.connectionId, payload.topic, payload.qos);
  }

  private handleMqttUnsubscribe(payload: { connectionId: string; topic: string }): void {
    this.mqttClient.unsubscribe(payload.connectionId, payload.topic);
  }

  private handleMqttPublish(payload: { connectionId: string; topic: string; payload: string; qos: 0 | 1 | 2; retain: boolean }): void {
    this.mqttClient.publish(payload.connectionId, payload.topic, payload.payload, payload.qos, payload.retain);
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
      let envUpdates: Array<{ key: string; value: string }> = [];
      if (apiRequest.preScript?.trim()) {
        const result = this.scriptRunner.runPreScript(apiRequest.preScript, apiRequest, envVariables, consoleEntries);
        apiRequest = result.request;
        envUpdates = [...envUpdates, ...result.envUpdates];
      }

      this.webview.postMessage({
        type: 'requestProgress',
        requestId,
        payload: { status: 'sending' },
      });

      const response = await this.httpClient.send(
        apiRequest,
        requestId,
        envVariables,
        vscode.workspace.getConfiguration('api-pilot').get<number>('requestTimeout', 30000),
      );

      // Run post-response script and collect test results
      let testResults: unknown[] = [];
      if (apiRequest.postScript?.trim()) {
        const result = this.scriptRunner.runPostScript(apiRequest.postScript, apiRequest, response, envVariables, consoleEntries);
        testResults = result.testResults;
        envUpdates = [...envUpdates, ...result.envUpdates];
      }

      // Apply environment variable updates if there's an active environment
      if (envUpdates.length > 0 && this.envService) {
        const activeEnvId = this.envService.getActiveEnvId();
        if (activeEnvId) {
          const env = this.envService.getById(activeEnvId);
          if (env) {
            // Update or add variables
            for (const update of envUpdates) {
              const existingVar = env.variables.find(v => v.key === update.key);
              if (existingVar) {
                existingVar.value = update.value;
              } else {
                env.variables.push({ key: update.key, value: update.value, enabled: true });
              }
            }
            this.envService.update(env);
            // Broadcast the updated environments so the webview refreshes immediately
            this.broadcastEnvironments();
          }
        }
      }

      // Record to history
      const maxHistory = vscode.workspace.getConfiguration('api-pilot').get<number>('maxHistory', 1000);
      this.historyService?.add(apiRequest, response, maxHistory);
      this.onHistoryChanged?.();

      this.webview.postMessage({
        type: 'requestResult',
        requestId,
        payload: { ...response, testResults, consoleEntries },
      });
    } catch (error: unknown) {
      const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage = MessageHandler.friendlyErrorMessage(rawErrorMessage, apiRequest?.url ?? '');

      // For HTTPS requests, collect SSL info separately so the user can inspect
      // the certificate even when the request fails (e.g. cert expired, untrusted CA).
      let sslInfo: SSLInfo | undefined;
      const rawUrl = apiRequest?.url?.trim() ?? '';
      const resolvedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'http://' + rawUrl;
      if (resolvedUrl.toLowerCase().startsWith('https://')) {
        try {
          sslInfo = await this.httpClient.collectSSLInfo(resolvedUrl);
        } catch {
          // ignore — SSL info collection is best-effort
        }
      }

      this.webview.postMessage({
        type: 'requestError',
        requestId,
        payload: { message: errorMessage, sslInfo },
      });
    }
  }

  private handleCancelRequest(requestId: string): void {
    this.httpClient.cancel(requestId);
  }

  private static friendlyErrorMessage(message: string, url: string): string {
    // HTTPS sent to a plain-HTTP port (SSL unwrap failure)
    if (/packet length too long|tls_get_more_records|tls_early_post_process_client_hello|wrong version number|http_request/i.test(message)) {
      const portHint = /:80\b/.test(url) ? ' (port 80 is typically plain HTTP)' : '';
      return `SSL handshake failed${portHint}: the server returned a plain HTTP response instead of a TLS handshake. Try using http:// instead of https://.`;
    }
    // Plain HTTP sent to an HTTPS port
    if (/unknown protocol|http_request|ssl alert number 70|ssl alert number 80/i.test(message)) {
      return `Connection failed: the server expects HTTPS but received a plain HTTP request. Try using https:// instead of http://.`;
    }
    // Connection refused
    if (/ECONNREFUSED/i.test(message)) {
      return `Connection refused: no service is listening on that address/port. Check the URL and port number.`;
    }
    // DNS resolution failure
    if (/ENOTFOUND|getaddrinfo/i.test(message)) {
      return `DNS lookup failed: the hostname could not be resolved. Check the URL for typos.`;
    }
    // Connection timeout
    if (/ETIMEDOUT|ESOCKETTIMEDOUT|socket hang up/i.test(message)) {
      return `Request timed out: the server did not respond in time.`;
    }
    // Self-signed / untrusted certificate
    if (/self.signed|DEPTH_ZERO_SELF_SIGNED_CERT|unable to verify the first certificate|ERR_TLS_CERT/i.test(message)) {
      return `SSL certificate error: ${message}. You may need to trust the server's certificate or disable SSL verification.`;
    }
    return message;
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
    // Send current environments and collections
    this.handleGetEnvironments();
    this.handleGetCollections();
    // Send locale based on settings then VS Code language
    const configLocale = vscode.workspace.getConfiguration('api-pilot').get<string>('locale', 'auto');
    let locale = 'en';
    if (configLocale === 'auto') {
      locale = vscode.env.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
    } else if (configLocale === 'zh-CN' || configLocale === 'en') {
      locale = configLocale;
    }
    this.webview.postMessage({ type: 'setLocale', payload: locale });
    // Send custom HTTP methods
    const customMethods = vscode.workspace.getConfiguration('api-pilot').get<string[]>('customHttpMethods', []);
    this.webview.postMessage({ type: 'setCustomMethods', payload: customMethods.map((m) => m.trim().toUpperCase()).filter(Boolean) });
  }

  private handleGetHistory(): void {
    if (!this.historyService) {
      this.webview.postMessage({ type: 'history', payload: { groups: [] } });
      return;
    }
    const groups = this.historyService.getDateGroups();
    const result = groups.map((g) => ({
      date: g.date,
      label: this.formatDateLabel(g.date),
      entries: this.historyService!.getByDate(g.date),
    }));
    this.webview.postMessage({ type: 'history', payload: { groups: result } });
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

  private async handleCreateCollection(): Promise<void> {
    if (!this.collectionService) return;
    const name = await vscode.window.showInputBox({
      prompt: 'Enter collection name',
      placeHolder: 'My Collection',
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (name) {
      this.collectionService.create(name.trim());
      this.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  private async handleRenameCollection(payload: { id: string; currentName: string }): Promise<void> {
    if (!this.collectionService) return;
    const newName = await vscode.window.showInputBox({
      prompt: 'Rename collection',
      value: payload.currentName,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (newName) {
      this.collectionService.rename(payload.id, newName.trim());
      this.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  private async handleDeleteCollection(payload: { id: string; name: string }): Promise<void> {
    if (!this.collectionService) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete collection "${payload.name}"?`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.collectionService.delete(payload.id);
      this.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  private async handleAddFolder(payload: { collectionId: string }): Promise<void> {
    if (!this.collectionService) return;
    const name = await vscode.window.showInputBox({
      prompt: 'Enter folder name',
      placeHolder: 'New Folder',
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (name) {
      this.collectionService.addFolder(payload.collectionId, name.trim());
      this.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  private async handleRenameFolder(payload: { collectionId: string; folderName: string }): Promise<void> {
    if (!this.collectionService) return;
    const newName = await vscode.window.showInputBox({
      prompt: 'Rename folder',
      value: payload.folderName,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (newName) {
      this.collectionService.renameFolder(payload.collectionId, payload.folderName, newName.trim());
      this.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  private async handleDeleteFolder(payload: { collectionId: string; folderName: string; label: string }): Promise<void> {
    if (!this.collectionService) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete folder "${payload.label}" and all its contents?`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.collectionService.removeItem(payload.collectionId, payload.folderName);
      this.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  private handleDuplicateFolder(payload: { collectionId: string; folderName: string }): void {
    if (!this.collectionService) return;
    this.collectionService.duplicateFolder(payload.collectionId, payload.folderName);
    this.onCollectionChanged?.();
    this.handleGetCollections();
  }

  private async handleAddSubfolder(payload: { collectionId: string; parentFolderName: string }): Promise<void> {
    if (!this.collectionService) return;
    const name = await vscode.window.showInputBox({
      prompt: 'Subfolder name',
      placeHolder: 'New Folder',
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (name) {
      this.collectionService.addFolder(payload.collectionId, name.trim(), payload.parentFolderName);
      this.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  private async handleDeleteRequest(payload: { collectionId: string; requestId: string; name: string }): Promise<void> {
    if (!this.collectionService) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete "${payload.name}"?`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.collectionService.removeItem(payload.collectionId, payload.requestId);
      this.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  private async handleRenameRequest(payload: { collectionId: string; requestId: string; currentName: string }): Promise<void> {
    if (!this.collectionService) return;
    const newName = await vscode.window.showInputBox({
      prompt: 'Rename request',
      value: payload.currentName,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (newName) {
      this.collectionService.renameRequest(payload.collectionId, payload.requestId, newName.trim());
      this.onCollectionChanged?.();
      this.handleGetCollections();
      // Notify webview so any open tab for this request updates its name
      this.webview.postMessage({
        type: 'requestRenamed',
        payload: { collectionId: payload.collectionId, requestId: payload.requestId, newName: newName.trim() },
      });
    }
  }

  private handleSyncRequestName(payload: { collectionId: string; requestId: string; newName: string }): void {
    if (!this.collectionService) return;
    this.collectionService.renameRequest(payload.collectionId, payload.requestId, payload.newName);
    this.onCollectionChanged?.();
  }

  private handleDuplicateRequest(payload: { collectionId: string; requestId: string }): void {
    if (!this.collectionService) return;
    this.collectionService.duplicateRequest(payload.collectionId, payload.requestId);
    this.onCollectionChanged?.();
    this.handleGetCollections();
  }

  private async handleMoveRequest(payload: { collectionId: string; requestId: string; name: string }): Promise<void> {
    if (!this.collectionService) return;
    const allCollections = this.collectionService.getAll();

    interface Destination { label: string; collectionId: string; folderId?: string; }
    const destinations: Destination[] = [];
    for (const col of allCollections) {
      destinations.push({ label: `📁 ${col.name}`, collectionId: col.id });
      const walkFolders = (items: CollectionItem[], prefix: string): void => {
        for (const item of items) {
          if (item.type === 'folder') {
            destinations.push({ label: `${prefix}📂 ${item.name}`, collectionId: col.id, folderId: item.name });
            walkFolders(item.items || [], prefix + '  ');
          }
        }
      };
      walkFolders(col.items, '  ');
    }

    if (destinations.length === 0) {
      vscode.window.showWarningMessage('No collections available to move to.');
      return;
    }

    const destLabels = destinations.map((d) => d.label);
    const picked = await vscode.window.showQuickPick(destLabels, { placeHolder: `Move "${payload.name}" to...` });
    if (!picked) return;

    const dest = destinations[destLabels.indexOf(picked)];
    const success = this.collectionService.moveRequest(payload.collectionId, payload.requestId, dest.collectionId, dest.folderId);
    if (success) {
      this.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  private handleReorderCollections(payload: { orderedIds: string[] }): void {
    if (!this.collectionService) return;
    this.collectionService.setOrder(payload.orderedIds);
  }

  private handleReorderCollectionItems(payload: { sourceCollectionId: string; sourceFolderPath: string[]; sourceIndex: number; targetCollectionId: string; targetFolderPath: string[]; targetIndex: number }): void {
    if (!this.collectionService) return;
    this.collectionService.moveItemByIndex(
      payload.sourceCollectionId,
      payload.sourceFolderPath,
      payload.sourceIndex,
      payload.targetCollectionId,
      payload.targetFolderPath,
      payload.targetIndex
    );
  }

  private async handleClearHistory(): Promise<void> {
    if (!this.historyService) return;
    const confirm = await vscode.window.showWarningMessage(
      'Clear all request history?',
      { modal: true },
      'Clear'
    );
    if (confirm === 'Clear') {
      this.historyService.clear();
      this.onHistoryChanged?.();
      this.handleGetHistory();
    }
  }

  private async handleDeleteHistoryEntry(payload: { id: string }): Promise<void> {
    if (!this.historyService) return;
    const confirm = await vscode.window.showWarningMessage(
      'Delete this history entry?',
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.historyService.deleteEntry(payload.id);
      this.onHistoryChanged?.();
      this.handleGetHistory();
    }
  }

  private async handleDeleteHistoryGroup(payload: { date: string; label: string }): Promise<void> {
    if (!this.historyService) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete all history for "${payload.label}"?`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.historyService.deleteGroup(payload.date);
      this.onHistoryChanged?.();
      this.handleGetHistory();
    }
  }

  private async handleImportRequest(payload: { input: string; newTab?: boolean }): Promise<void> {
    try {
      const request = parseRequest(payload.input);
      this.webview.postMessage({ type: 'loadRequest', payload: { ...request, _newTab: payload.newTab ?? false } });
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to parse request: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
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
    const envVariables = this.envService?.getActiveVariables() || [];
    const resolver = new VariableResolver();
    const resolved = envVariables.length > 0 ? resolver.resolveObject(request, envVariables) : request;
    const curl = exportCurl(resolved);
    await vscode.env.clipboard.writeText(curl);
    vscode.window.showInformationMessage('cURL copied to clipboard.');
  }
}
