import { memo } from 'react';
import type { ConsoleEntry } from '../../stores/requestStore';
import { useI18n } from '../../i18n';
import { EmptyState } from '../shared/EmptyState';

export const ConsoleTab = memo(function ConsoleTab({ entries }: { entries: ConsoleEntry[] }) {
  const t = useI18n();

  if (entries.length === 0) {
    return (
      <EmptyState icon="🖥" title={t('respNoConsole')} subtitle={t('respNoConsoleHint')} padding="60px 40px" />
    );
  }

  return (
    <div className="mono-text" style={{ padding: '4px 0', fontSize: 12 }}>
      {entries.map((entry, i) => (
        <div
          key={i}
          className="border-b"
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            padding: '3px 12px',
            background:
              entry.level === 'error' ? 'rgba(241,76,76,0.06)' :
              entry.level === 'warn'  ? 'rgba(204,167,0,0.06)' :
              'transparent',
          }}
        >
          <span
            style={{
              flexShrink: 0, fontSize: 10, marginTop: 1,
              color:
                entry.level === 'error' ? 'var(--error-fg, #f14c4c)' :
                entry.level === 'warn'  ? 'var(--warning-fg, #cca700)' :
                'var(--info-fg, #3794ff)',
            }}
          >
            {entry.level === 'error' ? '✕' : entry.level === 'warn' ? '⚠' : 'ℹ'}
          </span>
          <span style={{ opacity: 0.4, flexShrink: 0, fontSize: 10, marginTop: 1 }}>[{entry.source}]</span>
          <span style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{entry.args}</span>
        </div>
      ))}
    </div>
  );
});
