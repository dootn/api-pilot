import { randomUUID, createHash } from 'crypto';
import { StorageService } from './StorageService';
import { HistoryEntry, ApiRequest, ApiResponse, WsSessionSummary, SseSessionSummary } from '../types';
import { isBinaryContentType } from './contentTypeUtils';

const HISTORY_DIR = 'history';
/** Content-addressed body store — one file per unique response body (keyed by MD5 hex). */
const BODIES_DIR = `${HISTORY_DIR}/.bodies`;

/** Stored JSON format augments HistoryEntry with a content-hash reference for the body. */
type StoredEntry = HistoryEntry & { bodyMd5?: string };

export class HistoryService {
  /** Per-instance counter ensures filenames are unique within the same millisecond */
  private addCounter = 0;

  constructor(private storage: StorageService) {}

  /**
   * Record a new history entry.
   * @param maxTotal  Maximum *total* entries to keep across all days. Default 1000.
   */
  add(request: ApiRequest, response: ApiResponse, maxTotal = 1000): HistoryEntry {
    const entry: HistoryEntry = {
      id: randomUUID(),
      request,
      response,
      timestamp: Date.now(),
    };

    const dateKey = this.getDateKey(entry.timestamp);
    const dateDir = `${HISTORY_DIR}/${dateKey}`;

    // Store response body content-addressed by MD5 (dedup across all entries)
    let bodyMd5: string | undefined;
    if (response.bodyBase64 || response.body) {
      const bodyBuf = response.bodyBase64
        ? Buffer.from(response.bodyBase64, 'base64')
        : Buffer.from(response.body, 'utf-8');
      bodyMd5 = createHash('md5').update(bodyBuf).digest('hex');
      // Only write the body file once per unique content
      if (!this.storage.fileExists(BODIES_DIR, bodyMd5)) {
        this.storage.writeRaw(BODIES_DIR, bodyMd5, bodyBuf);
      }
    }

    const seq = String(this.addCounter++).padStart(6, '0');
    const base = `${entry.timestamp}_${seq}_${entry.id}`;

    const stored: StoredEntry = {
      ...entry,
      bodyMd5,
      response: { ...response, body: '', bodyBase64: undefined }, // body lives in .bodies/
    };
    this.storage.writeJson(dateDir, `${base}.json`, stored);

    // Prune oldest entries so the total stays within the configured limit
    this.enforceTotalLimit(maxTotal);

    return entry;
  }

  /** Record a WebSocket/Socket.IO session summary in history. */
  addWsSession(request: ApiRequest, wsSession: WsSessionSummary, maxTotal = 1000): HistoryEntry {
    const entry: HistoryEntry = {
      id: randomUUID(),
      request,
      wsSession,
      timestamp: Date.now(),
    };

    const dateKey = this.getDateKey(entry.timestamp);
    const dateDir = `${HISTORY_DIR}/${dateKey}`;

    const seq = String(this.addCounter++).padStart(6, '0');
    const base = `${entry.timestamp}_${seq}_${entry.id}`;
    this.storage.writeJson(dateDir, `${base}.json`, entry);

    this.enforceTotalLimit(maxTotal);

    return entry;
  }

  /** Record a Server-Sent Events session summary in history. */
  addSseSession(request: ApiRequest, sseSession: SseSessionSummary, maxTotal = 1000): HistoryEntry {
    const entry: HistoryEntry = {
      id: randomUUID(),
      request,
      sseSession,
      timestamp: Date.now(),
    };

    const dateKey = this.getDateKey(entry.timestamp);
    const dateDir = `${HISTORY_DIR}/${dateKey}`;

    const seq = String(this.addCounter++).padStart(6, '0');
    const base = `${entry.timestamp}_${seq}_${entry.id}`;
    this.storage.writeJson(dateDir, `${base}.json`, entry);

    this.enforceTotalLimit(maxTotal);

    return entry;
  }

  // ---------------------------------------------------------------------------
  // Read / query
  // ---------------------------------------------------------------------------

  getRecent(limit = 50): HistoryEntry[] {
    const dateDirs = this.getDateDirs('desc');
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
    return this.getDateDirs('desc').map((dir) => ({
      date: dir,
      count: this.storage.listFiles(`${HISTORY_DIR}/${dir}`).length,
    }));
  }

  // ---------------------------------------------------------------------------
  // Delete / clear
  // ---------------------------------------------------------------------------

  clear(): void {
    // Delete all date dirs and the .bodies content store
    for (const dir of this.storage.listDirs(HISTORY_DIR)) {
      this.storage.deleteDir(`${HISTORY_DIR}/${dir}`);
    }
  }

  deleteEntry(id: string): boolean {
    for (const dir of this.getDateDirs('asc')) {
      const dateDir = `${HISTORY_DIR}/${dir}`;
      const file = this.storage.listFiles(dateDir).find((f) => f.includes(id));
      if (file) {
        this.deleteEntryFile(dir, file);
        if (this.storage.listFiles(dateDir).length === 0) {
          this.storage.deleteDir(dateDir);
        }
        return true;
      }
    }
    return false;
  }

  deleteGroup(dateKey: string): boolean {
    const dateDir = `${HISTORY_DIR}/${dateKey}`;
    // Collect body refs before deleting the directory
    const md5s = this.storage
      .listFiles(dateDir)
      .map((f) => this.storage.readJson<StoredEntry>(dateDir, f)?.bodyMd5)
      .filter((m): m is string => !!m);
    const success = this.storage.deleteDir(dateDir);
    if (success) {
      for (const md5 of md5s) {
        this.maybeDeleteBodyFile(md5);
      }
    }
    return success;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Return date-directory names (YYYY-MM-DD), excluding the .bodies store.
   * @param order  'asc' = oldest first (for pruning); 'desc' = newest first (for display).
   */
  private getDateDirs(order: 'asc' | 'desc'): string[] {
    const dirs = this.storage
      .listDirs(HISTORY_DIR)
      .filter((d) => d !== '.bodies')
      .sort(); // ascending by default
    return order === 'desc' ? dirs.reverse() : dirs;
  }

  /** Remove oldest entries globally until total count ≤ maxTotal. */
  private enforceTotalLimit(maxTotal: number): void {
    const dirs = this.getDateDirs('asc'); // oldest date first
    let total = dirs.reduce(
      (sum, d) => sum + this.storage.listFiles(`${HISTORY_DIR}/${d}`).length,
      0,
    );
    if (total <= maxTotal) return;

    for (const dir of dirs) {
      if (total <= maxTotal) break;
      const dateDir = `${HISTORY_DIR}/${dir}`;
      const files = this.storage.listFiles(dateDir).sort(); // asc = oldest entry first
      for (const file of files) {
        if (total <= maxTotal) break;
        this.deleteEntryFile(dir, file);
        total--;
      }
      if (this.storage.listFiles(dateDir).length === 0) {
        this.storage.deleteDir(dateDir);
      }
    }
  }

  /** Delete a single entry JSON and release its body file if unreferenced. */
  private deleteEntryFile(dateKey: string, file: string): void {
    const dateDir = `${HISTORY_DIR}/${dateKey}`;
    const stored = this.storage.readJson<StoredEntry>(dateDir, file);
    const bodyMd5 = stored?.bodyMd5;
    this.storage.deleteFile(dateDir, file);
    if (bodyMd5) {
      this.maybeDeleteBodyFile(bodyMd5);
    }
  }

  /**
   * Delete the body file for `bodyMd5` only if no remaining entry references it.
   * Scans all entry JSON files — acceptable for the typical ceiling (≤ 10 000 entries).
   */
  private maybeDeleteBodyFile(bodyMd5: string): void {
    for (const dir of this.getDateDirs('asc')) {
      const dateDir = `${HISTORY_DIR}/${dir}`;
      for (const file of this.storage.listFiles(dateDir)) {
        const e = this.storage.readJson<StoredEntry>(dateDir, file);
        if (e?.bodyMd5 === bodyMd5) return; // still referenced
      }
    }
    this.storage.deleteFile(BODIES_DIR, bodyMd5);
  }

  private getEntriesForDate(dateKey: string): HistoryEntry[] {
    const dateDir = `${HISTORY_DIR}/${dateKey}`;
    const files = this.storage.listFiles(dateDir);
    return files
      .sort((a, b) => b.localeCompare(a)) // descending → newest first
      .map((f) => {
        const stored = this.storage.readJson<StoredEntry>(dateDir, f);
        if (!stored) return null;
        const entry: HistoryEntry = { ...stored };

        // WS session entries have no response body to load
        if (!stored.response) return entry;

        const ct = stored.response.contentType ?? '';

        if (stored.bodyMd5) {
          // New format: body in content-addressed store
          const bodyBuf = this.storage.readRaw(BODIES_DIR, stored.bodyMd5);
          if (bodyBuf) {
            if (ct && isBinaryContentType(ct)) {
              entry.response!.bodyBase64 = bodyBuf.toString('base64');
            } else {
              entry.response!.body = bodyBuf.toString('utf-8');
            }
          }
        } else {
          // Legacy format (pre-dedup): body in a per-entry .body sidecar file
          const base = f.replace('.json', '');
          const bodyBuf = this.storage.readRaw(dateDir, `${base}.body`);
          if (bodyBuf) {
            if (ct && isBinaryContentType(ct)) {
              entry.response!.bodyBase64 = bodyBuf.toString('base64');
            } else {
              entry.response!.body = bodyBuf.toString('utf-8');
            }
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

