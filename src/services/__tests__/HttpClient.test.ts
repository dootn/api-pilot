import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from '../HttpClient';
import { ApiRequest, KeyValuePair } from '../../types';

// Mock undici
vi.mock('undici', () => ({
  request: vi.fn(),
}));

import { request as undiciRequest } from 'undici';
const mockRequest = vi.mocked(undiciRequest);

function makeRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    id: 'test-id',
    name: 'Test',
    method: 'GET',
    url: 'https://api.example.com/users',
    params: [],
    headers: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new HttpClient();

    // Default mock response
    mockRequest.mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        text: vi.fn().mockResolvedValue('{"result":"ok"}'),
      },
    } as any);
  });

  describe('send', () => {
    it('should make a GET request', async () => {
      const response = await client.send(makeRequest(), 'req-1');
      expect(response.status).toBe(200);
      expect(response.body).toBe('{"result":"ok"}');
      expect(response.time).toBeGreaterThanOrEqual(0);
      expect(response.bodySize).toBeGreaterThan(0);
    });

    it('should pass correct method and URL', async () => {
      await client.send(makeRequest({ method: 'POST' }), 'req-1');
      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should prepend http:// when missing protocol', async () => {
      await client.send(makeRequest({ url: 'example.com/api' }), 'req-1');
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('http://example.com/api'),
        expect.any(Object)
      );
    });

    it('should append query params to URL', async () => {
      await client.send(
        makeRequest({
          params: [
            { key: 'q', value: 'test', enabled: true },
            { key: 'page', value: '1', enabled: true },
          ],
        }),
        'req-1'
      );
      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=test');
      expect(calledUrl).toContain('page=1');
    });

    it('should skip disabled params', async () => {
      await client.send(
        makeRequest({
          params: [
            { key: 'q', value: 'test', enabled: true },
            { key: 'skip', value: 'me', enabled: false },
          ],
        }),
        'req-1'
      );
      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=test');
      expect(calledUrl).not.toContain('skip');
    });

    it('should set custom headers', async () => {
      await client.send(
        makeRequest({
          headers: [
            { key: 'X-Custom', value: 'test', enabled: true },
          ],
        }),
        'req-1'
      );
      const opts = mockRequest.mock.calls[0][1] as any;
      expect(opts.headers['X-Custom']).toBe('test');
    });

    it('should set Bearer auth header', async () => {
      await client.send(
        makeRequest({ auth: { type: 'bearer', token: 'my-token' } }),
        'req-1'
      );
      const opts = mockRequest.mock.calls[0][1] as any;
      expect(opts.headers['Authorization']).toBe('Bearer my-token');
    });

    it('should set Basic auth header', async () => {
      await client.send(
        makeRequest({ auth: { type: 'basic', username: 'user', password: 'pass' } }),
        'req-1'
      );
      const opts = mockRequest.mock.calls[0][1] as any;
      expect(opts.headers['Authorization']).toMatch(/^Basic /);
    });

    it('should set API Key header', async () => {
      await client.send(
        makeRequest({
          auth: { type: 'apikey', key: 'X-Api-Key', value: 'secret', in: 'header' },
        }),
        'req-1'
      );
      const opts = mockRequest.mock.calls[0][1] as any;
      expect(opts.headers['X-Api-Key']).toBe('secret');
    });

    it('should auto-set Content-Type for JSON body', async () => {
      await client.send(
        makeRequest({
          method: 'POST',
          body: { type: 'json', raw: '{}' },
        }),
        'req-1'
      );
      const opts = mockRequest.mock.calls[0][1] as any;
      expect(opts.headers['Content-Type']).toBe('application/json');
    });

    it('should keep user Content-Type over auto body Content-Type', async () => {
      await client.send(
        makeRequest({
          method: 'POST',
          headers: [
            { key: 'Content-Type', value: 'application/custom+json', enabled: true },
          ],
          body: { type: 'json', raw: '{}' },
        }),
        'req-1'
      );
      const opts = mockRequest.mock.calls[0][1] as any;
      expect(opts.headers['Content-Type']).toBe('application/custom+json');
    });

    it('should send form-urlencoded body', async () => {
      await client.send(
        makeRequest({
          method: 'POST',
          body: {
            type: 'x-www-form-urlencoded',
            urlEncoded: [
              { key: 'name', value: 'test', enabled: true },
            ],
          },
        }),
        'req-1'
      );
      const opts = mockRequest.mock.calls[0][1] as any;
      expect(opts.body).toContain('name=test');
    });

    it('should not send body for GET requests', async () => {
      await client.send(
        makeRequest({
          method: 'GET',
          body: { type: 'json', raw: '{}' },
        }),
        'req-1'
      );
      const opts = mockRequest.mock.calls[0][1] as any;
      expect(opts.body).toBeUndefined();
    });

    it('should resolve environment variables', async () => {
      const envVars: KeyValuePair[] = [
        { key: 'host', value: 'resolved.api.com', enabled: true },
      ];
      await client.send(
        makeRequest({ url: 'https://{{host}}/api' }),
        'req-1',
        envVars
      );
      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toContain('resolved.api.com');
    });

    it('should handle error responses', async () => {
      mockRequest.mockResolvedValue({
        statusCode: 404,
        headers: {},
        body: { text: vi.fn().mockResolvedValue('Not Found') },
      } as any);

      const response = await client.send(makeRequest(), 'req-1');
      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
    });

    it('should throw on network error', async () => {
      mockRequest.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(client.send(makeRequest(), 'req-1')).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('cancel', () => {
    it('should cancel an in-flight request', async () => {
      mockRequest.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('aborted')), 5000)
          ) as any
      );

      const promise = client.send(makeRequest(), 'cancel-me');
      client.cancel('cancel-me');

      // Should eventually reject or resolve
      await expect(promise).rejects.toBeDefined();
    });

    it('should do nothing for unknown requestId', () => {
      // Should not throw
      expect(() => client.cancel('unknown-id')).not.toThrow();
    });
  });
});
