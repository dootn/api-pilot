import { memo } from 'react';
import type { TimingBreakdown } from '../../stores/requestStore';
import { useI18n } from '../../i18n';

interface Props {
  timing: TimingBreakdown;
  totalTime: number;
}

export const TimingTab = memo(function TimingTab({ timing, totalTime }: Props) {
  const t = useI18n();
  const { connect, ttfb, download } = timing;
  const total = connect + ttfb + download || 1;
  const phases: { label: string; time: number; color: string }[] = [
    { label: t('timingConnect'), time: connect, color: '#4fc3f7' },
    { label: t('timingTtfb'),    time: ttfb,    color: '#81c995' },
    { label: t('timingDownload'),time: download, color: '#ffb74d' },
  ];

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {phases.map(({ label, time, color }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, opacity: 0.8 }}>
            <span>{label}</span>
            <span>{time}ms ({((time / total) * 100).toFixed(1)}%)</span>
          </div>
          <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max((time / total) * 100, 0.5)}%`, height: '100%', background: color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)', fontSize: 11, opacity: 0.6 }}>
        {t('timingTotal')}: {totalTime}ms
      </div>
    </div>
  );
});
