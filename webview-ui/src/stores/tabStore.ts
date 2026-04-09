import { create } from 'zustand';
import type { HttpMethod, KeyValuePair, RequestBody, AuthConfig, ApiResponse, SSLInfo, Protocol, WsStatus, WsMessage, SseStatus, SseEvent, MqttStatus, MqttMessage, MqttOptions } from './requestStore';
import { vscode } from '../vscode';

export interface RequestTab {
  id: string;
  name: string;
  isCustomNamed: boolean;
  collectionId?: string;
  protocol?: Protocol;          // 'http' by default
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  activeTab: 'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'mqtt-options';
  response: ApiResponse | null;
  responseError: string | null;
  loading: boolean;
  isDirty: boolean;
  isPinned: boolean;
  preScript?: string;
  postScript?: string;
  description?: string;
  sslVerify?: boolean;
  sslInfo?: SSLInfo;
  // WebSocket runtime state
  wsStatus?: WsStatus;
  wsConnectionId?: string;
  wsMessages?: WsMessage[];
  wsConnectedAt?: number;
  // SSE runtime state
  sseStatus?: SseStatus;
  sseConnectionId?: string;
  sseEvents?: SseEvent[];
  sseConnectedAt?: number;
  // MQTT options (persisted) and runtime state
  mqttOptions?: MqttOptions;
  mqttStatus?: MqttStatus;
  mqttConnectionId?: string;
  mqttMessages?: MqttMessage[];
  mqttConnectedAt?: number;
  mqttSubscriptions?: string[];
}

type PersistedTab = Omit<RequestTab, 'response' | 'responseError' | 'loading' | 'isDirty' | 'wsStatus' | 'wsConnectionId' | 'wsMessages' | 'wsConnectedAt' | 'sseStatus' | 'sseConnectionId' | 'sseEvents' | 'sseConnectedAt' | 'mqttStatus' | 'mqttConnectionId' | 'mqttMessages' | 'mqttConnectedAt' | 'mqttSubscriptions'>;

interface TabState {
  tabs: RequestTab[];
  activeTabId: string;
  addTab: () => void;
  addTabWithData: (data: Partial<RequestTab>) => void;
  removeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  updateTab: (id: string, updates: Partial<RequestTab>) => void;
  renameTab: (id: string, name: string) => void;
  reorderTabs: (fromId: string, toId: string) => void;
  pinTab: (id: string, pinned: boolean) => void;
  duplicateTab: (id: string) => void;
  getActiveTab: () => RequestTab | undefined;
  restoreSession: (tabs: RequestTab[], activeTabId: string) => void;
}

function createDefaultTab(): RequestTab {
  const id = crypto.randomUUID();
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
    activeTab: 'params' as 'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'mqtt-options',
    response: null,
    responseError: null,
    loading: false,
    isDirty: false,
    isPinned: false,
    sslVerify: true,
  };
}

function ensureTrailingEmpty(arr: KeyValuePair[]): KeyValuePair[] {
  const filled = arr.filter((r) => r.key || r.value);
  return [...filled, { key: '', value: '', enabled: true }];
}

function stripTransient(tab: RequestTab): PersistedTab {
  const { response: _r, responseError: _re, loading: _l, isDirty: _d, wsStatus: _ws, wsConnectionId: _wci, wsMessages: _wm, wsConnectedAt: _wca, sseStatus: _ss, sseConnectionId: _sci, sseEvents: _se, sseConnectedAt: _sca, mqttStatus: _mqs, mqttConnectionId: _mqci, mqttMessages: _mqm, mqttConnectedAt: _mqca, mqttSubscriptions: _mqsubs, ...rest } = tab;
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
    if (data.name) {
      // Use the provided name (e.g. saved collection request name)
      newTab.name = data.name;
    } else if (data.url) {
      try {
        const scheme = data.protocol === 'websocket' ? 'WS' : data.protocol === 'sse' ? 'SSE' : (data.method || 'GET');
        const isWS = data.protocol === 'websocket';
        const normalizedUrl = isWS ? data.url.replace(/^wss?:\/\//, 'http://') : data.url;
        newTab.name = `${scheme} ${new URL(normalizedUrl).pathname}`;
      } catch {
        newTab.name = data.url;
      }
    } else {
      newTab.name = 'Imported Request';
    }
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
      const tab = state.tabs.find((t) => t.id === id);
      if (!tab || tab.isPinned) return state;
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
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, name, isCustomNamed: true, isDirty: true } : t)),
    }));
  },

  reorderTabs: (fromId, toId) => {
    set((state) => {
      const tabs = [...state.tabs];
      const fromIdx = tabs.findIndex((t) => t.id === fromId);
      const toIdx = tabs.findIndex((t) => t.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return state;
      // Pinned tabs cannot be dragged
      if (tabs[fromIdx].isPinned) return state;
      // Cannot drop an unpinned tab before a pinned tab
      if (tabs[toIdx].isPinned) return state;
      const [moved] = tabs.splice(fromIdx, 1);
      tabs.splice(toIdx, 0, moved);
      return { tabs };
    });
  },

  pinTab: (id, pinned) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, isPinned: pinned } : t)),
    }));
  },

  updateTab: (id, updates) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== id) return t;
        // If isDirty is explicitly provided in updates, use it; otherwise set to true
        const shouldMarkDirty = updates.isDirty !== undefined ? updates.isDirty : true;
        // Don't mark as dirty if ALL updated fields are transient runtime state
        const TRANSIENT_FIELDS = new Set(['response', 'loading', 'responseError', 'sslInfo',
          'wsStatus', 'wsConnectionId', 'wsMessages', 'wsConnectedAt',
          'sseStatus', 'sseConnectionId', 'sseEvents', 'sseConnectedAt',
          'mqttStatus', 'mqttConnectionId', 'mqttMessages', 'mqttConnectedAt', 'mqttSubscriptions']);
        const isTransientUpdate = Object.keys(updates).every((k) => TRANSIENT_FIELDS.has(k));
        return { 
          ...t, 
          ...updates, 
          isDirty: isTransientUpdate ? t.isDirty : shouldMarkDirty 
        };
      }),
    }));
  },

  duplicateTab: (id) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === id);
      if (!tab) return state;
      
      const newId = crypto.randomUUID();
      const duplicatedTab: RequestTab = {
        ...tab,
        id: newId,
        name: tab.isCustomNamed ? `${tab.name} (Copy)` : tab.name,
        // Clear response and loading state for duplicated tab
        response: null,
        responseError: null,
        loading: false,
        isDirty: false,
        isPinned: false,
        // Ensure params and headers have trailing empty rows
        params: ensureTrailingEmpty(tab.params.filter((p) => p.key || p.value)),
        headers: ensureTrailingEmpty(tab.headers.filter((h) => h.key || h.value)),
      };
      
      // Insert the duplicated tab right after the original
      const index = state.tabs.findIndex((t) => t.id === id);
      const newTabs = [...state.tabs];
      newTabs.splice(index + 1, 0, duplicatedTab);
      
      return {
        tabs: newTabs,
        activeTabId: newId, // Switch to the newly duplicated tab
      };
    });
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
