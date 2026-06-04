import * as vscode from 'vscode';
import { HandlerContext } from './HandlerContext';
import { HttpClient } from '../services/HttpClient';
import { ScriptRunner } from '../services/ScriptRunner';
import { ApiRequest, CollectionItem, KeyValuePair, ConsoleEntry } from '../types';

interface RunOptions {
  collectionId: string;
  selectedRequestIds: string[];
  iterations: number;
  delayMs: number;
  stopOnFailure: boolean;
  persistEnvChanges: boolean;
}

interface RunState {
  cancelled: boolean;
  httpClient: HttpClient;
  currentRequestRunId: string | null;
}

export class CollectionRunnerHandler {
  private scriptRunner = new ScriptRunner();
  private activeRuns = new Map<string, RunState>();

  constructor(private ctx: HandlerContext) {}

  async run(runId: string, options: RunOptions): Promise<void> {
    const collection = this.ctx.collectionService?.getById(options.collectionId);
    if (!collection) {
      this.ctx.webview.postMessage({
        type: 'collectionRunComplete',
        runId,
        payload: { totalRequests: 0, passedTests: 0, failedTests: 0, totalTime: 0, aborted: true },
      });
      return;
    }

    const allRequests = this.flattenRequests(collection.items);
    const selectedSet = new Set(options.selectedRequestIds);
    const selectedRequests = allRequests.filter((r) => selectedSet.has(r.id));

    if (selectedRequests.length === 0) {
      this.ctx.webview.postMessage({
        type: 'collectionRunComplete',
        runId,
        payload: { totalRequests: 0, passedTests: 0, failedTests: 0, totalTime: 0, aborted: false },
      });
      return;
    }

    const httpClient = new HttpClient();
    const runState: RunState = { cancelled: false, httpClient, currentRequestRunId: null };
    this.activeRuns.set(runId, runState);

    const startTime = Date.now();
    let totalPassed = 0;
    let totalFailed = 0;
    let aborted = false;

    // Env snapshot — accumulates pm.environment.set() changes across requests
    let envVars: KeyValuePair[] = [...(this.ctx.envService?.getActiveVariables() ?? [])];
    const timeout = vscode.workspace
      .getConfiguration('api-pilot')
      .get<number>('requestTimeout', 30000);

    outer: for (let iter = 1; iter <= options.iterations; iter++) {
      for (let reqIdx = 0; reqIdx < selectedRequests.length; reqIdx++) {
        const request = selectedRequests[reqIdx];
        if (runState.cancelled) {
          aborted = true;
          break outer;
        }

        this.ctx.webview.postMessage({
          type: 'collectionRunProgress',
          runId,
          payload: {
            requestIndex: reqIdx,
            requestId: request.id,
            requestName: request.name,
            folderPath: (request as ApiRequest & { folderPath?: string }).folderPath,
            iteration: iter,
            status: 'running',
          },
        });

        const consoleEntries: ConsoleEntry[] = [];
        let envUpdates: Array<{ key: string; value: string }> = [];
        let reqToSend: ApiRequest = JSON.parse(JSON.stringify(request));

        if (reqToSend.preScript?.trim()) {
          const pre = this.scriptRunner.runPreScript(reqToSend.preScript, reqToSend, envVars, consoleEntries);
          reqToSend = pre.request;
          envUpdates = [...envUpdates, ...pre.envUpdates];
        }

        const reqRunId = `${runId}:${request.id}:${iter}`;
        runState.currentRequestRunId = reqRunId;

        try {
          const response = await httpClient.send(reqToSend, reqRunId, envVars, timeout);

          let testResults: Array<{ name: string; passed: boolean; error?: string }> = [];
          if (reqToSend.postScript?.trim()) {
            const post = this.scriptRunner.runPostScript(
              reqToSend.postScript,
              reqToSend,
              response,
              envVars,
              consoleEntries,
            );
            testResults = post.testResults;
            envUpdates = [...envUpdates, ...post.envUpdates];
          }

          // Apply env updates to the running snapshot
          for (const update of envUpdates) {
            const idx = envVars.findIndex((v) => v.key === update.key);
            if (idx >= 0) {
              envVars = envVars.map((v, i) => (i === idx ? { ...v, value: update.value } : v));
            } else {
              envVars = [...envVars, { key: update.key, value: update.value, enabled: true }];
            }
          }

          const passCount = testResults.filter((t) => t.passed).length;
          const failCount = testResults.filter((t) => !t.passed).length;
          totalPassed += passCount;
          totalFailed += failCount;

          const status: 'passed' | 'failed' = failCount > 0 ? 'failed' : 'passed';
          this.ctx.webview.postMessage({
            type: 'collectionRunProgress',
            runId,
            payload: {
              requestIndex: reqIdx,
              requestId: request.id,
              requestName: request.name,
              folderPath: (request as ApiRequest & { folderPath?: string }).folderPath,
              iteration: iter,
              status,
              response: {
                status: response.status,
                statusText: response.statusText,
                time: response.time,
                bodySize: response.bodySize,
              },
              testResults,
              consoleLogs: consoleEntries.length ? consoleEntries.map((c) => ({ level: c.level, args: c.args, source: c.source })) : undefined,
            },
          });

          if (options.stopOnFailure && status === 'failed') {
            aborted = true;
            break outer;
          }
        } catch (err) {
          if (runState.cancelled) {
            aborted = true;
            break outer;
          }

          totalFailed++;
          this.ctx.webview.postMessage({
            type: 'collectionRunProgress',
            runId,
            payload: {
              requestIndex: reqIdx,
              requestId: request.id,
              requestName: request.name,
              folderPath: (request as ApiRequest & { folderPath?: string }).folderPath,
              iteration: iter,
              status: 'error',
              consoleLogs: consoleEntries.length ? consoleEntries.map((c) => ({ level: c.level, args: c.args, source: c.source })) : undefined,
              error: err instanceof Error ? err.message : String(err),
            },
          });

          if (options.stopOnFailure) {
            aborted = true;
            break outer;
          }
        } finally {
          runState.currentRequestRunId = null;
        }

        if (options.delayMs > 0 && !runState.cancelled) {
          await new Promise<void>((resolve) => setTimeout(resolve, options.delayMs));
        }
      }
    }

    this.activeRuns.delete(runId);

    // Persist env changes back to disk if requested
    if (options.persistEnvChanges) {
      const activeId = this.ctx.envService?.getActiveEnvId();
      if (activeId) {
        const activeEnv = this.ctx.envService?.getById(activeId);
        if (activeEnv) {
          // Merge updated vars into the env — update existing, add new
          const merged = [...activeEnv.variables];
          for (const updated of envVars) {
            const idx = merged.findIndex((v) => v.key === updated.key);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], value: updated.value };
            } else {
              merged.push(updated);
            }
          }
          this.ctx.envService?.update({ ...activeEnv, variables: merged });
        }
      }
    }

    // Persist env changes but don't record collection runs to history
    this.ctx.onHistoryChanged?.();

    this.ctx.webview.postMessage({
      type: 'collectionRunComplete',
      runId,
      payload: {
        totalRequests: selectedRequests.length * options.iterations,
        passedTests: totalPassed,
        failedTests: totalFailed,
        totalTime: Date.now() - startTime,
        aborted,
      },
    });
  }

  cancel(runId: string): void {
    const run = this.activeRuns.get(runId);
    if (run) {
      run.cancelled = true;
      if (run.currentRequestRunId) {
        run.httpClient.cancel(run.currentRequestRunId);
      }
    }
  }

  private flattenRequests(items: CollectionItem[], folderPath: string[] = []): Array<ApiRequest & { folderPath?: string }> {
    const result: Array<ApiRequest & { folderPath?: string }> = [];
    for (const item of items) {
      if (item.type === 'request' && item.request) {
        result.push({ ...item.request, folderPath: folderPath.length ? folderPath.join(' / ') : undefined });
      } else if (item.type === 'folder' && item.items) {
        result.push(...this.flattenRequests(item.items, [...folderPath, item.name]));
      }
    }
    return result;
  }
}
