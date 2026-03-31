import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const DATA_DIR = '.api-pilot';

export class StorageService {
  private basePath: string | null = null;

  constructor() {
    this.initBasePath();
  }

  private initBasePath(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      this.basePath = path.join(workspaceFolders[0].uri.fsPath, DATA_DIR);
    }
  }

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private getFullPath(subDir: string, fileName?: string): string | null {
    if (!this.basePath) return null;
    const dir = path.join(this.basePath, subDir);
    this.ensureDir(dir);
    return fileName ? path.join(dir, fileName) : dir;
  }

  readJson<T>(subDir: string, fileName: string): T | null {
    const filePath = this.getFullPath(subDir, fileName);
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  writeJson<T>(subDir: string, fileName: string, data: T): boolean {
    const filePath = this.getFullPath(subDir, fileName);
    if (!filePath) return false;
    try {
      const tmpPath = filePath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch (err) {
      console.error('StorageService write error:', err);
      return false;
    }
  }

  deleteFile(subDir: string, fileName: string): boolean {
    const filePath = this.getFullPath(subDir, fileName);
    if (!filePath || !fs.existsSync(filePath)) return false;
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  readRaw(subDir: string, fileName: string): Buffer | null {
    const filePath = this.getFullPath(subDir, fileName);
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      return fs.readFileSync(filePath);
    } catch {
      return null;
    }
  }

  writeRaw(subDir: string, fileName: string, data: Buffer): boolean {
    const filePath = this.getFullPath(subDir, fileName);
    if (!filePath) return false;
    try {
      const tmpPath = filePath + '.tmp';
      fs.writeFileSync(tmpPath, data);
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch {
      return false;
    }
  }

  listFiles(subDir: string): string[] {
    const dir = this.getFullPath(subDir);
    if (!dir || !fs.existsSync(dir)) return [];
    try {
      return fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  listDirs(subDir: string): string[] {
    if (!this.basePath) return [];
    const dir = path.join(this.basePath, subDir);
    if (!fs.existsSync(dir)) return [];
    try {
      return fs.readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      return [];
    }
  }

  deleteDir(subDir: string): boolean {
    if (!this.basePath) return false;
    const dir = path.join(this.basePath, subDir);
    if (!fs.existsSync(dir)) return false;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  isAvailable(): boolean {
    return this.basePath !== null;
  }
}
