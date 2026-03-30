import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EnvService } from '../EnvService';
import { StorageService } from '../StorageService';
import { workspace } from 'vscode';

describe('EnvService', () => {
  const uniqueDir = `/tmp/test-envs-${process.pid}`;
  const testBasePath = path.join(uniqueDir, '.api-pilot');
  let storage: StorageService;
  let service: EnvService;

  beforeEach(() => {
    (workspace.workspaceFolders as any)[0].uri.fsPath = uniqueDir;
    if (fs.existsSync(uniqueDir)) fs.rmSync(uniqueDir, { recursive: true });
    fs.mkdirSync(uniqueDir, { recursive: true });
    storage = new StorageService();
    service = new EnvService(storage);
  });

  afterEach(() => {
    if (fs.existsSync(uniqueDir)) fs.rmSync(uniqueDir, { recursive: true });
  });

  describe('create', () => {
    it('should create an environment', () => {
      const env = service.create('Production');
      expect(env.id).toBeDefined();
      expect(env.name).toBe('Production');
      expect(env.variables).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should return all environments sorted by name', () => {
      service.create('Staging');
      service.create('Development');
      service.create('Production');
      const all = service.getAll();
      expect(all).toHaveLength(3);
      expect(all[0].name).toBe('Development');
      expect(all[1].name).toBe('Production');
      expect(all[2].name).toBe('Staging');
    });
  });

  describe('getById', () => {
    it('should return an environment by id', () => {
      const env = service.create('Test');
      expect(service.getById(env.id)?.name).toBe('Test');
    });

    it('should return null for non-existent id', () => {
      expect(service.getById('non-existent')).toBeNull();
    });
  });

  describe('update', () => {
    it('should update environment variables', () => {
      const env = service.create('Test');
      env.variables = [
        { key: 'host', value: 'localhost', enabled: true },
        { key: 'port', value: '3000', enabled: true },
      ];
      service.update(env);
      const updated = service.getById(env.id);
      expect(updated?.variables).toHaveLength(2);
      expect(updated?.variables[0].key).toBe('host');
    });
  });

  describe('delete', () => {
    it('should delete an environment', () => {
      const env = service.create('ToDelete');
      service.delete(env.id);
      expect(service.getById(env.id)).toBeNull();
    });

    it('should clear active env id if deleted env was active', () => {
      const env = service.create('Active');
      service.setActiveEnvId(env.id);
      service.delete(env.id);
      expect(service.getActiveEnvId()).toBeNull();
    });
  });

  describe('active environment', () => {
    it('should start with no active environment', () => {
      expect(service.getActiveEnvId()).toBeNull();
    });

    it('should set and get active environment id', () => {
      const env = service.create('Test');
      service.setActiveEnvId(env.id);
      expect(service.getActiveEnvId()).toBe(env.id);
    });

    it('should clear active environment', () => {
      const env = service.create('Test');
      service.setActiveEnvId(env.id);
      service.setActiveEnvId(null);
      expect(service.getActiveEnvId()).toBeNull();
    });

    it('should return active variables for active environment', () => {
      const env = service.create('Test');
      env.variables = [
        { key: 'host', value: 'localhost', enabled: true },
        { key: 'disabled', value: 'nope', enabled: false },
        { key: 'port', value: '3000', enabled: true },
      ];
      service.update(env);
      service.setActiveEnvId(env.id);

      const vars = service.getActiveVariables();
      expect(vars).toHaveLength(2);
      expect(vars.map((v) => v.key)).toEqual(['host', 'port']);
    });

    it('should return empty array when no active environment', () => {
      expect(service.getActiveVariables()).toEqual([]);
    });

    it('should return empty array when active env id is invalid', () => {
      service.setActiveEnvId('non-existent');
      expect(service.getActiveVariables()).toEqual([]);
    });
  });
});
