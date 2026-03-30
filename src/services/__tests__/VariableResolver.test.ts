import { describe, it, expect } from 'vitest';
import { VariableResolver } from '../VariableResolver';
import { KeyValuePair } from '../../types';

describe('VariableResolver', () => {
  const resolver = new VariableResolver();

  const vars: KeyValuePair[] = [
    { key: 'host', value: 'api.example.com', enabled: true },
    { key: 'port', value: '8080', enabled: true },
    { key: 'token', value: 'abc123', enabled: true },
    { key: 'disabled_var', value: 'should_not_appear', enabled: false },
    { key: '', value: 'empty_key', enabled: true },
  ];

  describe('resolve', () => {
    it('should replace a single variable', () => {
      expect(resolver.resolve('https://{{host}}/api', vars)).toBe('https://api.example.com/api');
    });

    it('should replace multiple variables in one string', () => {
      expect(resolver.resolve('https://{{host}}:{{port}}/api', vars)).toBe(
        'https://api.example.com:8080/api'
      );
    });

    it('should leave unknown variables as-is', () => {
      expect(resolver.resolve('{{unknown}}', vars)).toBe('{{unknown}}');
    });

    it('should ignore disabled variables', () => {
      expect(resolver.resolve('{{disabled_var}}', vars)).toBe('{{disabled_var}}');
    });

    it('should handle variables with whitespace in braces', () => {
      expect(resolver.resolve('{{ host }}', vars)).toBe('api.example.com');
    });

    it('should return original string when no variables present', () => {
      const input = 'no variables here';
      expect(resolver.resolve(input, vars)).toBe(input);
    });

    it('should handle empty input', () => {
      expect(resolver.resolve('', vars)).toBe('');
    });

    it('should handle empty variables array', () => {
      expect(resolver.resolve('{{host}}', [])).toBe('{{host}}');
    });

    it('should resolve nested variables (two-pass)', () => {
      const nestedVars: KeyValuePair[] = [
        { key: 'env', value: 'prod', enabled: true },
        { key: 'base_url', value: 'https://{{env}}.api.com', enabled: true },
      ];
      // First pass: {{base_url}} -> https://{{env}}.api.com
      // Second pass: {{env}} -> prod
      expect(resolver.resolve('{{base_url}}', nestedVars)).toBe('https://prod.api.com');
    });

    it('should not recurse infinitely', () => {
      const circular: KeyValuePair[] = [
        { key: 'a', value: '{{b}}', enabled: true },
        { key: 'b', value: '{{a}}', enabled: true },
      ];
      // Should eventually stop and return something without crashing
      const result = resolver.resolve('{{a}}', circular);
      expect(result).toBeDefined();
    });
  });

  describe('resolveObject', () => {
    it('should resolve variables in all string fields of an object', () => {
      const obj = {
        url: 'https://{{host}}/api',
        headers: { Authorization: 'Bearer {{token}}' },
      };
      const result = resolver.resolveObject(obj, vars);
      expect(result.url).toBe('https://api.example.com/api');
      expect(result.headers.Authorization).toBe('Bearer abc123');
    });

    it('should return original object when variables array is empty', () => {
      const obj = { url: '{{host}}' };
      expect(resolver.resolveObject(obj, [])).toEqual(obj);
    });

    it('should handle non-serializable edge cases gracefully', () => {
      const obj = { value: 'normal' };
      const result = resolver.resolveObject(obj, vars);
      expect(result.value).toBe('normal');
    });
  });

  describe('extractVariables', () => {
    it('should extract variable names from a string', () => {
      const result = resolver.extractVariables('{{host}}:{{port}}/{{path}}');
      expect(result).toEqual(['host', 'port', 'path']);
    });

    it('should return unique variable names', () => {
      const result = resolver.extractVariables('{{host}}/{{host}}');
      expect(result).toEqual(['host']);
    });

    it('should return empty array when no variables', () => {
      expect(resolver.extractVariables('no variables')).toEqual([]);
    });

    it('should trim whitespace in variable names', () => {
      const result = resolver.extractVariables('{{ host }}');
      expect(result).toEqual(['host']);
    });
  });
});
