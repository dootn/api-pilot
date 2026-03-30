import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageHandler } from '../MessageHandler';
import { CollectionService } from '../../services/CollectionService';
import { EnvService } from '../../services/EnvService';
import { HistoryService } from '../../services/HistoryService';
import { StorageService } from '../../services/StorageService';
import * as fs from 'fs';
import * as path from 'path';
import { workspace } from 'vscode';

// Create a mock webview
function createMockWebview() {
  return {
    postMessage: vi.fn().mockResolvedValue(true),
    onDidReceiveMessage: vi.fn(),
    html: '',
    options: {},
    cspSource: '',
    asWebviewUri: vi.fn(),
  } as any;
}

describe('MessageHandler', () => {
  const uniqueDir = `/tmp/test-msghandler-${process.pid}`;
  const testBasePath = path.join(uniqueDir, '.api-pilot');
  let webview: ReturnType<typeof createMockWebview>;
  let storage: StorageService;
  let collectionService: CollectionService;
  let envService: EnvService;
  let historyService: HistoryService;
  let handler: MessageHandler;

  beforeEach(() => {
    (workspace.workspaceFolders as any)[0].uri.fsPath = uniqueDir;
    if (fs.existsSync(uniqueDir)) fs.rmSync(uniqueDir, { recursive: true });
    fs.mkdirSync(uniqueDir, { recursive: true });
    webview = createMockWebview();
    storage = new StorageService();
    collectionService = new CollectionService(storage);
    envService = new EnvService(storage);
    historyService = new HistoryService(storage);
    handler = new MessageHandler(webview, collectionService, envService, historyService);
  });

  afterEach(() => {
    if (fs.existsSync(uniqueDir)) fs.rmSync(uniqueDir, { recursive: true });
  });

  describe('handle', () => {
    it('should handle ready message without error', async () => {
      await expect(handler.handle({ type: 'ready' })).resolves.toBeUndefined();
    });

    it('should handle unknown message type gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await handler.handle({ type: 'unknownType' });
      expect(consoleSpy).toHaveBeenCalledWith('Unknown message type: unknownType');
      consoleSpy.mockRestore();
    });

    it('should handle getCollections message', async () => {
      collectionService.create('Test Col');
      await handler.handle({ type: 'getCollections' });
      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'collections',
        payload: expect.arrayContaining([
          expect.objectContaining({ name: 'Test Col' }),
        ]),
      });
    });

    it('should handle getEnvironments message', async () => {
      envService.create('Prod');
      envService.create('Dev');
      await handler.handle({ type: 'getEnvironments' });
      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'environments',
        payload: expect.objectContaining({
          environments: expect.arrayContaining([
            expect.objectContaining({ name: 'Dev' }),
            expect.objectContaining({ name: 'Prod' }),
          ]),
        }),
      });
    });

    it('should handle setActiveEnv message', async () => {
      const env = envService.create('Test');
      await handler.handle({ type: 'setActiveEnv', payload: env.id });
      expect(envService.getActiveEnvId()).toBe(env.id);
      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'activeEnvChanged',
        payload: { activeEnvId: env.id },
      });
    });

    it('should handle cancelRequest message', async () => {
      // Should not throw even with no active request
      await expect(
        handler.handle({ type: 'cancelRequest', requestId: 'some-id' })
      ).resolves.toBeUndefined();
    });

    it('should handle saveToCollection message', async () => {
      const col = collectionService.create('SaveHere');
      await handler.handle({
        type: 'saveToCollection',
        payload: {
          collectionId: col.id,
          request: {
            id: 'r1',
            name: 'Saved',
            method: 'GET',
            url: 'https://test.com',
            params: [],
            headers: [],
            body: { type: 'none' },
            auth: { type: 'none' },
            createdAt: 0,
            updatedAt: 0,
          },
        },
      });
      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'saveResult',
        payload: { success: true },
      });
    });

    it('should handle getCollections with no service gracefully', async () => {
      const minimalHandler = new MessageHandler(webview);
      await minimalHandler.handle({ type: 'getCollections' });
      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'collections',
        payload: [],
      });
    });

    it('should handle getEnvironments with no service gracefully', async () => {
      const minimalHandler = new MessageHandler(webview);
      await minimalHandler.handle({ type: 'getEnvironments' });
      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'environments',
        payload: [],
      });
    });
  });

  describe('dispose', () => {
    it('should dispose without error', () => {
      expect(() => handler.dispose()).not.toThrow();
    });
  });
});
