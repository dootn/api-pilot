import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../StorageService';
import { workspace } from 'vscode';

// The StorageService uses vscode.workspace.workspaceFolders which is mocked

describe('StorageService', () => {
  const uniqueDir = `/tmp/test-storage-${process.pid}`;
  const testBasePath = path.join(uniqueDir, '.api-pilot');
  let storage: StorageService;

  beforeEach(() => {
    // Set unique workspace path for this test suite
    (workspace.workspaceFolders as any)[0].uri.fsPath = uniqueDir;
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true });
    }
    fs.mkdirSync(uniqueDir, { recursive: true });
    storage = new StorageService();
  });

  afterEach(() => {
    if (fs.existsSync(uniqueDir)) {
      fs.rmSync(uniqueDir, { recursive: true });
    }
  });

  it('should be available when workspace is open', () => {
    expect(storage.isAvailable()).toBe(true);
  });

  describe('writeJson / readJson', () => {
    it('should write and read JSON data', () => {
      const data = { name: 'test', value: 42 };
      const success = storage.writeJson('test-dir', 'data.json', data);
      expect(success).toBe(true);

      const result = storage.readJson<typeof data>('test-dir', 'data.json');
      expect(result).toEqual(data);
    });

    it('should return null for non-existent file', () => {
      const result = storage.readJson('test-dir', 'nonexistent.json');
      expect(result).toBeNull();
    });

    it('should create directories recursively', () => {
      const data = { test: true };
      storage.writeJson('deep/nested/dir', 'data.json', data);
      expect(fs.existsSync(path.join(testBasePath, 'deep', 'nested', 'dir', 'data.json'))).toBe(true);
    });

    it('should overwrite existing data', () => {
      storage.writeJson('test-dir', 'data.json', { version: 1 });
      storage.writeJson('test-dir', 'data.json', { version: 2 });
      const result = storage.readJson<{ version: number }>('test-dir', 'data.json');
      expect(result?.version).toBe(2);
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', () => {
      storage.writeJson('test-dir', 'to-delete.json', { temp: true });
      const deleted = storage.deleteFile('test-dir', 'to-delete.json');
      expect(deleted).toBe(true);
      expect(storage.readJson('test-dir', 'to-delete.json')).toBeNull();
    });

    it('should return false for non-existent file', () => {
      const result = storage.deleteFile('test-dir', 'nonexistent.json');
      expect(result).toBe(false);
    });
  });

  describe('listFiles', () => {
    it('should list JSON files in directory', () => {
      storage.writeJson('list-test', 'a.json', {});
      storage.writeJson('list-test', 'b.json', {});
      const files = storage.listFiles('list-test');
      expect(files).toContain('a.json');
      expect(files).toContain('b.json');
      expect(files).toHaveLength(2);
    });

    it('should return empty for non-existent directory', () => {
      const files = storage.listFiles('nonexistent-dir');
      expect(files).toEqual([]);
    });

    it('should only list .json files', () => {
      storage.writeJson('filter-test', 'data.json', {});
      // Write a non-json file manually
      const dir = path.join(testBasePath, 'filter-test');
      fs.writeFileSync(path.join(dir, 'readme.txt'), 'hello');
      const files = storage.listFiles('filter-test');
      expect(files).toEqual(['data.json']);
    });
  });
});
