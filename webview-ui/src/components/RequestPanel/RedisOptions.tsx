import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { RedisOptions as RedisOptionsType } from '../../stores/requestStore';
import { useI18n } from '../../i18n';
import { Input, Checkbox } from '../shared/ui';

const FIELDSET: React.CSSProperties = {
  border: '1px solid var(--border-color, #555)',
  borderRadius: 4,
  padding: '8px 12px',
  margin: 0,
};
const LEGEND: React.CSSProperties = { padding: '0 6px', opacity: 0.7, fontSize: 12 };
const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '140px 1fr',
  gap: '10px 12px',
  alignItems: 'center',
};

export function RedisOptions() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
  const t = useI18n();

  if (!tab) return null;

  const opts: RedisOptionsType = tab.redisOptions ?? {};

  function update(patch: Partial<RedisOptionsType>) {
    updateTab(tab!.id, { redisOptions: { ...opts, ...patch } });
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
      <fieldset style={FIELDSET}>
        <legend style={LEGEND}>{t('redisConnectionSection')}</legend>
        <div style={GRID}>

          <label htmlFor="redis-db">{t('redisDbLabel')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input
              id="redis-db"
              type="number"
              min={0}
              max={15}
              value={opts.db ?? 0}
              onChange={(e) => update({ db: Math.max(0, Math.min(15, Number(e.target.value))) })}
              placeholder="0"
              style={{ width: 70 }}
            />
            <span style={{ fontSize: 11, opacity: 0.5 }}>0 – 15</span>
          </div>

          <label htmlFor="redis-username">{t('redisUsernameLabel')}</label>
          <Input
            id="redis-username"
            type="text"
            value={opts.username ?? ''}
            onChange={(e) => update({ username: e.target.value || undefined })}
            placeholder={t('redisUsernamePlaceholder')}
          />

          <label htmlFor="redis-password">{t('redisPasswordLabel')}</label>
          <Input
            id="redis-password"
            type="password"
            value={opts.password ?? ''}
            onChange={(e) => update({ password: e.target.value || undefined })}
            placeholder={t('redisPasswordPlaceholder')}
          />

          <label htmlFor="redis-timeout">{t('redisConnectTimeoutLabel')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input
              id="redis-timeout"
              type="number"
              min={1000}
              step={1000}
              value={opts.connectTimeout ?? 10000}
              onChange={(e) => update({ connectTimeout: Math.max(1000, Number(e.target.value)) })}
              placeholder="10000"
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 11, opacity: 0.5 }}>ms</span>
          </div>

          <label>{t('redisTlsLabel')}</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <Checkbox
              checked={opts.tls ?? false}
              onChange={(e) => update({ tls: e.target.checked })}
            />
            <span style={{ fontSize: 11, opacity: 0.6 }}>{t('redisTlsHint')}</span>
          </label>

        </div>
      </fieldset>
    </div>
  );
}
