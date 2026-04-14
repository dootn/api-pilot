import * as vscode from 'vscode';
import { CollectionService } from '../services/CollectionService';
import { EnvService } from '../services/EnvService';
import { HistoryService } from '../services/HistoryService';
import { StorageService } from '../services/StorageService';
import { WsClient } from '../services/WsClient';
import { SseClient } from '../services/SseClient';
import { MqttClient } from '../services/MqttClient';
import { GrpcClient } from '../services/GrpcClient';
import { WebviewMessage } from '../types/messages';
import { ApiRequest, Environment } from '../types';
import { HandlerContext } from './HandlerContext';
import { HttpRequestHandler } from './HttpRequestHandler';
import { CollectionHandler } from './CollectionHandler';
import { EnvironmentHandler } from './EnvironmentHandler';
import { HistoryHandler } from './HistoryHandler';
import { SessionHandler } from './SessionHandler';

export class MessageHandler {
  private wsClient: WsClient;
  private sseClient: SseClient;
  private mqttClient: MqttClient;
  private grpcClient: GrpcClient;

  private httpHandler: HttpRequestHandler;
  private collectionHandler: CollectionHandler;
  private envHandler: EnvironmentHandler;
  private historyHandler: HistoryHandler;
  private sessionHandler: SessionHandler;

  constructor(
    webview: vscode.Webview,
    collectionService?: CollectionService,
    private envService?: EnvService,
    historyService?: HistoryService,
    storageService?: StorageService,
    onCollectionChanged?: () => void,
    onHistoryChanged?: () => void
  ) {
    const ctx: HandlerContext = {
      webview, collectionService, envService, historyService, storageService,
      onCollectionChanged, onHistoryChanged,
    };

    this.httpHandler = new HttpRequestHandler(ctx);
    this.collectionHandler = new CollectionHandler(ctx);
    this.envHandler = new EnvironmentHandler(ctx);
    this.historyHandler = new HistoryHandler(ctx);
    this.sessionHandler = new SessionHandler(ctx);

    const maxHistory = vscode.workspace.getConfiguration('api-pilot').get<number>('maxHistory', 1000);
    this.wsClient = new WsClient(webview, historyService, maxHistory);
    this.sseClient = new SseClient(webview, historyService, maxHistory);
    this.mqttClient = new MqttClient(webview, historyService, maxHistory);
    this.grpcClient = new GrpcClient(webview, historyService, maxHistory);
  }

  /** Clean up all WebSocket/SSE/MQTT/gRPC connections when the panel is disposed. */
  dispose(): void {
    this.wsClient.disposeAll();
    this.sseClient.disposeAll();
    this.mqttClient.disposeAll();
    this.grpcClient.disposeAll();
  }

  async handle(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      // --- HTTP ---
      case 'sendRequest':
        await this.httpHandler.handleSendRequest(message.requestId!, message.payload as ApiRequest);
        break;
      case 'cancelRequest':
        this.httpHandler.handleCancelRequest(message.requestId!);
        break;
      case 'saveToCollection':
        this.collectionHandler.handleSaveToCollection(message.payload as { collectionId: string; request: ApiRequest });
        break;
      case 'updateCollectionRequest':
        this.collectionHandler.handleUpdateCollectionRequest(message.payload as { collectionId: string; request: ApiRequest });
        break;
      case 'getCollections':
        this.collectionHandler.handleGetCollections();
        break;
      case 'getEnvironments':
        this.envHandler.handleGetEnvironments();
        break;
      case 'setActiveEnv':
        this.envHandler.handleSetActiveEnv(message.payload as string | null);
        break;
      case 'createEnvironment':
        this.envHandler.handleCreateEnvironment((message.payload as { name: string }).name);
        break;
      case 'updateEnvironment':
        this.envHandler.handleUpdateEnvironment((message.payload as { env: Environment }).env);
        break;
      case 'deleteEnvironment':
        this.envHandler.handleDeleteEnvironment((message.payload as { id: string }).id);
        break;
      case 'downloadFile':
        await this.httpHandler.handleDownloadFile(message.payload as {
          filename: string;
          contentType?: string;
          bodyBase64?: string;
          body?: string;
        });
        break;
      case 'saveTabState':
        this.sessionHandler.handleSaveTabState(message.payload as any);
        break;
      case 'selectBinaryFile':
        await this.httpHandler.handleSelectBinaryFile(message.requestId!);
        break;
      case 'selectFormDataFile':
        await this.httpHandler.handleSelectFormDataFile(message.requestId!, (message.payload as { fieldKey: string }).fieldKey);
        break;
      case 'copyAsCurl':
        await this.httpHandler.handleCopyAsCurl(message.payload as ApiRequest);
        break;
      case 'ready':
        this.sessionHandler.handleReady(
          () => this.envHandler.handleGetEnvironments(),
          () => this.collectionHandler.handleGetCollections(),
        );
        break;
      // --- Collection CRUD ---
      case 'getHistory':
        this.historyHandler.handleGetHistory();
        break;
      case 'createCollection':
        await this.collectionHandler.handleCreateCollection();
        break;
      case 'renameCollection':
        await this.collectionHandler.handleRenameCollection(message.payload as { id: string; currentName: string });
        break;
      case 'deleteCollection':
        await this.collectionHandler.handleDeleteCollection(message.payload as { id: string; name: string });
        break;
      case 'addFolder':
        await this.collectionHandler.handleAddFolder(message.payload as { collectionId: string });
        break;
      case 'renameFolder':
        await this.collectionHandler.handleRenameFolder(message.payload as { collectionId: string; folderName: string });
        break;
      case 'deleteFolder':
        await this.collectionHandler.handleDeleteFolder(message.payload as { collectionId: string; folderName: string; label: string });
        break;
      case 'duplicateFolder':
        this.collectionHandler.handleDuplicateFolder(message.payload as { collectionId: string; folderName: string });
        break;
      case 'addSubfolder':
        await this.collectionHandler.handleAddSubfolder(message.payload as { collectionId: string; parentFolderName: string });
        break;
      case 'deleteRequest':
        await this.collectionHandler.handleDeleteRequest(message.payload as { collectionId: string; requestId: string; name: string });
        break;
      case 'renameRequest':
        await this.collectionHandler.handleRenameRequest(message.payload as { collectionId: string; requestId: string; currentName: string });
        break;
      case 'syncRequestName':
        this.collectionHandler.handleSyncRequestName(message.payload as { collectionId: string; requestId: string; newName: string });
        break;
      case 'duplicateRequest':
        this.collectionHandler.handleDuplicateRequest(message.payload as { collectionId: string; requestId: string });
        break;
      case 'moveRequest':
        await this.collectionHandler.handleMoveRequest(message.payload as { collectionId: string; requestId: string; name: string });
        break;
      case 'reorderCollections':
        this.collectionHandler.handleReorderCollections(message.payload as { orderedIds: string[] });
        break;
      case 'reorderCollectionItems':
        this.collectionHandler.handleReorderCollectionItems(message.payload as { sourceCollectionId: string; sourceFolderPath: string[]; sourceIndex: number; targetCollectionId: string; targetFolderPath: string[]; targetIndex: number });
        break;
      // --- History CRUD ---
      case 'clearHistory':
        await this.historyHandler.handleClearHistory();
        break;
      case 'deleteHistoryEntry':
        await this.historyHandler.handleDeleteHistoryEntry(message.payload as { id: string });
        break;
      case 'deleteHistoryGroup':
        await this.historyHandler.handleDeleteHistoryGroup(message.payload as { date: string; label: string });
        break;
      case 'importRequest':
        await this.sessionHandler.handleImportRequest(message.payload as { input: string });
        break;
      // --- WebSocket / Socket.IO ---
      case 'wsConnect':
        this.handleWsConnect((message as any).tabId as string, message.payload as ApiRequest);
        break;
      case 'wsDisconnect':
        this.wsClient.disconnect((message.payload as { connectionId: string }).connectionId);
        break;
      case 'wsSend':
        this.wsClient.send(
          (message.payload as any).connectionId,
          (message.payload as any).msgType,
          (message.payload as any).data,
        );
        break;
      // --- SSE ---
      case 'sseConnect':
        this.handleSseConnect((message as any).tabId as string, message.payload as ApiRequest);
        break;
      case 'sseDisconnect':
        this.sseClient.disconnect((message.payload as { connectionId: string }).connectionId);
        break;
      // --- MQTT ---
      case 'mqttConnect':
        this.handleMqttConnect((message as any).tabId as string, message.payload as ApiRequest);
        break;
      case 'mqttDisconnect':
        this.mqttClient.disconnect((message.payload as { connectionId: string }).connectionId);
        break;
      case 'mqttSubscribe':
        this.mqttClient.subscribe(
          (message.payload as any).connectionId,
          (message.payload as any).topic,
          (message.payload as any).qos,
        );
        break;
      case 'mqttUnsubscribe':
        this.mqttClient.unsubscribe(
          (message.payload as any).connectionId,
          (message.payload as any).topic,
        );
        break;
      case 'mqttPublish': {
        const p = message.payload as any;
        this.mqttClient.publish(p.connectionId, p.topic, p.payload, p.qos, p.retain);
        break;
      }
      // --- gRPC ---
      case 'grpcCall':
        this.handleGrpcCall((message as any).tabId as string, message.payload as ApiRequest);
        break;
      case 'grpcSend':
        this.grpcClient.send((message.payload as any).callId, (message.payload as any).data);
        break;
      case 'grpcCancel':
        this.grpcClient.cancel((message.payload as any).callId);
        break;
      case 'grpcReflect':
        this.handleGrpcReflect((message as any).tabId as string, message.payload as ApiRequest);
        break;
      case 'grpcLoadProto':
        this.grpcClient.loadFromProto(
          (message as any).tabId as string,
          (message.payload as any).protoContent,
          (message.payload as any).protoFileName,
        );
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  // --- Protocol connect helpers (need env resolution) ---

  private handleWsConnect(tabId: string, request: ApiRequest): void {
    const envVariables = this.envService?.getActiveVariables() || [];
    this.wsClient.connect(tabId, request, envVariables);
  }

  private handleSseConnect(tabId: string, request: ApiRequest): void {
    const envVariables = this.envService?.getActiveVariables() || [];
    this.sseClient.connect(tabId, request, envVariables);
  }

  private handleMqttConnect(tabId: string, request: ApiRequest): void {
    const envVariables = this.envService?.getActiveVariables() || [];
    this.mqttClient.connect(tabId, request, envVariables);
  }

  private handleGrpcCall(tabId: string, request: ApiRequest): void {
    const envVars = this.envService?.getActiveVariables() ?? [];
    this.grpcClient.call(tabId, request, envVars);
  }

  private handleGrpcReflect(tabId: string, request: ApiRequest): void {
    const envVars = this.envService?.getActiveVariables() ?? [];
    this.grpcClient.reflect(tabId, request, envVars);
  }
}
