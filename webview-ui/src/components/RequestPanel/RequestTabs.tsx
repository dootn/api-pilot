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
import { DnsOptionsTab } from './DnsOptionsTab';
import { RedisOptions } from './RedisOptions';
import { useEnvironments } from '../../hooks/useEnvironments';
import { useI18n, type TranslationKey } from '../../i18n';
import type { RequestTab } from '../../stores/tabStore';

type Tab = 'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'mqtt-options' | 'grpc-options' | 'dns-options' | 'redis-options';

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
    case 'dns-options': {
      const opts = tab.dnsOptions;
      if (!opts) return null;
      return (opts.dnsServer || opts.queryType !== 'A') ? '●' : null;
    }
    case 'redis-options': {
      const opts = tab.redisOptions;
      if (!opts) return null;
      return (opts.username || opts.password || (opts.db ?? 0) !== 0) ? '●' : null;
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
  { id: 'mqtt-options',  key: 'tabParams', label: 'Options'       },
  { id: 'grpc-options',  key: 'tabParams', label: 'Options'       },
  { id: 'dns-options',   key: 'tabParams', label: 'DNS Options'   },
  { id: 'redis-options', key: 'tabParams', label: 'Redis Options' },
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
  const isDnsMode = tab.protocol === 'dns';
  const isRedisMode = tab.protocol === 'redis';

  // Sync active request tab with the current protocol.
  // Handles both entering special modes and switching back to HTTP/WS/SSE.
  useEffect(() => {
    if (isGrpcMode) {
      if (tab.activeTab !== 'grpc-options') updateTab(tab.id, { activeTab: 'grpc-options' });
    } else if (isMqttMode) {
      if (tab.activeTab !== 'mqtt-options') updateTab(tab.id, { activeTab: 'mqtt-options' });
    } else if (isDnsMode) {
      if (tab.activeTab !== 'dns-options') updateTab(tab.id, { activeTab: 'dns-options' });
    } else if (isRedisMode) {
      if (tab.activeTab !== 'redis-options') updateTab(tab.id, { activeTab: 'redis-options' });
    } else if (['grpc-options', 'mqtt-options', 'dns-options', 'redis-options'].includes(tab.activeTab)) {
      // HTTP / WS / SSE — reset from a now-hidden protocol-specific tab
      updateTab(tab.id, { activeTab: 'params' });
    }
  }, [isGrpcMode, isMqttMode, isDnsMode, isRedisMode, tab.id, tab.activeTab, updateTab]);

  // In WS mode, filter out the body tab; in SSE/MQTT/gRPC mode, filter out body and scripts
  // Also filter out params, headers, auth in gRPC, MQTT, Redis modes (handled via options instead)
  // In MQTT mode also show the mqtt-options tab; in gRPC mode show grpc-options; hide both in other modes
  const visibleTabs = TAB_DEFS
    .filter((def) => !(isWsMode && def.id === 'body'))
    .filter((def) => !((isSseMode || isMqttMode || isGrpcMode || isDnsMode || isRedisMode) && (def.id === 'body' || def.id === 'scripts')))
    .filter((def) => !((isGrpcMode || isMqttMode || isDnsMode || isRedisMode) && (def.id === 'params' || def.id === 'headers' || def.id === 'auth')))
    .filter((def) => !(def.id === 'mqtt-options' && !isMqttMode))
    .filter((def) => !(def.id === 'grpc-options' && !isGrpcMode))
    .filter((def) => !(def.id === 'dns-options' && !isDnsMode))
    .filter((def) => !(def.id === 'redis-options' && !isRedisMode));

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
        {!isWsMode && !isSseMode && !isMqttMode && !isGrpcMode && !isDnsMode && !isRedisMode && (
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

        {tab.activeTab === 'dns-options' && isDnsMode && <DnsOptionsTab />}

        {tab.activeTab === 'redis-options' && isRedisMode && <RedisOptions />}
      </div>

      {showCodeModal && tab && (
        <CodeModal tab={tab} onClose={() => setShowCodeModal(false)} />
      )}
    </div>
  );
}
