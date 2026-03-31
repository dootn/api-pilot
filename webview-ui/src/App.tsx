import { useCallback, useEffect, useRef, useState } from 'react';
import { TabBar } from './components/Layout/TabBar';
import { RequestPanel } from './components/RequestPanel/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel/ResponsePanel';
import { useVscodeMessage } from './hooks/useVscodeMessage';
import { useTabStore, type RequestTab } from './stores/tabStore';
import type { ApiResponse } from './stores/requestStore';
import { vscode } from './vscode';

function App() {
  const updateTab = useTabStore((s) => s.updateTab);
  const addTabWithData = useTabStore((s) => s.addTabWithData);
  const restoreSession = useTabStore((s) => s.restoreSession);

  // Drag-to-resize state
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

  // Signal ready to extension so it can send back saved tab state
  useEffect(() => {
    vscode.postMessage({ type: 'ready' });
  }, []);

  const handleMessage = useCallback(
    (message: { type: string; requestId?: string; payload?: unknown }) => {
      switch (message.type) {
        case 'loadRequest': {
          const request = message.payload as Partial<RequestTab>;
          addTabWithData(request || {});
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
      }

      const tabId = message.requestId;
      if (!tabId) return;

      switch (message.type) {
        case 'requestResult':
          updateTab(tabId, {
            response: message.payload as ApiResponse,
            responseError: null,
            loading: false,
          });
          break;
        case 'requestError':
          updateTab(tabId, {
            responseError: (message.payload as { message: string })?.message || 'Unknown error',
            response: null,
            loading: false,
          });
          break;
        case 'requestProgress':
          break;
      }
    },
    [updateTab, addTabWithData, restoreSession]
  );

  useVscodeMessage(handleMessage);

  return (
    <div className="split-view">
      <TabBar />
      <div
        ref={innerRef}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
      >
        <div style={{ height: `${splitPercent}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <ResponsePanel />
        </div>
      </div>
    </div>
  );
}

export default App;
