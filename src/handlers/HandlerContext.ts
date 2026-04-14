import * as vscode from 'vscode';
import { CollectionService } from '../services/CollectionService';
import { EnvService } from '../services/EnvService';
import { HistoryService } from '../services/HistoryService';
import { StorageService } from '../services/StorageService';

export interface HandlerContext {
  webview: vscode.Webview;
  collectionService?: CollectionService;
  envService?: EnvService;
  historyService?: HistoryService;
  storageService?: StorageService;
  onCollectionChanged?: () => void;
  onHistoryChanged?: () => void;
}
