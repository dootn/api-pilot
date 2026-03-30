import { describe, it, expect } from 'vitest';
import { parseCurl } from '../CurlParser';

describe('CurlParser', () => {
  describe('basic parsing', () => {
    it('should parse a simple GET request', () => {
      const result = parseCurl('curl https://api.example.com/users');
      expect(result.method).toBe('GET');
      expect(result.url).toBe('https://api.example.com/users');
    });

    it('should parse URL without curl prefix', () => {
      const result = parseCurl('https://api.example.com/users');
      expect(result.url).toBe('https://api.example.com/users');
    });

    it('should be case-insensitive for curl keyword', () => {
      const result = parseCurl('CURL https://api.example.com');
      expect(result.url).toBe('https://api.example.com');
    });
  });

  describe('method parsing (-X)', () => {
    it('should parse explicit GET method', () => {
      const result = parseCurl('curl -X GET https://api.example.com');
      expect(result.method).toBe('GET');
    });

    it('should parse POST method', () => {
      const result = parseCurl('curl -X POST https://api.example.com');
      expect(result.method).toBe('POST');
    });

    it('should parse PUT method', () => {
      const result = parseCurl('curl -X PUT https://api.example.com');
      expect(result.method).toBe('PUT');
    });

    it('should parse DELETE method', () => {
      const result = parseCurl('curl -X DELETE https://api.example.com');
      expect(result.method).toBe('DELETE');
    });

    it('should parse PATCH method', () => {
      const result = parseCurl('curl -X PATCH https://api.example.com');
      expect(result.method).toBe('PATCH');
    });

    it('should parse --request long form', () => {
      const result = parseCurl('curl --request POST https://api.example.com');
      expect(result.method).toBe('POST');
    });

    it('should uppercase method names', () => {
      const result = parseCurl('curl -X post https://api.example.com');
      expect(result.method).toBe('POST');
    });
  });

  describe('header parsing (-H)', () => {
    it('should parse a single header', () => {
      const result = parseCurl(
        "curl -H 'Content-Type: application/json' https://api.example.com"
      );
      expect(result.headers).toContainEqual({
        key: 'Content-Type',
        value: 'application/json',
        enabled: true,
      });
    });

    it('should parse multiple headers', () => {
      const result = parseCurl(
        "curl -H 'Content-Type: application/json' -H 'Authorization: Bearer token123' https://api.example.com"
      );
      expect(result.headers).toHaveLength(2);
      expect(result.headers[0].key).toBe('Content-Type');
      expect(result.headers[1].key).toBe('Authorization');
    });

    it('should parse --header long form', () => {
      const result = parseCurl(
        "curl --header 'Accept: text/html' https://api.example.com"
      );
      expect(result.headers).toContainEqual({
        key: 'Accept',
        value: 'text/html',
        enabled: true,
      });
    });

    it('should handle header values containing colons', () => {
      const result = parseCurl(
        "curl -H 'Authorization: Basic dXNlcjpwYXNz' https://api.example.com"
      );
      expect(result.headers[0].value).toBe('Basic dXNlcjpwYXNz');
    });
  });

  describe('data/body parsing (-d)', () => {
    it('should parse JSON body with -d', () => {
      const result = parseCurl(
        `curl -X POST -H 'Content-Type: application/json' -d '{"name":"test"}' https://api.example.com`
      );
      expect(result.body.type).toBe('json');
      expect(result.body.raw).toBe('{"name":"test"}');
    });

    it('should auto-detect JSON body without Content-Type header', () => {
      const result = parseCurl(
        `curl -X POST -d '{"name":"test"}' https://api.example.com`
      );
      expect(result.body.type).toBe('json');
    });

    it('should parse form-urlencoded body', () => {
      const result = parseCurl(
        `curl -X POST -H 'Content-Type: application/x-www-form-urlencoded' -d 'name=test&age=25' https://api.example.com`
      );
      expect(result.body.type).toBe('x-www-form-urlencoded');
      expect(result.body.urlEncoded).toContainEqual({
        key: 'name',
        value: 'test',
        enabled: true,
      });
    });

    it('should parse --data-raw', () => {
      const result = parseCurl(
        `curl --data-raw '{"key":"value"}' https://api.example.com`
      );
      expect(result.body.raw).toBe('{"key":"value"}');
    });

    it('should auto-set method to POST when body present and method is GET', () => {
      const result = parseCurl(
        `curl -d '{"name":"test"}' https://api.example.com`
      );
      expect(result.method).toBe('POST');
    });

    it('should parse raw data without JSON content', () => {
      const result = parseCurl(
        `curl -X POST -d 'plain text data' https://api.example.com`
      );
      expect(result.body.type).toBe('raw');
      expect(result.body.raw).toBe('plain text data');
    });
  });

  describe('auth parsing (-u)', () => {
    it('should parse basic auth with -u', () => {
      const result = parseCurl('curl -u user:pass123 https://api.example.com');
      expect(result.auth).toEqual({
        type: 'basic',
        username: 'user',
        password: 'pass123',
      });
    });

    it('should parse --user long form', () => {
      const result = parseCurl('curl --user admin:secret https://api.example.com');
      expect(result.auth).toEqual({
        type: 'basic',
        username: 'admin',
        password: 'secret',
      });
    });

    it('should handle password with colons', () => {
      const result = parseCurl('curl -u user:pass:with:colons https://api.example.com');
      expect(result.auth).toEqual({
        type: 'basic',
        username: 'user',
        password: 'pass:with:colons',
      });
    });
  });

  describe('query param extraction', () => {
    it('should extract query params from URL', () => {
      const result = parseCurl('curl https://api.example.com/search?q=test&page=1');
      expect(result.params).toContainEqual({ key: 'q', value: 'test', enabled: true });
      expect(result.params).toContainEqual({ key: 'page', value: '1', enabled: true });
      expect(result.url).toBe('https://api.example.com/search');
    });
  });

  describe('common flags (should be ignored)', () => {
    it('should ignore --compressed flag', () => {
      const result = parseCurl('curl --compressed https://api.example.com');
      expect(result.url).toBe('https://api.example.com');
      expect(result.method).toBe('GET');
    });

    it('should ignore -s/--silent flag', () => {
      const result = parseCurl('curl -s https://api.example.com');
      expect(result.url).toBe('https://api.example.com');
    });

    it('should ignore -k/--insecure flag', () => {
      const result = parseCurl('curl -k https://api.example.com');
      expect(result.url).toBe('https://api.example.com');
    });

    it('should ignore -L/--location flag', () => {
      const result = parseCurl('curl -L https://api.example.com');
      expect(result.url).toBe('https://api.example.com');
    });
  });

  describe('line continuation', () => {
    it('should handle backslash line continuations', () => {
      const result = parseCurl(`curl \\\n  -X POST \\\n  https://api.example.com`);
      expect(result.method).toBe('POST');
      expect(result.url).toBe('https://api.example.com');
    });
  });

  describe('complex commands', () => {
    it('should parse a full complex curl command', () => {
      const curl = `curl -X POST \\
  'https://api.example.com/users' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer mytoken' \\
  -d '{"name":"John","email":"john@example.com"}'`;

      const result = parseCurl(curl);
      expect(result.method).toBe('POST');
      expect(result.url).toBe('https://api.example.com/users');
      expect(result.headers).toHaveLength(2);
      expect(result.body.type).toBe('json');
      expect(result.body.raw).toContain('John');
    });
  });
});
