import * as vscode from 'vscode';
import { HttpClient } from '../services/HttpClient';
import { CollectionService } from '../services/CollectionService';
import { EnvService } from '../services/EnvService';
import { HistoryService } from '../services/HistoryService';
import { WebviewMessage } from '../types/messages';
import { ApiRequest } from '../types';

export class MessageHandler {
  private httpClient: HttpClient;

  constructor(
    private webview: vscode.Webview,
    private collectionService?: CollectionService,
    private envService?: EnvService,
    private historyService?: HistoryService
  ) {
    this.httpClient = new HttpClient();
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
      case 'getCollections':
        this.handleGetCollections();
        break;
      case 'getEnvironments':
        this.handleGetEnvironments();
        break;
      case 'setActiveEnv':
        this.handleSetActiveEnv(message.payload as string | null);
        break;
      case 'ready':
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private async handleSendRequest(requestId: string, apiRequest: ApiRequest): Promise<void> {
    try {
      this.webview.postMessage({
        type: 'requestProgress',
        requestId,
        payload: { status: 'sending' },
      });

      const envVariables = this.envService?.getActiveVariables() || [];
      const response = await this.httpClient.send(apiRequest, requestId, envVariables);

      // Record to history
      this.historyService?.add(apiRequest, response);

      this.webview.postMessage({
        type: 'requestResult',
        requestId,
        payload: response,
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

  private handleSaveToCollection(payload: { collectionId: string; request: ApiRequest }): void {
    if (!this.collectionService) return;
    const success = this.collectionService.addRequest(payload.collectionId, payload.request);
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

  dispose(): void {
    // Cleanup if needed
  }
}
