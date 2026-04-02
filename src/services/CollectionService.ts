import { randomUUID } from 'crypto';
import { StorageService } from './StorageService';
import { Collection, CollectionItem, ApiRequest } from '../types';

const COLLECTIONS_DIR = 'collections';
const META_FILE = '_meta.json';
const ORDER_FILE = '_order.json';

/** Tree item stored on disk — request data lives in a separate file, referenced by ID */
interface StoredItemRef {
  type: 'request' | 'folder';
  name: string;
  requestId?: string;
  items?: StoredItemRef[];
}

/** Collection metadata stored on disk (no inline request bodies) */
interface StoredMeta {
  id: string;
  name: string;
  description?: string;
  variables?: Collection['variables'];
  createdAt: number;
  updatedAt: number;
  items: StoredItemRef[];
}

export class CollectionService {
  constructor(private storage: StorageService) {}

  getAll(): Collection[] {
    this.migrateOldFormat();
    const dirs = this.storage.listDirs(COLLECTIONS_DIR);
    const collections: Collection[] = [];
    for (const id of dirs) {
      const col = this.getById(id);
      if (col) collections.push(col);
    }
    
    // Apply custom order if exists
    const orderData = this.storage.readJson<{ orderedIds: string[] }>(COLLECTIONS_DIR, ORDER_FILE);
    if (orderData && orderData.orderedIds) {
      const orderMap = new Map(orderData.orderedIds.map((id, idx) => [id, idx]));
      collections.sort((a, b) => {
        const aOrder = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
    } else {
      collections.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return collections;
  }

  getById(id: string): Collection | null {
    const collDir = `${COLLECTIONS_DIR}/${id}`;
    const meta = this.storage.readJson<StoredMeta>(collDir, META_FILE);
    if (!meta) return null;

    const requestMap = this.loadRequestMap(collDir);
    return { ...meta, items: this.populateItems(meta.items, requestMap) };
  }

  create(name: string, description?: string): Collection {
    const id = randomUUID();
    const meta: StoredMeta = {
      id,
      name,
      description,
      items: [],
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.storage.writeJson(`${COLLECTIONS_DIR}/${id}`, META_FILE, meta);
    return { ...meta, items: [] };
  }

  update(collection: Collection): boolean {
    collection.updatedAt = Date.now();
    const collDir = `${COLLECTIONS_DIR}/${collection.id}`;

    const requests = this.extractRequests(collection.items);
    for (const req of requests) {
      this.storage.writeJson(collDir, `${req.id}.json`, req);
    }

    // Remove request files that are no longer part of the collection
    const activeIds = new Set(requests.map((r) => r.id));
    const existing = this.storage.listFiles(collDir).filter((f) => f !== META_FILE);
    for (const file of existing) {
      if (!activeIds.has(file.replace('.json', ''))) {
        this.storage.deleteFile(collDir, file);
      }
    }

    const meta: StoredMeta = {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      variables: collection.variables,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      items: this.slimItems(collection.items),
    };
    return this.storage.writeJson(collDir, META_FILE, meta);
  }

  delete(id: string): boolean {
    return this.storage.deleteDir(`${COLLECTIONS_DIR}/${id}`);
  }

  rename(id: string, newName: string): boolean {
    const col = this.getById(id);
    if (!col) return false;
    col.name = newName;
    return this.update(col);
  }

  addRequest(collectionId: string, request: ApiRequest, folderId?: string): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;

    const item: CollectionItem = {
      type: 'request',
      name: request.name || `${request.method} ${request.url}`,
      request,
    };

    if (folderId) {
      const folder = this.findFolder(col.items, folderId);
      if (folder && folder.items) {
        folder.items.push(item);
      } else {
        col.items.push(item);
      }
    } else {
      col.items.push(item);
    }

    return this.update(col);
  }

  addFolder(collectionId: string, folderName: string, parentFolderId?: string): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;

    const folder: CollectionItem = {
      type: 'folder',
      name: folderName,
      items: [],
    };

    if (parentFolderId) {
      const parent = this.findFolder(col.items, parentFolderId);
      if (parent && parent.items) {
        parent.items.push(folder);
      } else {
        col.items.push(folder);
      }
    } else {
      col.items.push(folder);
    }

    return this.update(col);
  }

  updateRequest(collectionId: string, request: ApiRequest): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;
    this.updateRequestRecursive(col.items, request);
    return this.update(col);
  }

  private updateRequestRecursive(items: CollectionItem[], request: ApiRequest): boolean {
    for (const item of items) {
      if (item.type === 'request' && item.request?.id === request.id) {
        item.request = { ...request, updatedAt: Date.now() };
        // Always keep the collection item name in sync with the saved request name
        item.name = request.name || `${request.method} ${request.url}`;
        return true;
      }
      if (item.type === 'folder' && item.items) {
        if (this.updateRequestRecursive(item.items, request)) return true;
      }
    }
    return false;
  }

  removeItem(collectionId: string, itemName: string): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;
    this.removeItemRecursive(col.items, itemName);
    return this.update(col);
  }

  renameRequest(collectionId: string, requestId: string, newName: string): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;
    const renamed = this.renameRequestRecursive(col.items, requestId, newName);
    if (!renamed) return false;
    return this.update(col);
  }

  private renameRequestRecursive(items: CollectionItem[], requestId: string, newName: string): boolean {
    for (const item of items) {
      if (item.type === 'request' && item.request?.id === requestId) {
        item.name = newName;
        if (item.request) item.request.name = newName;
        return true;
      }
      if (item.type === 'folder' && item.items) {
        if (this.renameRequestRecursive(item.items, requestId, newName)) return true;
      }
    }
    return false;
  }

  /** Duplicate a request in the same collection */
  duplicateRequest(collectionId: string, requestId: string): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;

    const { item: originalItem, parent } = this.findRequestWithParent(col.items, requestId);
    if (!originalItem || originalItem.type !== 'request' || !originalItem.request) return false;

    // Create a new request with a new ID
    const newId = randomUUID();
    const duplicatedRequest: ApiRequest = {
      ...originalItem.request,
      id: newId,
      name: `${originalItem.request.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const duplicatedItem: CollectionItem = {
      type: 'request',
      name: duplicatedRequest.name,
      request: duplicatedRequest,
    };

    // Insert the duplicated item right after the original
    if (parent) {
      const index = parent.findIndex((item) => item.type === 'request' && item.request?.id === requestId);
      parent.splice(index + 1, 0, duplicatedItem);
    }

    return this.update(col);
  }

  /** Find a request item and its parent array */
  private findRequestWithParent(
    items: CollectionItem[],
    requestId: string,
    parent: CollectionItem[] = items
  ): { item: CollectionItem | null; parent: CollectionItem[] } {
    for (const item of items) {
      if (item.type === 'request' && item.request?.id === requestId) {
        return { item, parent };
      }
      if (item.type === 'folder' && item.items) {
        const result = this.findRequestWithParent(item.items, requestId, item.items);
        if (result.item) return result;
      }
    }
    return { item: null, parent };
  }

  /** Duplicate a folder in the same collection */
  duplicateFolder(collectionId: string, folderName: string): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;

    const { item: originalFolder, parent } = this.findFolderWithParent(col.items, folderName);
    if (!originalFolder || originalFolder.type !== 'folder') return false;

    // Recursively clone the folder and all its contents
    const duplicatedFolder = this.cloneFolder(originalFolder);
    duplicatedFolder.name = `${originalFolder.name} (Copy)`;

    // Insert the duplicated folder right after the original
    const index = parent.findIndex((item) => item.type === 'folder' && item.name === folderName);
    parent.splice(index + 1, 0, duplicatedFolder);

    return this.update(col);
  }

  /** Find a folder item and its parent array */
  private findFolderWithParent(
    items: CollectionItem[],
    folderName: string,
    parent: CollectionItem[] = items
  ): { item: CollectionItem | null; parent: CollectionItem[] } {
    for (const item of items) {
      if (item.type === 'folder' && item.name === folderName) {
        return { item, parent };
      }
      if (item.type === 'folder' && item.items) {
        const result = this.findFolderWithParent(item.items, folderName, item.items);
        if (result.item) return result;
      }
    }
    return { item: null, parent };
  }

  /** Recursively clone a folder and all its contents with new IDs for requests */
  private cloneFolder(folder: CollectionItem): CollectionItem {
    if (folder.type !== 'folder') return folder;

    const clonedItems: CollectionItem[] = [];
    
    for (const item of folder.items || []) {
      if (item.type === 'request' && item.request) {
        // Clone request with new ID
        const newId = randomUUID();
        const clonedRequest: ApiRequest = {
          ...item.request,
          id: newId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        clonedItems.push({
          type: 'request',
          name: item.name,
          request: clonedRequest,
        });
      } else if (item.type === 'folder') {
        // Recursively clone subfolder
        clonedItems.push(this.cloneFolder(item));
      }
    }

    return {
      type: 'folder',
      name: folder.name,
      items: clonedItems,
    };
  }

  /** Move a request from its current collection to a target collection/folder */
  moveRequest(
    sourceCollectionId: string,
    requestId: string,
    targetCollectionId: string,
    targetFolderId?: string
  ): boolean {
    const sourceCol = this.getById(sourceCollectionId);
    if (!sourceCol) return false;

    // Extract the request item from the source tree
    const extracted = this.extractAndRemoveRequest(sourceCol.items, requestId);
    if (!extracted) return false;

    this.update(sourceCol);

    const targetCol = sourceCollectionId === targetCollectionId ? sourceCol : this.getById(targetCollectionId);
    if (!targetCol) return false;

    const freshTarget = this.getById(targetCollectionId);
    if (!freshTarget) return false;

    if (targetFolderId) {
      const folder = this.findFolder(freshTarget.items, targetFolderId);
      if (folder && folder.items) {
        folder.items.push(extracted);
      } else {
        freshTarget.items.push(extracted);
      }
    } else {
      freshTarget.items.push(extracted);
    }
    return this.update(freshTarget);
  }

  /** Move any item (request or folder) from one location to another */
  moveItem(    sourceCollectionId: string,
    itemIdentifier: string, // requestId for requests, folder name for folders
    itemType: 'request' | 'folder',
    targetCollectionId: string,
    targetFolderId?: string
  ): boolean {
    const sourceCol = this.getById(sourceCollectionId);
    if (!sourceCol) return false;

    // Extract the item from the source tree
    const extracted = itemType === 'request' 
      ? this.extractAndRemoveRequest(sourceCol.items, itemIdentifier)
      : this.extractAndRemoveFolder(sourceCol.items, itemIdentifier);
    
    if (!extracted) return false;

    this.update(sourceCol);

    // Get fresh target collection
    const freshTarget = this.getById(targetCollectionId);
    if (!freshTarget) return false;

    // Add to target location
    if (targetFolderId) {
      const folder = this.findFolder(freshTarget.items, targetFolderId);
      if (folder && folder.items) {
        folder.items.push(extracted);
      } else {
        freshTarget.items.push(extracted);
      }
    } else {
      freshTarget.items.push(extracted);
    }
    return this.update(freshTarget);
  }

  private extractAndRemoveFolder(items: CollectionItem[], folderName: string): CollectionItem | null {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === 'folder' && item.name === folderName) {
        items.splice(i, 1);
        return item;
      }
      if (item.type === 'folder' && item.items) {
        const found = this.extractAndRemoveFolder(item.items, folderName);
        if (found) return found;
      }
    }
    return null;
  }

  private extractAndRemoveRequest(items: CollectionItem[], requestId: string): CollectionItem | null {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === 'request' && item.request?.id === requestId) {
        items.splice(i, 1);
        return item;
      }
      if (item.type === 'folder' && item.items) {
        const found = this.extractAndRemoveRequest(item.items, requestId);
        if (found) return found;
      }
    }
    return null;
  }

  renameFolder(collectionId: string, folderName: string, newName: string): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;
    const folder = this.findFolder(col.items, folderName);
    if (!folder) return false;
    folder.name = newName;
    return this.update(col);
  }

  /** Replace full request data in tree items with requestId references for storage */
  private slimItems(items: CollectionItem[]): StoredItemRef[] {
    return items.map((item) => {
      if (item.type === 'request') {
        return { type: 'request', name: item.name, requestId: item.request?.id };
      }
      return { type: 'folder', name: item.name, items: this.slimItems(item.items || []) };
    });
  }

  /** Reconstruct full in-memory items from slim refs + a request map */
  private populateItems(refs: StoredItemRef[], requestMap: Map<string, ApiRequest>): CollectionItem[] {
    return refs.map((ref) => {
      if (ref.type === 'request') {
        const request = ref.requestId ? requestMap.get(ref.requestId) : undefined;
        return { type: 'request', name: ref.name, request };
      }
      return { type: 'folder', name: ref.name, items: this.populateItems(ref.items || [], requestMap) };
    });
  }

  /** Recursively collect all request objects from the item tree */
  private extractRequests(items: CollectionItem[]): ApiRequest[] {
    const result: ApiRequest[] = [];
    for (const item of items) {
      if (item.type === 'request' && item.request) {
        result.push(item.request);
      } else if (item.type === 'folder' && item.items) {
        result.push(...this.extractRequests(item.items));
      }
    }
    return result;
  }

  /** Load all individual request files in a collection directory into a Map */
  private loadRequestMap(collDir: string): Map<string, ApiRequest> {
    const requestMap = new Map<string, ApiRequest>();
    const files = this.storage.listFiles(collDir).filter((f) => f !== META_FILE);
    for (const file of files) {
      const req = this.storage.readJson<ApiRequest>(collDir, file);
      if (req?.id) requestMap.set(req.id, req);
    }
    return requestMap;
  }

  /** Migrate legacy single-file collections (collections/{id}.json) to the new per-request format */
  private migrateOldFormat(): void {
    const oldFiles = this.storage.listFiles(COLLECTIONS_DIR);
    for (const file of oldFiles) {
      const id = file.replace('.json', '');
      const old = this.storage.readJson<Collection>(COLLECTIONS_DIR, file);
      if (old) {
        this.update(old);
        this.storage.deleteFile(COLLECTIONS_DIR, file);
      }
    }
  }

  private removeItemRecursive(items: CollectionItem[], targetName: string): boolean {
    const idx = items.findIndex((item) => {
      if (item.type === 'request' && item.request?.id === targetName) return true;
      if (item.type === 'folder' && item.name === targetName) return true;
      return false;
    });

    if (idx >= 0) {
      items.splice(idx, 1);
      return true;
    }

    for (const item of items) {
      if (item.type === 'folder' && item.items) {
        if (this.removeItemRecursive(item.items, targetName)) return true;
      }
    }
    return false;
  }

  private findFolder(items: CollectionItem[], name: string): CollectionItem | null {
    for (const item of items) {
      if (item.type === 'folder' && item.name === name) return item;
      if (item.type === 'folder' && item.items) {
        const found = this.findFolder(item.items, name);
        if (found) return found;
      }
    }
    return null;
  }

  /** Save custom collection order */
  setOrder(orderedIds: string[]): boolean {
    return this.storage.writeJson(COLLECTIONS_DIR, ORDER_FILE, { orderedIds });
  }

  /** Reorder items within a collection at the given folder path (same parent) */
  reorderItems(collectionId: string, folderPath: string[], fromIndex: number, toIndex: number): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;

    let items = col.items;
    for (const folderName of folderPath) {
      const folder = items.find((item) => item.type === 'folder' && item.name === folderName);
      if (!folder || !folder.items) return false;
      items = folder.items;
    }

    if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return false;
    if (fromIndex === toIndex) return true;

    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);

    return this.update(col);
  }

  /** Move an item by index from any location to any other location (supports cross-folder/cross-collection) */
  moveItemByIndex(
    sourceCollectionId: string,
    sourceFolderPath: string[],
    sourceIndex: number,
    targetCollectionId: string,
    targetFolderPath: string[],
    targetIndex: number
  ): boolean {
    const isSameParent =
      sourceCollectionId === targetCollectionId &&
      JSON.stringify(sourceFolderPath) === JSON.stringify(targetFolderPath);

    if (isSameParent) {
      return this.reorderItems(sourceCollectionId, sourceFolderPath, sourceIndex, targetIndex);
    }

    const sourceCol = this.getById(sourceCollectionId);
    if (!sourceCol) return false;

    const isSameCollection = sourceCollectionId === targetCollectionId;
    const targetCol = isSameCollection ? sourceCol : this.getById(targetCollectionId);
    if (!targetCol) return false;

    // Navigate to source items
    let sourceItems = sourceCol.items;
    for (const folderName of sourceFolderPath) {
      const folder = sourceItems.find((item) => item.type === 'folder' && item.name === folderName);
      if (!folder || !folder.items) return false;
      sourceItems = folder.items;
    }
    if (sourceIndex < 0 || sourceIndex >= sourceItems.length) return false;

    const [moved] = sourceItems.splice(sourceIndex, 1);

    // Navigate to target items (note: for same collection, arrays share reference with sourceCol)
    let targetItems = targetCol.items;
    for (const folderName of targetFolderPath) {
      const folder = targetItems.find((item) => item.type === 'folder' && item.name === folderName);
      if (!folder || !folder.items) return false;
      targetItems = folder.items;
    }

    const insertIdx = Math.min(targetIndex, targetItems.length);
    targetItems.splice(insertIdx, 0, moved);

    if (isSameCollection) {
      return this.update(sourceCol);
    }
    const srcOk = this.update(sourceCol);
    const tgtOk = this.update(targetCol);
    return srcOk && tgtOk;
  }
}
