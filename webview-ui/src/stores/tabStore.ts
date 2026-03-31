import { create } from 'zustand';
import type { HttpMethod, KeyValuePair, RequestBody, AuthConfig, ApiResponse } from './requestStore';
import { vscode } from '../vscode';

export interface RequestTab {
  id: string;
  name: string;
  isCustomNamed: boolean;
  collectionId?: string;
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  activeTab: 'params' | 'headers' | 'body' | 'auth';
  response: ApiResponse | null;
  responseError: string | null;
  loading: boolean;
  isDirty: boolean;
}

type PersistedTab = Omit<RequestTab, 'response' | 'responseError' | 'loading' | 'isDirty'>;

interface TabState {
  tabs: RequestTab[];
  activeTabId: string;
  addTab: () => void;
  addTabWithData: (data: Partial<RequestTab>) => void;
  removeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  updateTab: (id: string, updates: Partial<RequestTab>) => void;
  renameTab: (id: string, name: string) => void;
  getActiveTab: () => RequestTab | undefined;
  restoreSession: (tabs: RequestTab[], activeTabId: string) => void;
}

function createDefaultTab(): RequestTab {
  const id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: 'New Request',
    isCustomNamed: false,
    method: 'GET',
    url: '',
    params: [{ key: '', value: '', enabled: true }],
    headers: [{ key: '', value: '', enabled: true }],
    body: { type: 'none' },
    auth: { type: 'none' },
    activeTab: 'params',
    response: null,
    responseError: null,
    loading: false,
    isDirty: false,
  };
}

function ensureTrailingEmpty(arr: KeyValuePair[]): KeyValuePair[] {
  const filled = arr.filter((r) => r.key || r.value);
  return [...filled, { key: '', value: '', enabled: true }];
}

function stripTransient(tab: RequestTab): PersistedTab {
  const { response: _r, responseError: _re, loading: _l, isDirty: _d, ...rest } = tab;
  return rest;
}

const initialTab = createDefaultTab();

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  addTab: () => {
    const newTab = createDefaultTab();
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }));
  },

  addTabWithData: (data) => {
    const newTab = { ...createDefaultTab(), ...data };
    newTab.name = data.url ? `${data.method || 'GET'} ${new URL(data.url).pathname}` : (data.name || 'Imported Request');
    // Ensure editable rows in params/headers (always keep a trailing empty row)
    if (data.params !== undefined) newTab.params = ensureTrailingEmpty(data.params);
    if (data.headers !== undefined) newTab.headers = ensureTrailingEmpty(data.headers);
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }));
  },

  removeTab: (id) => {
    set((state) => {
      if (state.tabs.length <= 1) return state;
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === id) {
        const idx = state.tabs.findIndex((t) => t.id === id);
        newActiveId = newTabs[Math.min(idx, newTabs.length - 1)]?.id || newTabs[0].id;
      }
      return { tabs: newTabs, activeTabId: newActiveId };
    });
  },

  setActiveTabId: (id) => set({ activeTabId: id }),

  renameTab: (id, name) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, name, isCustomNamed: true } : t)),
    }));
  },

  updateTab: (id, updates) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, ...updates, isDirty: true } : t
      ),
    }));
  },

  getActiveTab: () => {
    const state = get();
    return state.tabs.find((t) => t.id === state.activeTabId);
  },

  restoreSession: (tabs, activeTabId) => {
    const normalized = tabs.map((t) => ({
      ...t,
      params: ensureTrailingEmpty(t.params),
      headers: ensureTrailingEmpty(t.headers),
    }));
    set({ tabs: normalized, activeTabId });
  },
}));

// Debounced persist — save to extension (written to .api-pilot/session/tabs.json)
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
useTabStore.subscribe((state) => {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    const { tabs, activeTabId } = useTabStore.getState();
    vscode.postMessage({
      type: 'saveTabState',
      payload: {
        tabs: tabs.map(stripTransient),
        activeTabId,
        savedAt: Date.now(),
      },
    });
  }, 600);
});
