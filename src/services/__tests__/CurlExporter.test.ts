import { describe, it, expect } from 'vitest';
import { exportCurl } from '../CurlExporter';
import { ApiRequest } from '../../types';

function makeRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    id: 'test-id',
    name: 'Test Request',
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

describe('CurlExporter', () => {
  describe('basic export', () => {
    it('should export a simple GET request', () => {
      const curl = exportCurl(makeRequest());
      expect(curl).toContain('curl');
      expect(curl).toContain("'https://api.example.com/users'");
      // GET is default, no -X needed
      expect(curl).not.toContain('-X');
    });

    it('should include -X for non-GET methods', () => {
      const curl = exportCurl(makeRequest({ method: 'POST' }));
      expect(curl).toContain('-X POST');
    });

    it('should include -X for PUT', () => {
      const curl = exportCurl(makeRequest({ method: 'PUT' }));
      expect(curl).toContain('-X PUT');
    });

    it('should include -X for DELETE', () => {
      const curl = exportCurl(makeRequest({ method: 'DELETE' }));
      expect(curl).toContain('-X DELETE');
    });
  });

  describe('query params', () => {
    it('should append enabled query params to URL', () => {
      const curl = exportCurl(
        makeRequest({
          params: [
            { key: 'q', value: 'test', enabled: true },
            { key: 'page', value: '1', enabled: true },
          ],
        })
      );
      expect(curl).toContain('q=test');
      expect(curl).toContain('page=1');
    });

    it('should skip disabled params', () => {
      const curl = exportCurl(
        makeRequest({
          params: [
            { key: 'q', value: 'test', enabled: true },
            { key: 'skip', value: 'me', enabled: false },
          ],
        })
      );
      expect(curl).toContain('q=test');
      expect(curl).not.toContain('skip');
    });

    it('should skip params with empty keys', () => {
      const curl = exportCurl(
        makeRequest({
          params: [{ key: '', value: 'val', enabled: true }],
        })
      );
      expect(curl).not.toContain('=val');
    });
  });

  describe('headers', () => {
    it('should include enabled headers', () => {
      const curl = exportCurl(
        makeRequest({
          headers: [
            { key: 'Content-Type', value: 'application/json', enabled: true },
            { key: 'Accept', value: 'text/html', enabled: true },
          ],
        })
      );
      expect(curl).toContain("-H 'Content-Type: application/json'");
      expect(curl).toContain("-H 'Accept: text/html'");
    });

    it('should skip disabled headers', () => {
      const curl = exportCurl(
        makeRequest({
          headers: [
            { key: 'X-Skip', value: 'yes', enabled: false },
          ],
        })
      );
      expect(curl).not.toContain('X-Skip');
    });
  });

  describe('auth', () => {
    it('should export bearer auth as Authorization header', () => {
      const curl = exportCurl(
        makeRequest({ auth: { type: 'bearer', token: 'mytoken' } })
      );
      expect(curl).toContain('Authorization: Bearer mytoken');
    });

    it('should export basic auth with -u', () => {
      const curl = exportCurl(
        makeRequest({ auth: { type: 'basic', username: 'user', password: 'pass' } })
      );
      expect(curl).toContain("-u 'user:pass'");
    });

    it('should export apikey as header when in=header', () => {
      const curl = exportCurl(
        makeRequest({
          auth: { type: 'apikey', key: 'X-Api-Key', value: 'secret', in: 'header' },
        })
      );
      expect(curl).toContain('X-Api-Key: secret');
    });
  });

  describe('body', () => {
    it('should include JSON body with Content-Type', () => {
      const curl = exportCurl(
        makeRequest({
          method: 'POST',
          body: { type: 'json', raw: '{"name":"test"}' },
        })
      );
      expect(curl).toContain("-H 'Content-Type: application/json'");
      expect(curl).toContain("-d '{\"name\":\"test\"}'");
    });

    it('should not add Content-Type if already in headers', () => {
      const curl = exportCurl(
        makeRequest({
          method: 'POST',
          headers: [
            { key: 'Content-Type', value: 'application/json; charset=utf-8', enabled: true },
          ],
          body: { type: 'json', raw: '{}' },
        })
      );
      // Should only contain one Content-Type header
      const matches = curl.match(/Content-Type/g);
      expect(matches?.length).toBe(1);
    });

    it('should include raw body', () => {
      const curl = exportCurl(
        makeRequest({
          method: 'POST',
          body: { type: 'raw', raw: 'hello world' },
        })
      );
      expect(curl).toContain("-d 'hello world'");
    });

    it('should export form-urlencoded body', () => {
      const curl = exportCurl(
        makeRequest({
          method: 'POST',
          body: {
            type: 'x-www-form-urlencoded',
            urlEncoded: [
              { key: 'name', value: 'test', enabled: true },
              { key: 'age', value: '25', enabled: true },
            ],
          },
        })
      );
      expect(curl).toContain('name=test');
      expect(curl).toContain('age=25');
    });

    it('should not include body for GET requests', () => {
      const curl = exportCurl(
        makeRequest({
          method: 'GET',
          body: { type: 'json', raw: '{"ignored":true}' },
        })
      );
      expect(curl).not.toContain('-d');
    });

    it('should not include body for HEAD requests', () => {
      const curl = exportCurl(
        makeRequest({
          method: 'HEAD',
          body: { type: 'json', raw: '{}' },
        })
      );
      expect(curl).not.toContain('-d');
    });
  });

  describe('shell escaping', () => {
    it('should escape single quotes in values', () => {
      const curl = exportCurl(
        makeRequest({
          method: 'POST',
          body: { type: 'json', raw: "{'name':'test'}" },
        })
      );
      expect(curl).toContain("\\'");
    });
  });

  describe('roundtrip', () => {
    it('should produce parseable output (basic GET)', () => {
      const original = makeRequest({
        params: [{ key: 'q', value: 'hello', enabled: true }],
      });
      const curl = exportCurl(original);
      expect(curl).toContain('curl');
      expect(curl).toContain('api.example.com');
      expect(curl).toContain('q=hello');
    });
  });
});
