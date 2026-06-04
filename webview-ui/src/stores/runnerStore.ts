import { create } from 'zustand';

export type RunEntryStatus = 'running' | 'passed' | 'failed' | 'error';

export interface RunEntry {
  key: string; // `${requestIndex}:${iteration}`
  requestIndex: number;
  requestId: string;
  requestName: string;
  folderPath?: string;
  iteration: number;
  status: RunEntryStatus;
  response?: { status: number; statusText: string; time: number; bodySize: number };
  testResults?: Array<{ name: string; passed: boolean; error?: string }>;
  consoleLogs?: Array<{ level: 'log' | 'warn' | 'error'; args: string; source: 'pre' | 'post' }>;
  error?: string;
}

export interface RunSummary {
  totalRequests: number;
  passedTests: number;
  failedTests: number;
  totalTime: number;
  aborted: boolean;
}

export interface RunnerRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  folderPath?: string;
}

export interface RunnerCollection {
  id: string;
  name: string;
  requests: RunnerRequest[];
}

interface RunnerState {
  runnerOpen: boolean;
  runnerCollection: RunnerCollection | null;
  openRunner: (collection: RunnerCollection) => void;
  closeRunner: () => void;

  currentRunId: string | null;
  isRunning: boolean;
  entries: RunEntry[];
  summary: RunSummary | null;

  startRun: (runId: string) => void;
  updateEntry: (payload: Omit<RunEntry, 'key'>) => void;
  completeRun: (summary: RunSummary) => void;
  resetRun: () => void;
}

export const useRunnerStore = create<RunnerState>((set) => ({
  runnerOpen: false,
  runnerCollection: null,
  openRunner: (collection) => set({ runnerOpen: true, runnerCollection: collection }),
  closeRunner: () => set({ runnerOpen: false }),

  currentRunId: null,
  isRunning: false,
  entries: [],
  summary: null,

  startRun: (runId) => set({ currentRunId: runId, isRunning: true, entries: [], summary: null }),  updateEntry: (payload) =>
    set((state) => {
      const key = `${payload.requestIndex}:${payload.iteration}`;
      const existingIdx = state.entries.findIndex((e) => e.key === key);
      const entry: RunEntry = { key, ...payload };
      if (existingIdx >= 0) {
        const entries = [...state.entries];
        entries[existingIdx] = entry;
        return { entries };
      }
      return { entries: [...state.entries, entry] };
    }),
  completeRun: (summary) => set({ isRunning: false, summary }),
  resetRun: () => set({ currentRunId: null, isRunning: false, entries: [], summary: null }),
}));
