import * as vscode from 'vscode';
import { HandlerContext } from './HandlerContext';
import { ApiRequest, CollectionItem } from '../types';

export class CollectionHandler {
  constructor(private ctx: HandlerContext) {}

  handleSaveToCollection(payload: { collectionId: string; folderId?: string; request: ApiRequest }): void {
    if (!this.ctx.collectionService) return;
    const success = this.ctx.collectionService.addRequest(payload.collectionId, payload.request, payload.folderId);
    if (success) {
      this.ctx.onCollectionChanged?.();
    }
    this.ctx.webview.postMessage({
      type: 'saveResult',
      payload: { success },
    });
  }

  handleUpdateCollectionRequest(payload: { collectionId: string; request: ApiRequest }): void {
    if (!this.ctx.collectionService) return;
    const success = this.ctx.collectionService.updateRequest(payload.collectionId, payload.request);
    if (success) {
      this.ctx.onCollectionChanged?.();
    }
    this.ctx.webview.postMessage({
      type: 'saveResult',
      payload: { success },
    });
  }

  handleGetCollections(): void {
    if (!this.ctx.collectionService) {
      this.ctx.webview.postMessage({ type: 'collections', payload: [] });
      return;
    }
    const collections = this.ctx.collectionService.getAll();
    this.ctx.webview.postMessage({ type: 'collections', payload: collections });
  }

  async handleCreateCollection(): Promise<void> {
    if (!this.ctx.collectionService) return;
    const name = await vscode.window.showInputBox({
      prompt: 'Enter collection name',
      placeHolder: 'My Collection',
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (name) {
      this.ctx.collectionService.create(name.trim());
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  async handleRenameCollection(payload: { id: string; currentName: string }): Promise<void> {
    if (!this.ctx.collectionService) return;
    const newName = await vscode.window.showInputBox({
      prompt: 'Rename collection',
      value: payload.currentName,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (newName) {
      this.ctx.collectionService.rename(payload.id, newName.trim());
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  async handleDeleteCollection(payload: { id: string; name: string }): Promise<void> {
    if (!this.ctx.collectionService) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete collection "${payload.name}"?`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.ctx.collectionService.delete(payload.id);
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  async handleAddFolder(payload: { collectionId: string }): Promise<void> {
    if (!this.ctx.collectionService) return;
    const name = await vscode.window.showInputBox({
      prompt: 'Enter folder name',
      placeHolder: 'New Folder',
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (name) {
      this.ctx.collectionService.addFolder(payload.collectionId, name.trim());
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  async handleRenameFolder(payload: { collectionId: string; folderName: string }): Promise<void> {
    if (!this.ctx.collectionService) return;
    const newName = await vscode.window.showInputBox({
      prompt: 'Rename folder',
      value: payload.folderName,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (newName) {
      this.ctx.collectionService.renameFolder(payload.collectionId, payload.folderName, newName.trim());
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  async handleDeleteFolder(payload: { collectionId: string; folderName: string; label: string }): Promise<void> {
    if (!this.ctx.collectionService) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete folder "${payload.label}" and all its contents?`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.ctx.collectionService.removeItem(payload.collectionId, payload.folderName);
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  handleDuplicateFolder(payload: { collectionId: string; folderName: string }): void {
    if (!this.ctx.collectionService) return;
    this.ctx.collectionService.duplicateFolder(payload.collectionId, payload.folderName);
    this.ctx.onCollectionChanged?.();
    this.handleGetCollections();
  }

  async handleAddSubfolder(payload: { collectionId: string; parentFolderName: string }): Promise<void> {
    if (!this.ctx.collectionService) return;
    const name = await vscode.window.showInputBox({
      prompt: 'Subfolder name',
      placeHolder: 'New Folder',
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (name) {
      this.ctx.collectionService.addFolder(payload.collectionId, name.trim(), payload.parentFolderName);
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  async handleDeleteRequest(payload: { collectionId: string; requestId: string; name: string }): Promise<void> {
    if (!this.ctx.collectionService) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete "${payload.name}"?`,
      { modal: true },
      'Delete'
    );
    if (confirm === 'Delete') {
      this.ctx.collectionService.removeItem(payload.collectionId, payload.requestId);
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  async handleRenameRequest(payload: { collectionId: string; requestId: string; currentName: string }): Promise<void> {
    if (!this.ctx.collectionService) return;
    const newName = await vscode.window.showInputBox({
      prompt: 'Rename request',
      value: payload.currentName,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
    });
    if (newName) {
      this.ctx.collectionService.renameRequest(payload.collectionId, payload.requestId, newName.trim());
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
      this.ctx.webview.postMessage({
        type: 'requestRenamed',
        payload: { collectionId: payload.collectionId, requestId: payload.requestId, newName: newName.trim() },
      });
    }
  }

  handleSyncRequestName(payload: { collectionId: string; requestId: string; newName: string }): void {
    if (!this.ctx.collectionService) return;
    this.ctx.collectionService.renameRequest(payload.collectionId, payload.requestId, payload.newName);
    this.ctx.onCollectionChanged?.();
  }

  handleDuplicateRequest(payload: { collectionId: string; requestId: string }): void {
    if (!this.ctx.collectionService) return;
    this.ctx.collectionService.duplicateRequest(payload.collectionId, payload.requestId);
    this.ctx.onCollectionChanged?.();
    this.handleGetCollections();
  }

  async handleMoveRequest(payload: { collectionId: string; requestId: string; name: string }): Promise<void> {
    if (!this.ctx.collectionService) return;
    const allCollections = this.ctx.collectionService.getAll();

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
    const success = this.ctx.collectionService.moveRequest(payload.collectionId, payload.requestId, dest.collectionId, dest.folderId);
    if (success) {
      this.ctx.onCollectionChanged?.();
      this.handleGetCollections();
    }
  }

  handleReorderCollections(payload: { orderedIds: string[] }): void {
    if (!this.ctx.collectionService) return;
    this.ctx.collectionService.setOrder(payload.orderedIds);
  }

  handleReorderCollectionItems(payload: { sourceCollectionId: string; sourceFolderPath: string[]; sourceIndex: number; targetCollectionId: string; targetFolderPath: string[]; targetIndex: number }): void {
    if (!this.ctx.collectionService) return;
    this.ctx.collectionService.moveItemByIndex(
      payload.sourceCollectionId,
      payload.sourceFolderPath,
      payload.sourceIndex,
      payload.targetCollectionId,
      payload.targetFolderPath,
      payload.targetIndex
    );
  }
}
