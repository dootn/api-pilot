import * as vm from 'vm';
import { ApiRequest, ApiResponse, ConsoleEntry, KeyValuePair, WsMessage } from '../types';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface EnvVariableUpdate {
  key: string;
  value: string;
}

/**
 * Runs pre/post scripts in a Node.js VM sandbox.
 * NOTE: vm.runInNewContext does NOT provide full security isolation.
 * This is acceptable for a local dev-tool where users write their own scripts.
 */
export class ScriptRunner {
  private readonly timeout = 3000;

  /** Run the pre-request script. Returns a (potentially modified) copy of the request and updated env vars. */
  runPreScript(
    script: string,
    request: ApiRequest,
    envVariables: KeyValuePair[],
    consoleEntries?: ConsoleEntry[],
  ): { request: ApiRequest; envUpdates: EnvVariableUpdate[] } {
    if (!script.trim()) return { request, envUpdates: [] };

    const mutableReq: ApiRequest = JSON.parse(JSON.stringify(request));
    const envUpdates: EnvVariableUpdate[] = [];
    const pm = this.buildPmContext(mutableReq, null, envVariables, [], envUpdates);

    try {
      vm.runInNewContext(
        script,
        { pm, console: this.safeConsole('pre', consoleEntries) },
        { timeout: this.timeout, filename: 'pre-request.js' },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      consoleEntries?.push({ level: 'error', args: `[ScriptError] ${msg}`, source: 'pre' });
      console.error('[ScriptRunner] pre-request error:', msg);
    }

    return { request: mutableReq, envUpdates };
  }

  /** Run post-script when a WebSocket/Socket.IO message is received. */
  runWsMessageScript(
    script: string,
    request: ApiRequest,
    wsMessage: WsMessage,
    envVariables: KeyValuePair[],
    consoleEntries?: ConsoleEntry[],
  ): { envUpdates: EnvVariableUpdate[] } {
    if (!script.trim()) return { envUpdates: [] };

    const envUpdates: EnvVariableUpdate[] = [];
    const pm = this.buildPmContext(request, null, envVariables, [], envUpdates);

    const wsMessageCtx = {
      data: wsMessage.data,
      direction: wsMessage.direction,
      type: wsMessage.type,
      event: wsMessage.event ?? null,
      size: wsMessage.size,
      timestamp: wsMessage.timestamp,
    };

    try {
      vm.runInNewContext(
        script,
        { pm: { ...pm, wsMessage: wsMessageCtx }, console: this.safeConsole('post', consoleEntries) },
        { timeout: this.timeout, filename: 'ws-post.js' },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      consoleEntries?.push({ level: 'error', args: `[ScriptError] ${msg}`, source: 'post' });
      console.error('[ScriptRunner] ws post-message error:', msg);
    }

    return { envUpdates };
  }

  /** Run the post-response script. Returns collected test results and updated env vars. */
  runPostScript(
    script: string,
    request: ApiRequest,
    response: ApiResponse,
    envVariables: KeyValuePair[],
    consoleEntries?: ConsoleEntry[],
  ): { testResults: TestResult[]; envUpdates: EnvVariableUpdate[] } {
    if (!script.trim()) return { testResults: [], envUpdates: [] };

    const testResults: TestResult[] = [];
    const envUpdates: EnvVariableUpdate[] = [];
    const pm = this.buildPmContext(request, response, envVariables, testResults, envUpdates);

    try {
      vm.runInNewContext(
        script,
        { pm, console: this.safeConsole('post', consoleEntries) },
        { timeout: this.timeout, filename: 'post-response.js' },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      consoleEntries?.push({ level: 'error', args: `[ScriptError] ${msg}`, source: 'post' });
      console.error('[ScriptRunner] post-response error:', msg);
    }

    return { testResults, envUpdates };
  }

  private buildPmContext(
    request: ApiRequest,
    response: ApiResponse | null,
    envVariables: KeyValuePair[],
    testResults: TestResult[] = [],
    envUpdates: EnvVariableUpdate[] = [],
  ) {
    const localVars: Record<string, unknown> = {};

    return {
      request: {
        url: request.url,
        method: request.method,
        headers: {
          get: (key: string) =>
            request.headers.find((h) => h.key.toLowerCase() === key.toLowerCase() && h.enabled)?.value ?? null,
          add: (header: { key: string; value: string }) => {
            const idx = request.headers.findIndex((h) => h.key.toLowerCase() === header.key.toLowerCase());
            if (idx >= 0) {
              request.headers[idx].value = header.value;
            } else {
              request.headers.push({ key: header.key, value: header.value, enabled: true });
            }
          },
          remove: (key: string) => {
            request.headers = request.headers.filter((h) => h.key.toLowerCase() !== key.toLowerCase());
          },
        },
        body: request.body,
        params: {
          get: (key: string) =>
            request.params.find((p) => p.key === key && p.enabled)?.value ?? null,
          add: (param: { key: string; value: string }) => {
            request.params.push({ key: param.key, value: param.value, enabled: true });
          },
          remove: (key: string) => {
            request.params = request.params.filter((p) => p.key !== key);
          },
        },
      },
      response: response
        ? {
            code: response.status,
            status: response.status,
            statusText: response.statusText,
            responseTime: response.time,
            size: response.bodySize,
            headers: {
              get: (key: string) =>
                response.headers[key] ??
                Object.entries(response.headers).find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1] ??
                null,
            },
            text: () => response.body,
            json: () => {
              try { return JSON.parse(response.body); } catch { return null; }
            },
            to: {
              have: {
                status: (code: number) => {
                  if (response.status !== code) {
                    throw new Error(`Expected status ${response.status} to be ${code}`);
                  }
                },
              },
            },
          }
        : null,
      environment: {
        get: (key: string) => {
          // Values set in this script execution take priority over the original env
          for (let i = envUpdates.length - 1; i >= 0; i--) {
            if (envUpdates[i].key === key) return envUpdates[i].value;
          }
          return envVariables.find((v) => v.key === key && v.enabled)?.value ?? null;
        },
        set: (key: string, value: string) => {
          envUpdates.push({ key, value: String(value) });
        },
      },
      variables: {
        get: (key: string) => localVars[key] ?? null,
        set: (key: string, value: unknown) => { localVars[key] = value; },
      },
      test: (name: string, fn: () => void | boolean) => {
        try {
          const result = fn();
          testResults.push({ name, passed: result === undefined || result !== false });
        } catch (e) {
          testResults.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) });
        }
      },
      expect: (actual: unknown) => this.buildExpect(actual),
    };
  }

  private buildExpect(actual: unknown) {
    const fail = (msg: string) => { throw new Error(msg); };
    return {
      to: {
        equal: (expected: unknown) => { if (actual !== expected) fail(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`); },
        eql: (expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`Expected deep equality`); },
        include: (value: string) => { if (typeof actual !== 'string' || !actual.includes(value)) fail(`Expected "${actual}" to include "${value}"`); },
        be: {
          ok: () => { if (!actual) fail(`Expected ${JSON.stringify(actual)} to be truthy`); },
          null: () => { if (actual !== null) fail(`Expected ${JSON.stringify(actual)} to be null`); },
          a: (type: string) => { if (typeof actual !== type) fail(`Expected typeof ${JSON.stringify(actual)} to be ${type}`); },
          below: (n: number) => { if ((actual as number) >= n) fail(`Expected ${actual} to be below ${n}`); },
          above: (n: number) => { if ((actual as number) <= n) fail(`Expected ${actual} to be above ${n}`); },
          within: (lo: number, hi: number) => { const v = actual as number; if (v < lo || v > hi) fail(`Expected ${v} to be within [${lo}, ${hi}]`); },
        },
        have: {
          property: (key: string) => { if (typeof actual !== 'object' || actual === null || !(key in actual)) fail(`Expected object to have property "${key}"`); },
          status: (code: number) => { if ((actual as { status: number })?.status !== code) fail(`Expected status to be ${code}`); },
        },
        not: {
          equal: (expected: unknown) => { if (actual === expected) fail(`Expected ${JSON.stringify(actual)} to not equal ${JSON.stringify(expected)}`); },
          be: {
            ok: () => { if (actual) fail(`Expected ${JSON.stringify(actual)} to be falsy`); },
            null: () => { if (actual === null) fail(`Expected value to not be null`); },
          },
        },
      },
    };
  }

  private safeConsole(prefix: 'pre' | 'post', entries?: ConsoleEntry[]) {
    const serialize = (...args: unknown[]) =>
      args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    return {
      log: (...args: unknown[]) => {
        const msg = serialize(...args);
        entries?.push({ level: 'log', args: msg, source: prefix });
        console.log(`[script:${prefix}]`, msg);
      },
      warn: (...args: unknown[]) => {
        const msg = serialize(...args);
        entries?.push({ level: 'warn', args: msg, source: prefix });
        console.warn(`[script:${prefix}]`, msg);
      },
      error: (...args: unknown[]) => {
        const msg = serialize(...args);
        entries?.push({ level: 'error', args: msg, source: prefix });
        console.error(`[script:${prefix}]`, msg);
      },
    };
  }
}
