import { create } from 'zustand';
import type { HttpMethod, KeyValuePair, RequestBody, AuthConfig, ApiResponse } from './requestStore';

export interface RequestTab {
  id: string;
  name: string;
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

interface TabState {
  tabs: RequestTab[];
  activeTabId: string;
  addTab: () => void;
  addTabWithData: (data: Partial<RequestTab>) => void;
  removeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  updateTab: (id: string, updates: Partial<RequestTab>) => void;
  getActiveTab: () => RequestTab | undefined;
}

function createDefaultTab(): RequestTab {
  const id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: 'New Request',
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
}));
