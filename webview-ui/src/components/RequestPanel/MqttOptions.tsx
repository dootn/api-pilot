import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { MqttOptions } from '../../stores/requestStore';
import { Input, Select, Checkbox, Option } from '../shared/ui';

const FIELDSET: React.CSSProperties = { border: '1px solid var(--border-color, #555)', borderRadius: 4, padding: '8px 12px', margin: 0 };
const LEGEND: React.CSSProperties = { padding: '0 6px', opacity: 0.7, fontSize: 12 };
const GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px', alignItems: 'center' };

export function MqttOptions() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
  if (!tab) return null;

  const opts: MqttOptions = tab.mqttOptions ?? {};

  function setOpts(patch: Partial<MqttOptions>) {
    updateTab(tab!.id, { mqttOptions: { ...opts, ...patch } });
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
      {/* Connection */}
      <fieldset style={FIELDSET}>
        <legend style={LEGEND}>Connection</legend>
        <div style={GRID}>
          <label htmlFor="mqtt-client-id">Client ID</label>
          <Input
            id="mqtt-client-id"
            type="text"
            placeholder="(auto-generated)"
            value={opts.clientId ?? ''}
            onChange={(e) => setOpts({ clientId: e.target.value || undefined })}
          />

          <label htmlFor="mqtt-keepalive">Keep Alive (s)</label>
          <Input
            id="mqtt-keepalive"
            type="number"
            min={0}
            placeholder="60"
            value={opts.keepAlive ?? ''}
            onChange={(e) => setOpts({ keepAlive: e.target.value ? Number(e.target.value) : undefined })}
            style={{ width: 90 }}
          />

          <label>Clean Session</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <Checkbox
              checked={opts.cleanSession ?? true}
              onChange={(e) => setOpts({ cleanSession: e.target.checked })}
            />
            <span className="text-secondary">Start a clean session</span>
          </label>
        </div>
      </fieldset>

      {/* Credentials */}
      <fieldset style={FIELDSET}>
        <legend style={LEGEND}>Credentials</legend>
        <div style={GRID}>
          <label htmlFor="mqtt-username">Username</label>
          <Input
            id="mqtt-username"
            type="text"
            placeholder="(optional)"
            value={opts.username ?? ''}
            onChange={(e) => setOpts({ username: e.target.value || undefined })}
          />

          <label htmlFor="mqtt-password">Password</label>
          <Input
            id="mqtt-password"
            type="password"
            placeholder="(optional)"
            value={opts.password ?? ''}
            onChange={(e) => setOpts({ password: e.target.value || undefined })}
          />
        </div>
      </fieldset>

      {/* Last Will */}
      <fieldset style={FIELDSET}>
        <legend style={LEGEND}>Last Will &amp; Testament</legend>
        <div style={GRID}>
          <label htmlFor="mqtt-lw-topic">Topic</label>
          <Input
            id="mqtt-lw-topic"
            type="text"
            placeholder="e.g. clients/myClient/status"
            value={opts.lastWillTopic ?? ''}
            onChange={(e) => setOpts({ lastWillTopic: e.target.value || undefined })}
          />

          <label htmlFor="mqtt-lw-payload">Payload</label>
          <Input
            id="mqtt-lw-payload"
            type="text"
            placeholder="e.g. offline"
            value={opts.lastWillPayload ?? ''}
            onChange={(e) => setOpts({ lastWillPayload: e.target.value || undefined })}
          />

          <label htmlFor="mqtt-lw-qos">QoS</label>
          <Select
            id="mqtt-lw-qos"
            value={opts.lastWillQos ?? 0}
            onChange={(e) => setOpts({ lastWillQos: Number(e.target.value) as 0 | 1 | 2 })}
          >
            <Option value={0}>0 — At most once</Option>
            <Option value={1}>1 — At least once</Option>
            <Option value={2}>2 — Exactly once</Option>
          </Select>

          <label>Retain</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <Checkbox
              checked={opts.lastWillRetain ?? false}
              onChange={(e) => setOpts({ lastWillRetain: e.target.checked })}
            />
            <span className="text-secondary">Retain last will message</span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}
