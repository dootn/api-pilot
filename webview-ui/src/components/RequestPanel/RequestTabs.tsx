import { useEffect, useMemo, useState } from 'react';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import { KeyValueEditor } from '../shared/KeyValueEditor';
import { HeadersEditor } from './HeadersEditor';
import { BodyEditor } from './BodyEditor';
import { AuthEditor } from './AuthEditor';
import { ScriptEditor } from './ScriptEditor';
import { CodeModal } from './CodeModal';
import { MqttOptions } from './MqttOptions';
import { GrpcOptions } from './GrpcOptions';
import { useEnvironments } from '../../hooks/useEnvironments';
import { useI18n, type TranslationKey } from '../../i18n';
import type { RequestTab } from '../../stores/tabStore';

type Tab = 'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'mqtt-options' | 'grpc-options';

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
    case 'grpc-options': {
      const opts = tab.grpcOptions;
      if (!opts) return null;
      return (opts.serviceName || opts.protoContent) ? '●' : null;
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
  { id: 'grpc-options', key: 'tabParams', label: 'Options' },
];

export function RequestTabs() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
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
  const isGrpcMode = tab.protocol === 'grpc';

  // Auto-switch to grpc-options when entering gRPC mode with an incompatible active tab
  useEffect(() => {
    if (isGrpcMode && ['params', 'headers', 'auth', 'body', 'scripts'].includes(tab.activeTab)) {
      updateTab(tab.id, { activeTab: 'grpc-options' });
    }
  }, [isGrpcMode, tab.id, tab.activeTab, updateTab]);

  // Auto-switch to mqtt-options when entering MQTT mode with an incompatible active tab
  useEffect(() => {
    if (isMqttMode && ['params', 'headers', 'auth', 'body', 'scripts'].includes(tab.activeTab)) {
      updateTab(tab.id, { activeTab: 'mqtt-options' });
    }
  }, [isMqttMode, tab.id, tab.activeTab, updateTab]);

  // In WS mode, filter out the body tab; in SSE/MQTT/gRPC mode, filter out body and scripts
  // Also filter out params, headers, auth in gRPC and MQTT modes (handled via options instead)
  // In MQTT mode also show the mqtt-options tab; in gRPC mode show grpc-options; hide both in other modes
  const visibleTabs = TAB_DEFS
    .filter((def) => !(isWsMode && def.id === 'body'))
    .filter((def) => !((isSseMode || isMqttMode || isGrpcMode) && (def.id === 'body' || def.id === 'scripts')))
    .filter((def) => !((isGrpcMode || isMqttMode) && (def.id === 'params' || def.id === 'headers' || def.id === 'auth')))
    .filter((def) => !(def.id === 'mqtt-options' && !isMqttMode))
    .filter((def) => !(def.id === 'grpc-options' && !isGrpcMode));

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
                  className={`tab-badge${tab.activeTab === def.id ? ' tab-badge-active' : ''}`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Code snippet button — HTTP mode only */}
        {!isWsMode && !isSseMode && !isMqttMode && !isGrpcMode && (
          <button
            className="tab ml-auto"
            onClick={() => setShowCodeModal(true)}
            style={{ opacity: 0.75 }}
            title={t('viewCodeSnippet')}
          >
            ⟨/⟩ Code
          </button>
        )}
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

        {tab.activeTab === 'grpc-options' && isGrpcMode && <GrpcOptions />}
      </div>

      {showCodeModal && tab && (
        <CodeModal tab={tab} onClose={() => setShowCodeModal(false)} />
      )}
    </div>
  );
}
