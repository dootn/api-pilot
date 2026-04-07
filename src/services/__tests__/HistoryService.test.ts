import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { HistoryService } from '../HistoryService';
import { StorageService } from '../StorageService';
import { ApiRequest, ApiResponse } from '../../types';
import { workspace } from 'vscode';

function makeRequest(method = 'GET', url = 'https://api.example.com'): ApiRequest {
  return {
    id: 'req-1',
    name: `${method} ${url}`,
    method: method as ApiRequest['method'],
    url,
    params: [],
    headers: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeResponse(status = 200): ApiResponse {
  return {
    status,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"result": "ok"}',
    bodySize: 16,
    time: 150,
  };
}

describe('HistoryService', () => {
  const uniqueDir = `/tmp/test-history-${process.pid}`;
  const testBasePath = path.join(uniqueDir, '.api-pilot');
  let storage: StorageService;
  let service: HistoryService;

  beforeEach(() => {
    (workspace.workspaceFolders as any)[0].uri.fsPath = uniqueDir;
    if (fs.existsSync(uniqueDir)) fs.rmSync(uniqueDir, { recursive: true });
    fs.mkdirSync(uniqueDir, { recursive: true });
    storage = new StorageService();
    service = new HistoryService(storage);
  });

  afterEach(() => {
    if (fs.existsSync(uniqueDir)) fs.rmSync(uniqueDir, { recursive: true });
  });

  describe('add', () => {
    it('should add a history entry', () => {
      const entry = service.add(makeRequest(), makeResponse());
      expect(entry.id).toBeDefined();
      expect(entry.request.method).toBe('GET');
      expect(entry.response!.status).toBe(200);
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it('should return the entry in getRecent', () => {
      service.add(makeRequest('GET', 'https://a.com'), makeResponse());
      service.add(makeRequest('POST', 'https://b.com'), makeResponse(201));

      const recent = service.getRecent();
      expect(recent.length).toBeGreaterThanOrEqual(2);
      // Most recent first
      expect(recent[0].request.url).toBe('https://b.com');
      expect(recent[1].request.url).toBe('https://a.com');
    });
  });

  describe('getRecent', () => {
    it('should return empty array when no history', () => {
      expect(service.getRecent()).toEqual([]);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        service.add(makeRequest('GET', `https://api.com/${i}`), makeResponse());
      }
      const recent = service.getRecent(3);
      expect(recent).toHaveLength(3);
    });
  });

  describe('getDateGroups', () => {
    it('should return date groups with counts', () => {
      service.add(makeRequest(), makeResponse());
      service.add(makeRequest(), makeResponse());

      const groups = service.getDateGroups();
      expect(groups.length).toBeGreaterThanOrEqual(1);
      expect(groups[0].count).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no history', () => {
      expect(service.getDateGroups()).toEqual([]);
    });
  });

  describe('getByDate', () => {
    it('should return entries for a specific date', () => {
      service.add(makeRequest(), makeResponse());
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const entries = service.getByDate(dateKey);
      expect(entries.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for a date with no history', () => {
      expect(service.getByDate('1999-01-01')).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      service.add(makeRequest(), makeResponse());
      service.add(makeRequest(), makeResponse());
      service.clear();
      expect(service.getRecent()).toEqual([]);
      expect(service.getDateGroups()).toEqual([]);
    });
  });
});
