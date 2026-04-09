import { useMemo, useState } from 'react';
import { useTabStore } from '../../stores/tabStore';
import { KeyValueEditor } from '../shared/KeyValueEditor';
import { HeadersEditor } from './HeadersEditor';
import { BodyEditor } from './BodyEditor';
import { AuthEditor } from './AuthEditor';
import { ScriptEditor } from './ScriptEditor';
import { CodeModal } from './CodeModal';
import { MqttOptions } from './MqttOptions';
import { useEnvironments } from '../../hooks/useEnvironments';
import { useI18n, type TranslationKey } from '../../i18n';
import type { RequestTab } from '../../stores/tabStore';

type Tab = 'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'mqtt-options';

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
    case 'scripts':
      return (tab.preScript?.trim() || tab.postScript?.trim()) ? '●' : null;
    case 'mqtt-options': {
      const opts = tab.mqttOptions;
      if (!opts) return null;
      const keys = ['clientId', 'username', 'lastWillTopic'] as const;
      return keys.some((k) => opts[k]) ? '●' : null;
    }
    default:
      return null;
  }
}

const TAB_DEFS: { id: Tab; key: TranslationKey; label?: string }[] = [
  { id: 'params',  key: 'tabParams'  },
  { id: 'headers', key: 'tabHeaders' },
  { id: 'body',    key: 'tabBody'    },
  { id: 'auth',    key: 'tabAuth'    },
  { id: 'scripts', key: 'tabScripts' },
  { id: 'mqtt-options', key: 'tabParams', label: 'Options' },
];

export function RequestTabs() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);
  const { environments, activeEnvId } = useEnvironments();
  const t = useI18n();
  const [showCodeModal, setShowCodeModal] = useState(false);

  const knownVarNames = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId);
    const vars = (env?.variables ?? []).filter((v) => v.enabled).map((v) => v.key);
    return new Set(vars);
  }, [environments, activeEnvId]);

  const varValues = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId);
    const vars = (env?.variables ?? []).filter((v) => v.enabled);
    return new Map(vars.map((v) => [v.key, v.value]));
  }, [environments, activeEnvId]);

  if (!tab) return null;

  const isWsMode = tab.protocol === 'websocket';
  const isSseMode = tab.protocol === 'sse';
  const isMqttMode = tab.protocol === 'mqtt';

  // In WS mode, filter out the body tab; in SSE/MQTT mode, filter out body and scripts
  // In MQTT mode also show the mqtt-options tab; in non-MQTT modes hide it
  const visibleTabs = TAB_DEFS
    .filter((def) => !(isWsMode && def.id === 'body'))
    .filter((def) => !((isSseMode || isMqttMode) && (def.id === 'body' || def.id === 'scripts')))
    .filter((def) => !(def.id === 'mqtt-options' && !isMqttMode));

  return (
    <div className="request-section">
      <div className="tabs">
        {visibleTabs.map((def) => {
          const badge = getTabBadge(def.id, tab);
          return (
            <button
              key={def.id}
              className={`tab ${tab.activeTab === def.id ? 'active' : ''}`}
              onClick={() => updateTab(tab.id, { activeTab: def.id })}
            >
              {def.label ?? t(def.key)}
              {badge !== null && (
                <span
                  style={{
                    marginLeft: 5,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 8,
                    background: tab.activeTab === def.id
                      ? 'var(--button-bg)'
                      : 'var(--badge-bg)',
                    color: tab.activeTab === def.id
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

        {/* Code snippet button — placed after the last tab */}
        <button
          className="tab"
          onClick={() => setShowCodeModal(true)}
          style={{ marginLeft: 'auto', opacity: 0.75 }}
          title={t('viewCodeSnippet')}
        >
          ⟨/⟩ Code
        </button>
      </div>

      <div className="tab-content">
        {tab.activeTab === 'params' && (
          <KeyValueEditor
            items={tab.params}
            onChange={(params) => updateTab(tab.id, { params })}
            keyPlaceholder="Parameter"
            valuePlaceholder="Value"
            knownVarNames={knownVarNames}
            varValues={varValues}
          />
        )}

        {tab.activeTab === 'headers' && (
          <HeadersEditor
            items={tab.headers}
            onChange={(headers) => updateTab(tab.id, { headers })}
            knownVarNames={knownVarNames}
            varValues={varValues}
          />
        )}

        {tab.activeTab === 'body' && !isWsMode && <BodyEditor />}

        {tab.activeTab === 'auth' && <AuthEditor />}

        {tab.activeTab === 'scripts' && <ScriptEditor />}

        {tab.activeTab === 'mqtt-options' && isMqttMode && <MqttOptions />}
      </div>

      {showCodeModal && tab && (
        <CodeModal tab={tab} onClose={() => setShowCodeModal(false)} />
      )}
    </div>
  );
}
