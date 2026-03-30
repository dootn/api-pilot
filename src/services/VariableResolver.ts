import { KeyValuePair } from '../types';

const VARIABLE_PATTERN = /\{\{(.+?)\}\}/g;
const MAX_RESOLVE_DEPTH = 5;

export class VariableResolver {
  /**
   * Resolve all {{variable}} references in a string.
   * Variables are resolved from the provided variable map.
   * Supports nested references up to MAX_RESOLVE_DEPTH levels.
   */
  resolve(input: string, variables: KeyValuePair[]): string {
    return this.resolveRecursive(input, variables, 0);
  }

  /**
   * Resolve variables in all string fields of a request-like object.
   */
  resolveObject<T>(obj: T, variables: KeyValuePair[]): T {
    if (!variables.length) return obj;
    const json = JSON.stringify(obj);
    const resolved = this.resolve(json, variables);
    try {
      return JSON.parse(resolved) as T;
    } catch {
      return obj;
    }
  }

  private resolveRecursive(input: string, variables: KeyValuePair[], depth: number): string {
    if (depth >= MAX_RESOLVE_DEPTH) return input;
    if (!input.includes('{{')) return input;

    const varMap = new Map<string, string>();
    for (const v of variables) {
      if (v.enabled && v.key) {
        varMap.set(v.key, v.value);
      }
    }

    const result = input.replace(VARIABLE_PATTERN, (match, varName: string) => {
      const trimmed = varName.trim();
      const value = varMap.get(trimmed);
      return value !== undefined ? value : match;
    });

    // Check if there are still unresolved variables (nested case)
    if (result !== input && VARIABLE_PATTERN.test(result)) {
      return this.resolveRecursive(result, variables, depth + 1);
    }

    return result;
  }

  /**
   * Extract all variable names from a string.
   */
  extractVariables(input: string): string[] {
    const names: string[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(VARIABLE_PATTERN);
    while ((match = re.exec(input)) !== null) {
      names.push(match[1].trim());
    }
    return [...new Set(names)];
  }
}
