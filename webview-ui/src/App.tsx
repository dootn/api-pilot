import { useCallback, useEffect, useRef, useState } from 'react';
import { TabBar } from './components/Layout/TabBar';
import { RequestPanel } from './components/RequestPanel/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel/ResponsePanel';
import { WsConversation } from './components/RequestPanel/WsConversation';
import { CollectionsSidebar } from './components/Sidebar/CollectionsSidebar';
import { HistorySidebar } from './components/Sidebar/HistorySidebar';
import { useVscodeMessage } from './hooks/useVscodeMessage';
import { useTabStore, type RequestTab } from './stores/tabStore';
import type { ApiResponse, WsMessage, WsStatus } from './stores/requestStore';
import { useLocaleStore } from './stores/localeStore';
import { useSettingsStore } from './stores/settingsStore';
import { useI18n } from './i18n';
import { vscode } from './vscode';

function App() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const updateTab = useTabStore((s) => s.updateTab);
  const addTabWithData = useTabStore((s) => s.addTabWithData);
  const setActiveTabId = useTabStore((s) => s.setActiveTabId);
  const restoreSession = useTabStore((s) => s.restoreSession);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const setCustomHttpMethods = useSettingsStore((s) => s.setCustomHttpMethods);
  const t = useI18n();

  // Sidebar tab: 'collections' | 'history'
  const [sidebarTab, setSidebarTab] = useState<'collections' | 'history'>('collections');
  // Sidebar width (resizable)
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const sidebarResizingRef = useRef(false);

  // Drag-to-resize state (request/response vertical split)
  const [splitPercent, setSplitPercent] = useState(50);
  const innerRef = useRef<HTMLDivElement>(null);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = innerRef.current;
    if (!container) return;
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = Math.min(Math.max(((ev.clientY - rect.top) / rect.height) * 100, 15), 85);
      setSplitPercent(pct);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const handleSidebarResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizingRef.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!sidebarResizingRef.current) return;
      setSidebarWidth(Math.min(Math.max(ev.clientX, 160), 480));
    };
    const onUp = () => {
      sidebarResizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // Signal ready to extension so it can send back saved tab state
  useEffect(() => {
    vscode.postMessage({ type: 'ready' });
  }, []);

  const handleMessage = useCallback(
    (message: { type: string; requestId?: string; payload?: unknown }) => {
      switch (message.type) {
        case 'loadRequest': {
          const raw = message.payload as Partial<RequestTab> & { _newTab?: boolean };
          const { _newTab, ...request } = raw;

          // If the imported request already exists as an open tab, switch to it
          if (request.id && request.collectionId) {
            const existingTab = tabs.find(
              (t) => t.id === request.id && t.collectionId === request.collectionId
            );
            if (existingTab) {
              setActiveTabId(existingTab.id);
              return;
            }
          }

          if (_newTab) {
            // Open in a new tab — strip id so a fresh UUID is generated
            const { id: _id, ...requestWithoutId } = request;
            addTabWithData({ ...requestWithoutId, collectionId: undefined });
          } else if (activeTabId) {
            // Fill current active tab with the imported data (no new tab)
            updateTab(activeTabId, {
              ...request,
              id: activeTabId,          // keep current tab id
              collectionId: undefined,  // break collection binding for imported requests
              isDirty: true,
            });
          } else {
            addTabWithData(request || {});
          }
          return;
        }
        case 'setLocale': {
          setLocale(message.payload as 'en' | 'zh-CN');
          return;
        }
        case 'setCustomMethods': {
          setCustomHttpMethods(message.payload as string[]);
          return;
        }
        case 'requestRenamed': {
          // Sidebar renamed a bookmark — update the matching open tab's name without dirtying it
          const { requestId, newName } = message.payload as { collectionId: string; requestId: string; newName: string };
          const target = tabs.find((t) => t.id === requestId);
          if (target) {
            updateTab(requestId, { name: newName, isCustomNamed: true, isDirty: false });
          }
          return;
        }
        case 'loadTabState': {
          const session = message.payload as {
            tabs: Omit<RequestTab, 'response' | 'responseError' | 'loading' | 'isDirty'>[];
            activeTabId: string;
          };
          if (session?.tabs?.length) {
            const tabs: RequestTab[] = session.tabs.map((t) => ({
              ...t,
              response: null,
              responseError: null,
              loading: false,
              isDirty: false,
            }));
            const activeId = tabs.find((t) => t.id === session.activeTabId)
              ? session.activeTabId
              : tabs[0].id;
            restoreSession(tabs, activeId);
          }
          return;
        }
        case 'wsStatusChanged': {
          const wsMsg = message as unknown as { tabId: string; payload: { status: WsStatus; connectionId?: string; error?: string } };
          const { status, connectionId, error } = wsMsg.payload;
          updateTab(wsMsg.tabId, {
            wsStatus: status,
            wsConnectionId: connectionId,
            loading: status === 'connecting',
            ...(status === 'disconnected' || status === 'error' ? { wsConnectedAt: undefined } : {}),
            ...(status === 'connected' ? { wsConnectedAt: Date.now() } : {}),
            ...(status === 'error' ? { responseError: error ?? 'WebSocket error' } : {}),
          });
          return;
        }
        case 'wsMessageReceived': {
          const wsMsg = message as unknown as { tabId: string; payload: WsMessage };
          const tab = tabs.find((t) => t.id === wsMsg.tabId);
          if (tab) {
            const existing = tab.wsMessages ?? [];
            updateTab(wsMsg.tabId, { wsMessages: [...existing, wsMsg.payload] });
          }
          return;
        }
      }

      const tabId = message.requestId;
      if (!tabId) return;

      switch (message.type) {
        case 'requestResult': {
          const res = message.payload as ApiResponse;
          updateTab(tabId, {
            response: res,
            sslInfo: res.sslInfo,
            responseError: null,
            loading: false,
          });
          break;
        }
        case 'requestError': {
          const errPayload = message.payload as { message: string; sslInfo?: import('./stores/requestStore').SSLInfo };
          updateTab(tabId, {
            responseError: errPayload?.message || 'Unknown error',
            sslInfo: errPayload?.sslInfo,
            response: null,
            loading: false,
          });
          break;
        }
        case 'requestProgress':
          break;
      }
    },
    [updateTab, addTabWithData, restoreSession, tabs, activeTabId, setActiveTabId, setLocale, setCustomHttpMethods]
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isWsMode = activeTab?.protocol === 'websocket';

  useVscodeMessage(handleMessage);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--panel-bg)', flexDirection: 'row', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '0px', borderBottom: '1px solid var(--border-color)' }}>
          <button
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              background: sidebarTab === 'collections' ? 'var(--button-bg)' : 'transparent',
              color: sidebarTab === 'collections' ? 'var(--button-fg)' : 'var(--panel-fg)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: sidebarTab === 'collections' ? '600' : '400',
              borderBottom: sidebarTab === 'collections' ? '2px solid var(--accent-color)' : 'none',
            }}
            onClick={() => setSidebarTab('collections')}
          >
            {t('sidebarCollections')}
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              background: sidebarTab === 'history' ? 'var(--button-bg)' : 'transparent',
              color: sidebarTab === 'history' ? 'var(--button-fg)' : 'var(--panel-fg)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: sidebarTab === 'history' ? '600' : '400',
              borderBottom: sidebarTab === 'history' ? '2px solid var(--accent-color)' : 'none',
            }}
            onClick={() => setSidebarTab('history')}
          >
            {t('sidebarHistory')}
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {sidebarTab === 'collections' ? <CollectionsSidebar /> : <HistorySidebar />}
        </div>
        {/* Branding watermark */}
        <div style={{
          padding: '6px 0',
          textAlign: 'center',
          fontSize: '10px',
          opacity: 0.22,
          color: 'var(--panel-fg)',
          userSelect: 'none',
          letterSpacing: '0.1em',
          fontWeight: 600,
          pointerEvents: 'none',
          borderTop: '1px solid var(--border-color)',
        }}>
          API PILOT v{typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.0.0'}
        </div>
      </div>

      {/* Sidebar resize handle */}
      <div
        style={{
          width: 4,
          cursor: 'col-resize',
          background: 'var(--border-color)',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseDown={handleSidebarResizerMouseDown}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-color)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--border-color)')}
      />

      {/* Main editor area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TabBar />
        <div
          ref={innerRef}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <div style={{ height: `${splitPercent}%`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <RequestPanel />
          </div>
          <div
            style={{
              height: 5,
              cursor: 'row-resize',
              background: 'var(--border-color)',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseDown={handleDividerMouseDown}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--button-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--border-color)')}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {isWsMode ? <WsConversation /> : <ResponsePanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
