import { useTabStore } from '../../stores/tabStore';

const METHOD_COLORS: Record<string, string> = {
  GET: '#4ec9b0',
  POST: '#cca700',
  PUT: '#3794ff',
  DELETE: '#f14c4c',
  PATCH: '#c586c0',
  OPTIONS: '#888',
  HEAD: '#888',
};

export function TabBar() {
  const { tabs, activeTabId, setActiveTabId, addTab, removeTab } = useTabStore();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--tab-inactive-bg)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flex: 1, overflow: 'auto' }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              whiteSpace: 'nowrap',
              background:
                tab.id === activeTabId
                  ? 'var(--tab-active-bg)'
                  : 'transparent',
              borderBottom:
                tab.id === activeTabId
                  ? '2px solid var(--button-bg)'
                  : '2px solid transparent',
              color:
                tab.id === activeTabId
                  ? 'var(--vscode-tab-activeForeground, #fff)'
                  : 'var(--vscode-tab-inactiveForeground, #999)',
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 10,
                color: METHOD_COLORS[tab.method] || '#888',
              }}
            >
              {tab.method}
            </span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 120,
              }}
            >
              {tab.url || tab.name}
            </span>
            {tab.isDirty && (
              <span style={{ color: 'var(--warning-fg)', fontSize: 8 }}>●</span>
            )}
            {tabs.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                style={{
                  marginLeft: 4,
                  opacity: 0.5,
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                }}
                title="Close tab"
              >
                ×
              </span>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addTab}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--panel-fg)',
          cursor: 'pointer',
          padding: '6px 10px',
          fontSize: 16,
          lineHeight: 1,
          opacity: 0.6,
          flexShrink: 0,
        }}
        title="New Request (Ctrl+T)"
      >
        +
      </button>
    </div>
  );
}
