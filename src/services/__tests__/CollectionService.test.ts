import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CollectionService } from '../CollectionService';
import { StorageService } from '../StorageService';
import { ApiRequest } from '../../types';
import { workspace } from 'vscode';

describe('CollectionService', () => {
  const uniqueDir = `/tmp/test-collections-${process.pid}`;
  const testBasePath = path.join(uniqueDir, '.api-pilot');
  let storage: StorageService;
  let service: CollectionService;

  beforeEach(() => {
    (workspace.workspaceFolders as any)[0].uri.fsPath = uniqueDir;
    if (fs.existsSync(uniqueDir)) fs.rmSync(uniqueDir, { recursive: true });
    fs.mkdirSync(uniqueDir, { recursive: true });
    storage = new StorageService();
    service = new CollectionService(storage);
  });

  afterEach(() => {
    if (fs.existsSync(uniqueDir)) fs.rmSync(uniqueDir, { recursive: true });
  });

  describe('create', () => {
    it('should create a collection with a unique id', () => {
      const col = service.create('My Collection', 'description');
      expect(col.id).toBeDefined();
      expect(col.name).toBe('My Collection');
      expect(col.description).toBe('description');
      expect(col.items).toEqual([]);
    });

    it('should persist the collection', () => {
      const col = service.create('Persisted');
      const retrieved = service.getById(col.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Persisted');
    });
  });

  describe('getAll', () => {
    it('should return all collections sorted by name', () => {
      service.create('Zebra');
      service.create('Alpha');
      service.create('Middle');
      const all = service.getAll();
      expect(all).toHaveLength(3);
      expect(all[0].name).toBe('Alpha');
      expect(all[1].name).toBe('Middle');
      expect(all[2].name).toBe('Zebra');
    });

    it('should return empty array when no collections', () => {
      expect(service.getAll()).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should return null for non-existent id', () => {
      expect(service.getById('non-existent')).toBeNull();
    });
  });

  describe('rename', () => {
    it('should rename a collection', () => {
      const col = service.create('Original');
      const success = service.rename(col.id, 'Renamed');
      expect(success).toBe(true);
      expect(service.getById(col.id)?.name).toBe('Renamed');
    });

    it('should return false for non-existent collection', () => {
      expect(service.rename('bad-id', 'Nope')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a collection', () => {
      const col = service.create('ToDelete');
      const success = service.delete(col.id);
      expect(success).toBe(true);
      expect(service.getById(col.id)).toBeNull();
    });
  });

  describe('addRequest', () => {
    it('should add a request to a collection', () => {
      const col = service.create('Col');
      const request: ApiRequest = {
        id: 'req-1',
        name: 'GET Users',
        method: 'GET',
        url: 'https://api.example.com/users',
        params: [],
        headers: [],
        body: { type: 'none' },
        auth: { type: 'none' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const success = service.addRequest(col.id, request);
      expect(success).toBe(true);

      const updated = service.getById(col.id);
      expect(updated?.items).toHaveLength(1);
      expect(updated?.items[0].type).toBe('request');
      expect(updated?.items[0].name).toBe('GET Users');
    });

    it('should return false for non-existent collection', () => {
      expect(
        service.addRequest('bad-id', {
          id: 'r',
          name: '',
          method: 'GET',
          url: '',
          params: [],
          headers: [],
          body: { type: 'none' },
          auth: { type: 'none' },
          createdAt: 0,
          updatedAt: 0,
        })
      ).toBe(false);
    });
  });

  describe('addFolder', () => {
    it('should add a folder to a collection', () => {
      const col = service.create('Col');
      const success = service.addFolder(col.id, 'Users');
      expect(success).toBe(true);

      const updated = service.getById(col.id);
      expect(updated?.items).toHaveLength(1);
      expect(updated?.items[0].type).toBe('folder');
      expect(updated?.items[0].name).toBe('Users');
    });

    it('should add a nested folder under an existing folder', () => {
      const col = service.create('Col');
      service.addFolder(col.id, 'Parent');
      const success = service.addFolder(col.id, 'Child', 'Parent');
      expect(success).toBe(true);

      const updated = service.getById(col.id);
      const parent = updated?.items[0];
      expect(parent?.items).toHaveLength(1);
      expect(parent?.items?.[0].name).toBe('Child');
    });
  });

  describe('removeItem', () => {
    it('should remove a request from a collection', () => {
      const col = service.create('Col');
      const request: ApiRequest = {
        id: 'req-rm',
        name: 'To Remove',
        method: 'GET',
        url: '',
        params: [],
        headers: [],
        body: { type: 'none' },
        auth: { type: 'none' },
        createdAt: 0,
        updatedAt: 0,
      };
      service.addRequest(col.id, request);
      const success = service.removeItem(col.id, 'req-rm');
      expect(success).toBe(true);
      expect(service.getById(col.id)?.items).toHaveLength(0);
    });
  });
});
