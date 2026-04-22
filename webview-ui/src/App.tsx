import { useCallback, useEffect, useRef, useState } from 'react';
import { TabBar } from './components/Layout/TabBar';
import { RequestPanel } from './components/RequestPanel/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel/ResponsePanel';
import { WsConversation } from './components/RequestPanel/WsConversation';
import { SseConversation } from './components/RequestPanel/SseConversation';
import { MqttPanel } from './components/RequestPanel/MqttPanel';
import { GrpcPanel } from './components/RequestPanel/GrpcPanel';
import { CollectionsSidebar } from './components/Sidebar/CollectionsSidebar';
import { HistorySidebar } from './components/Sidebar/HistorySidebar';
import { CompareModal } from './components/CompareModal';
import { useVscodeMessage } from './hooks/useVscodeMessage';
import { useProtocolMode } from './hooks/useProtocolMode';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useTabStore, useActiveTab } from './stores/tabStore';
import { useI18n } from './i18n';
import { vscode } from './vscode';

function App() {
  const t = useI18n();

  // Compare modal
  const compareTabId = useTabStore((s) => s.compareTabId);
  const setCompareTabId = useTabStore((s) => s.setCompareTabId);

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

  const handleMessage = useMessageHandler();

  const activeTab = useActiveTab();
  const { isWs, isSse, isMqtt, isGrpc } = useProtocolMode(activeTab?.protocol);

  useVscodeMessage(handleMessage);

  return (
    <>
    <div style={{ display: 'flex', height: '100vh', background: 'var(--panel-bg)', flexDirection: 'row', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)' }}>
        <div className="border-b" style={{ display: 'flex', gap: '0px' }}>
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
        <a
          href={typeof REPO_URL !== 'undefined' ? REPO_URL : '#'}
          onClick={(e) => {
            e.preventDefault();
            if (typeof REPO_URL !== 'undefined') {
              window.open(REPO_URL, '_blank');
            }
          }}
          style={{
            padding: '6px 0',
            textAlign: 'center',
            fontSize: '10px',
            opacity: 0.22,
            color: 'var(--panel-fg)',
            userSelect: 'none',
            letterSpacing: '0.1em',
            fontWeight: 600,
            borderTop: '1px solid var(--border-color)',
            textDecoration: 'none',
            display: 'block',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.5')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.22')}
        >
          API PILOT v{typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.0.0'}
        </a>
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
            {isWs ? <WsConversation /> : isSse ? <SseConversation /> : isMqtt ? <MqttPanel /> : isGrpc ? <GrpcPanel /> : <ResponsePanel />}
          </div>
        </div>
      </div>
    </div>
    {compareTabId && (
      <CompareModal initialTabId={compareTabId} onClose={() => setCompareTabId(null)} />
    )}
    </>
  );
}

export default App;
