import { randomUUID } from 'crypto';
import { StorageService } from './StorageService';
import { Environment, KeyValuePair } from '../types';

const ENVIRONMENTS_DIR = 'environments';

export class EnvService {
  private activeEnvId: string | null = null;

  constructor(private storage: StorageService) {}

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
    return this.storage.deleteFile(ENVIRONMENTS_DIR, `${id}.json`);
  }

  getActiveEnvId(): string | null {
    return this.activeEnvId;
  }

  setActiveEnvId(id: string | null): void {
    this.activeEnvId = id;
  }

  getActiveVariables(): KeyValuePair[] {
    if (!this.activeEnvId) return [];
    const env = this.getById(this.activeEnvId);
    if (!env) return [];
    return env.variables.filter((v) => v.enabled);
  }
}
