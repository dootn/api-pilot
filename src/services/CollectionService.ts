import { randomUUID } from 'crypto';
import { StorageService } from './StorageService';
import { Collection, CollectionItem, ApiRequest } from '../types';

const COLLECTIONS_DIR = 'collections';
const META_FILE = '_meta.json';

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
    collections.sort((a, b) => a.name.localeCompare(b.name));
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
}
