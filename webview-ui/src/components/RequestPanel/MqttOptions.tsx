import { useTabStore } from '../../stores/tabStore';
import type { MqttOptions } from '../../stores/requestStore';

export function MqttOptions() {
  const { getActiveTab, updateTab } = useTabStore();
  const tab = getActiveTab();
  if (!tab) return null;

  const opts: MqttOptions = tab.mqttOptions ?? {};

  function setOpts(patch: Partial<MqttOptions>) {
    updateTab(tab!.id, { mqttOptions: { ...opts, ...patch } });
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
      {/* Connection */}
      <fieldset style={{ border: '1px solid var(--border-color, #555)', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ padding: '0 6px', opacity: 0.7, fontSize: 12 }}>Connection</legend>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px', alignItems: 'center' }}>
          <label htmlFor="mqtt-client-id">Client ID</label>
          <input
            id="mqtt-client-id"
            className="url-input"
            type="text"
            placeholder="(auto-generated)"
            value={opts.clientId ?? ''}
            onChange={(e) => setOpts({ clientId: e.target.value || undefined })}
            style={{ padding: '4px 8px', fontSize: 13 }}
          />

          <label htmlFor="mqtt-keepalive">Keep Alive (s)</label>
          <input
            id="mqtt-keepalive"
            className="url-input"
            type="number"
            min={0}
            placeholder="60"
            value={opts.keepAlive ?? ''}
            onChange={(e) => setOpts({ keepAlive: e.target.value ? Number(e.target.value) : undefined })}
            style={{ padding: '4px 8px', fontSize: 13, width: 90 }}
          />

          <label>Clean Session</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={opts.cleanSession ?? true}
              onChange={(e) => setOpts({ cleanSession: e.target.checked })}
            />
            <span style={{ opacity: 0.7, fontSize: 12 }}>Start a clean session</span>
          </label>
        </div>
      </fieldset>

      {/* Credentials */}
      <fieldset style={{ border: '1px solid var(--border-color, #555)', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ padding: '0 6px', opacity: 0.7, fontSize: 12 }}>Credentials</legend>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px', alignItems: 'center' }}>
          <label htmlFor="mqtt-username">Username</label>
          <input
            id="mqtt-username"
            className="url-input"
            type="text"
            placeholder="(optional)"
            value={opts.username ?? ''}
            onChange={(e) => setOpts({ username: e.target.value || undefined })}
            style={{ padding: '4px 8px', fontSize: 13 }}
          />

          <label htmlFor="mqtt-password">Password</label>
          <input
            id="mqtt-password"
            className="url-input"
            type="password"
            placeholder="(optional)"
            value={opts.password ?? ''}
            onChange={(e) => setOpts({ password: e.target.value || undefined })}
            style={{ padding: '4px 8px', fontSize: 13 }}
          />
        </div>
      </fieldset>

      {/* Last Will */}
      <fieldset style={{ border: '1px solid var(--border-color, #555)', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ padding: '0 6px', opacity: 0.7, fontSize: 12 }}>Last Will &amp; Testament</legend>
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px', alignItems: 'center' }}>
          <label htmlFor="mqtt-lw-topic">Topic</label>
          <input
            id="mqtt-lw-topic"
            className="url-input"
            type="text"
            placeholder="e.g. clients/myClient/status"
            value={opts.lastWillTopic ?? ''}
            onChange={(e) => setOpts({ lastWillTopic: e.target.value || undefined })}
            style={{ padding: '4px 8px', fontSize: 13 }}
          />

          <label htmlFor="mqtt-lw-payload">Payload</label>
          <input
            id="mqtt-lw-payload"
            className="url-input"
            type="text"
            placeholder="e.g. offline"
            value={opts.lastWillPayload ?? ''}
            onChange={(e) => setOpts({ lastWillPayload: e.target.value || undefined })}
            style={{ padding: '4px 8px', fontSize: 13 }}
          />

          <label htmlFor="mqtt-lw-qos">QoS</label>
          <select
            id="mqtt-lw-qos"
            value={opts.lastWillQos ?? 0}
            onChange={(e) => setOpts({ lastWillQos: Number(e.target.value) as 0 | 1 | 2 })}
            style={{
              padding: '4px 8px',
              fontSize: 13,
              background: 'var(--input-bg, #3c3c3c)',
              color: 'var(--panel-fg)',
              border: '1px solid var(--border-color, #555)',
              borderRadius: 4,
              width: 120,
            }}
          >
            <option value={0}>0 — At most once</option>
            <option value={1}>1 — At least once</option>
            <option value={2}>2 — Exactly once</option>
          </select>

          <label>Retain</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={opts.lastWillRetain ?? false}
              onChange={(e) => setOpts({ lastWillRetain: e.target.checked })}
            />
            <span style={{ opacity: 0.7, fontSize: 12 }}>Retain last will message</span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}
