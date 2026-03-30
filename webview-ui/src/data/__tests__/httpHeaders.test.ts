import { describe, it, expect } from 'vitest';
import { HTTP_HEADERS, searchHeaders, getHeaderValues } from '../../data/httpHeaders';

describe('httpHeaders data', () => {
  describe('HTTP_HEADERS', () => {
    it('should contain common headers', () => {
      const names = HTTP_HEADERS.map((h) => h.name);
      expect(names).toContain('Accept');
      expect(names).toContain('Authorization');
      expect(names).toContain('Content-Type');
      expect(names).toContain('Host');
      expect(names).toContain('User-Agent');
    });

    it('should have descriptions for all headers', () => {
      for (const header of HTTP_HEADERS) {
        expect(header.description).toBeTruthy();
        expect(header.name).toBeTruthy();
      }
    });
  });

  describe('searchHeaders', () => {
    it('should return top 10 headers when query is empty', () => {
      const results = searchHeaders('');
      expect(results).toHaveLength(10);
    });

    it('should filter by name (case-insensitive)', () => {
      const results = searchHeaders('content');
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.name.toLowerCase()).toContain('content');
      }
    });

    it('should return empty for non-matching query', () => {
      const results = searchHeaders('zzzznonexistent');
      expect(results).toHaveLength(0);
    });

    it('should limit results to 12', () => {
      const results = searchHeaders('a');
      expect(results.length).toBeLessThanOrEqual(12);
    });
  });

  describe('getHeaderValues', () => {
    it('should return common values for Content-Type', () => {
      const values = getHeaderValues('Content-Type');
      expect(values).toContain('application/json');
      expect(values).toContain('text/plain');
    });

    it('should return common values case-insensitively', () => {
      const values = getHeaderValues('content-type');
      expect(values.length).toBeGreaterThan(0);
    });

    it('should return empty array for header without common values', () => {
      const values = getHeaderValues('Content-Length');
      expect(values).toEqual([]);
    });

    it('should return empty array for unknown header', () => {
      const values = getHeaderValues('X-Unknown-Header');
      expect(values).toEqual([]);
    });
  });
});
