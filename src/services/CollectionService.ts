import { randomUUID } from 'crypto';
import { StorageService } from './StorageService';
import { Collection, CollectionItem, ApiRequest } from '../types';

const COLLECTIONS_DIR = 'collections';

export class CollectionService {
  constructor(private storage: StorageService) {}

  getAll(): Collection[] {
    const files = this.storage.listFiles(COLLECTIONS_DIR);
    const collections: Collection[] = [];
    for (const file of files) {
      const col = this.storage.readJson<Collection>(COLLECTIONS_DIR, file);
      if (col) collections.push(col);
    }
    collections.sort((a, b) => a.name.localeCompare(b.name));
    return collections;
  }

  getById(id: string): Collection | null {
    return this.storage.readJson<Collection>(COLLECTIONS_DIR, `${id}.json`);
  }

  create(name: string, description?: string): Collection {
    const collection: Collection = {
      id: randomUUID(),
      name,
      description,
      items: [],
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.storage.writeJson(COLLECTIONS_DIR, `${collection.id}.json`, collection);
    return collection;
  }

  update(collection: Collection): boolean {
    collection.updatedAt = Date.now();
    return this.storage.writeJson(COLLECTIONS_DIR, `${collection.id}.json`, collection);
  }

  delete(id: string): boolean {
    return this.storage.deleteFile(COLLECTIONS_DIR, `${id}.json`);
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

  removeItem(collectionId: string, itemName: string): boolean {
    const col = this.getById(collectionId);
    if (!col) return false;
    this.removeItemRecursive(col.items, itemName);
    return this.update(col);
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
