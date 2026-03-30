import { randomUUID } from 'crypto';
import { StorageService } from './StorageService';
import { HistoryEntry, ApiRequest, ApiResponse } from '../types';

const HISTORY_DIR = 'history';
const MAX_HISTORY_PER_DAY = 200;

export class HistoryService {
  constructor(private storage: StorageService) {}

  add(request: ApiRequest, response: ApiResponse): HistoryEntry {
    const entry: HistoryEntry = {
      id: randomUUID(),
      request,
      response,
      timestamp: Date.now(),
    };

    const dateKey = this.getDateKey(entry.timestamp);
    const entries = this.getEntriesForDate(dateKey);
    entries.unshift(entry);

    // Limit per day
    if (entries.length > MAX_HISTORY_PER_DAY) {
      entries.length = MAX_HISTORY_PER_DAY;
    }

    this.storage.writeJson(HISTORY_DIR, `${dateKey}.json`, entries);
    return entry;
  }

  getRecent(limit: number = 50): HistoryEntry[] {
    const files = this.storage.listFiles(HISTORY_DIR);
    // Sort by date descending
    files.sort((a, b) => b.localeCompare(a));

    const results: HistoryEntry[] = [];
    for (const file of files) {
      if (results.length >= limit) break;
      const entries = this.storage.readJson<HistoryEntry[]>(HISTORY_DIR, file);
      if (entries) {
        results.push(...entries);
      }
    }

    return results.slice(0, limit);
  }

  getByDate(dateKey: string): HistoryEntry[] {
    return this.getEntriesForDate(dateKey);
  }

  getDateGroups(): { date: string; count: number }[] {
    const files = this.storage.listFiles(HISTORY_DIR);
    files.sort((a, b) => b.localeCompare(a));
    return files.map((file) => {
      const dateKey = file.replace('.json', '');
      const entries = this.storage.readJson<HistoryEntry[]>(HISTORY_DIR, file);
      return { date: dateKey, count: entries?.length || 0 };
    });
  }

  clear(): void {
    const files = this.storage.listFiles(HISTORY_DIR);
    for (const file of files) {
      this.storage.deleteFile(HISTORY_DIR, file);
    }
  }

  private getEntriesForDate(dateKey: string): HistoryEntry[] {
    return this.storage.readJson<HistoryEntry[]>(HISTORY_DIR, `${dateKey}.json`) || [];
  }

  private getDateKey(timestamp: number): string {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
