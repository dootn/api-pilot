import { useTabStore } from '../../stores/tabStore';
import { KeyValueEditor } from '../shared/KeyValueEditor';
import { HeadersEditor } from './HeadersEditor';
import { BodyEditor } from './BodyEditor';
import { AuthEditor } from './AuthEditor';
import type { RequestTab } from '../../stores/tabStore';

type Tab = 'params' | 'headers' | 'body' | 'auth';

function getTabBadge(id: Tab, tab: RequestTab): string | number | null {
  switch (id) {
    case 'params': {
      const count = tab.params.filter((p) => p.key && p.enabled !== false).length;
      return count > 0 ? count : null;
    }
    case 'headers': {
      const count = tab.headers.filter((h) => h.key && h.enabled !== false).length;
      return count > 0 ? count : null;
    }
    case 'body':
      return tab.body.type !== 'none' ? tab.body.type : null;
    case 'auth':
      return tab.auth.type !== 'none' ? tab.auth.type : null;
    default:
      return null;
  }
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'params', label: 'Params' },
  { id: 'headers', label: 'Headers' },
  { id: 'body', label: 'Body' },
  { id: 'auth', label: 'Auth' },
];

export function RequestTabs() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return null;

  return (
    <div className="request-section">
      <div className="tabs">
        {TABS.map((t) => {
          const badge = getTabBadge(t.id, tab);
          return (
            <button
              key={t.id}
              className={`tab ${tab.activeTab === t.id ? 'active' : ''}`}
              onClick={() => updateTab(tab.id, { activeTab: t.id })}
            >
              {t.label}
              {badge !== null && (
                <span
                  style={{
                    marginLeft: 5,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 8,
                    background: tab.activeTab === t.id
                      ? 'var(--button-bg)'
                      : 'var(--badge-bg)',
                    color: tab.activeTab === t.id
                      ? 'var(--button-fg)'
                      : 'var(--badge-fg)',
                    lineHeight: '14px',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    maxWidth: 60,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="tab-content">
        {tab.activeTab === 'params' && (
          <KeyValueEditor
            items={tab.params}
            onChange={(params) => updateTab(tab.id, { params })}
            keyPlaceholder="Parameter"
            valuePlaceholder="Value"
          />
        )}

        {tab.activeTab === 'headers' && (
          <HeadersEditor
            items={tab.headers}
            onChange={(headers) => updateTab(tab.id, { headers })}
          />
        )}

        {tab.activeTab === 'body' && <BodyEditor />}

        {tab.activeTab === 'auth' && <AuthEditor />}
      </div>
    </div>
  );
}
