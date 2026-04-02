import { randomUUID } from 'crypto';
import { StorageService } from './StorageService';
import { Environment, KeyValuePair } from '../types';

const ENVIRONMENTS_DIR = 'environments';
const SETTINGS_FILE = 'settings.json';

interface Settings {
  activeEnvId?: string | null;
}

export class EnvService {
  private activeEnvId: string | null = null;

  constructor(private storage: StorageService) {
    // Create a default environment if none exist
    if (this.getAll().length === 0) {
      const defaultEnv = this.create('Default');
      this.activeEnvId = defaultEnv.id;
      this.saveSettings();
      return;
    }

    // Restore the previously active environment across restarts
    const settings = this.storage.readJson<Settings>('', SETTINGS_FILE);
    if (settings?.activeEnvId) {
      const env = this.getById(settings.activeEnvId);
      this.activeEnvId = env ? settings.activeEnvId : null;
    }
  }

  private saveSettings(): void {
    const current = this.storage.readJson<Settings>('', SETTINGS_FILE) ?? {};
    this.storage.writeJson('', SETTINGS_FILE, { ...current, activeEnvId: this.activeEnvId });
  }

  getAll(): Environment[] {
    const files = this.storage.listFiles(ENVIRONMENTS_DIR);
    const envs: Environment[] = [];
    for (const file of files) {
      const env = this.storage.readJson<Environment>(ENVIRONMENTS_DIR, file);
      if (env) envs.push(env);
    }
    envs.sort((a, b) => a.name.localeCompare(b.name));
    return envs;
  }

  getById(id: string): Environment | null {
    return this.storage.readJson<Environment>(ENVIRONMENTS_DIR, `${id}.json`);
  }

  create(name: string): Environment {
    const env: Environment = {
      id: randomUUID(),
      name,
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.storage.writeJson(ENVIRONMENTS_DIR, `${env.id}.json`, env);
    return env;
  }

  update(env: Environment): boolean {
    env.updatedAt = Date.now();
    return this.storage.writeJson(ENVIRONMENTS_DIR, `${env.id}.json`, env);
  }

  delete(id: string): boolean {
    if (this.activeEnvId === id) {
      this.activeEnvId = null;
    }
    const result = this.storage.deleteFile(ENVIRONMENTS_DIR, `${id}.json`);
    // Always keep at least one environment
    if (this.getAll().length === 0) {
      const defaultEnv = this.create('Default');
      this.activeEnvId = defaultEnv.id;
      this.saveSettings();
    }
    return result;
  }

  getActiveEnvId(): string | null {
    return this.activeEnvId;
  }

  setActiveEnvId(id: string | null): void {
    this.activeEnvId = id;
    this.saveSettings();
  }

  getActiveVariables(): KeyValuePair[] {
    if (!this.activeEnvId) return [];
    const env = this.getById(this.activeEnvId);
    if (!env) return [];
    return env.variables.filter((v) => v.enabled);
  }
}
