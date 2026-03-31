import { randomUUID } from 'crypto';
import { StorageService } from './StorageService';
import { HistoryEntry, ApiRequest, ApiResponse } from '../types';
import { isBinaryContentType } from './contentTypeUtils';

const HISTORY_DIR = 'history';
const MAX_HISTORY_PER_DAY = 200;

export class HistoryService {
  /** Per-instance counter ensures filenames are unique within the same millisecond */
  private addCounter = 0;

  constructor(private storage: StorageService) {}

  add(request: ApiRequest, response: ApiResponse): HistoryEntry {
    const entry: HistoryEntry = {
      id: randomUUID(),
      request,
      response,
      timestamp: Date.now(),
    };

    const dateKey = this.getDateKey(entry.timestamp);
    const dateDir = `${HISTORY_DIR}/${dateKey}`;

    // Enforce per-day limit: delete oldest entry (and its body file) when at capacity
    const existing = this.storage.listFiles(dateDir);
    if (existing.length >= MAX_HISTORY_PER_DAY) {
      const oldest = [...existing].sort()[0];
      const oldBase = oldest.replace('.json', '');
      this.storage.deleteFile(dateDir, oldest);
      this.storage.deleteFile(dateDir, `${oldBase}.body`);
    }

    const seq = String(this.addCounter++).padStart(6, '0');
    const base = `${entry.timestamp}_${seq}_${entry.id}`;

    // Store response body as raw bytes in a separate file (text: UTF-8; binary: raw bytes)
    const entryWithoutBody: HistoryEntry = {
      ...entry,
      response: { ...response, body: '', bodyBase64: undefined },
    };
    this.storage.writeJson(dateDir, `${base}.json`, entryWithoutBody);

    if (response.bodyBase64) {
      // Decode base64 back to raw bytes before storing — no redundant encoding
      this.storage.writeRaw(dateDir, `${base}.body`, Buffer.from(response.bodyBase64, 'base64'));
    } else if (response.body) {
      this.storage.writeRaw(dateDir, `${base}.body`, Buffer.from(response.body, 'utf-8'));
    }

    return entry;
  }

  getRecent(limit = 50): HistoryEntry[] {
    const dateDirs = this.storage.listDirs(HISTORY_DIR).sort().reverse();
    const results: HistoryEntry[] = [];
    for (const dir of dateDirs) {
      if (results.length >= limit) break;
      const entries = this.getEntriesForDate(dir);
      results.push(...entries.slice(0, limit - results.length));
    }
    return results.slice(0, limit);
  }

  getByDate(dateKey: string): HistoryEntry[] {
    return this.getEntriesForDate(dateKey);
  }

  getDateGroups(): { date: string; count: number }[] {
    const dirs = this.storage.listDirs(HISTORY_DIR);
    dirs.sort((a, b) => b.localeCompare(a));
    return dirs.map((dir) => ({
      date: dir,
      count: this.storage.listFiles(`${HISTORY_DIR}/${dir}`).length,
    }));
  }

  clear(): void {
    const dirs = this.storage.listDirs(HISTORY_DIR);
    for (const dir of dirs) {
      this.storage.deleteDir(`${HISTORY_DIR}/${dir}`);
    }
  }

  deleteEntry(id: string): boolean {
    const dirs = this.storage.listDirs(HISTORY_DIR);
    for (const dir of dirs) {
      const dateDir = `${HISTORY_DIR}/${dir}`;
      const files = this.storage.listFiles(dateDir);
      const file = files.find((f) => f.endsWith('.json') && f.includes(id));
      if (file) {
        const base = file.replace('.json', '');
        this.storage.deleteFile(dateDir, file);
        this.storage.deleteFile(dateDir, `${base}.body`);
        return true;
      }
    }
    return false;
  }

  deleteGroup(dateKey: string): boolean {
    return this.storage.deleteDir(`${HISTORY_DIR}/${dateKey}`);
  }

  private getEntriesForDate(dateKey: string): HistoryEntry[] {
    const dateDir = `${HISTORY_DIR}/${dateKey}`;
    const files = this.storage.listFiles(dateDir);
    return files
      .sort((a, b) => b.localeCompare(a)) // descending → newest first
      .map((f) => {
        const entry = this.storage.readJson<HistoryEntry>(dateDir, f);
        if (!entry) return null;
        const base = f.replace('.json', '');
        const bodyBuf = this.storage.readRaw(dateDir, `${base}.body`);
        if (bodyBuf) {
          const ct = entry.response.contentType ?? '';
          if (ct && isBinaryContentType(ct)) {
            // Re-encode to base64 for the webview (message protocol requires serializable data)
            entry.response.bodyBase64 = bodyBuf.toString('base64');
          } else {
            entry.response.body = bodyBuf.toString('utf-8');
          }
        }
        return entry;
      })
      .filter((e): e is HistoryEntry => e !== null);
  }

  private getDateKey(timestamp: number): string {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

