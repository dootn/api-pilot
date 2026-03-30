import { useTabStore } from '../../stores/tabStore';
import { KeyValueEditor } from '../shared/KeyValueEditor';
import { HeadersEditor } from './HeadersEditor';
import { BodyEditor } from './BodyEditor';
import { AuthEditor } from './AuthEditor';

type Tab = 'params' | 'headers' | 'body' | 'auth';

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
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab.activeTab === t.id ? 'active' : ''}`}
            onClick={() => updateTab(tab.id, { activeTab: t.id })}
          >
            {t.label}
          </button>
        ))}
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
