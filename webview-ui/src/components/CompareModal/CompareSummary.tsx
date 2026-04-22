import { useI18n } from '../../i18n';
import type { ApiResponse } from '../../stores/requestStore';

interface Props {
  leftResponse: ApiResponse | null;
  rightResponse: ApiResponse | null;
}

const ROW_STYLE: React.CSSProperties = {
  display: 'contents',
};

export function CompareSummary({ leftResponse, rightResponse }: Props) {
  const t = useI18n();

  function formatSize(bytes: number | undefined): string {
    if (bytes === undefined) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatTime(ms: number | undefined): string {
    if (ms === undefined) return '—';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  const rows: Array<{ label: string; left: string; right: string }> = [
    {
      label: t('compareStatus'),
      left: leftResponse ? String(leftResponse.status) : '—',
      right: rightResponse ? String(rightResponse.status) : '—',
    },
    {
      label: t('compareTime'),
      left: formatTime(leftResponse?.time),
      right: formatTime(rightResponse?.time),
    },
    {
      label: t('compareSize'),
      left: formatSize(leftResponse?.bodySize),
      right: formatSize(rightResponse?.bodySize),
    },
  ];

  const GRID: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '120px 1fr 1fr',
    gap: 0,
    fontSize: 13,
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    overflow: 'hidden',
  };

  const CELL: React.CSSProperties = {
    padding: '10px 14px',
    borderBottom: '1px solid var(--border-color)',
  };

  const LABEL_CELL: React.CSSProperties = {
    ...CELL,
    fontWeight: 600,
    opacity: 0.7,
    background: 'var(--vscode-sideBarSectionHeader-background, rgba(0,0,0,0.1))',
    fontSize: 12,
  };

  const DIFF_BG = 'rgba(255,200,0,0.12)';

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={GRID}>
        {/* Header row */}
        <div style={{ ...LABEL_CELL, fontWeight: 700, opacity: 1 }} />
        <div style={{ ...LABEL_CELL, textAlign: 'center', fontWeight: 700, opacity: 1 }}>{t('compareLeft')}</div>
        <div style={{ ...LABEL_CELL, textAlign: 'center', fontWeight: 700, opacity: 1 }}>{t('compareRight')}</div>
        {rows.map((row) => {
          const isDiff = row.left !== row.right;
          const bg = isDiff ? DIFF_BG : undefined;
          return (
            <div key={row.label} style={ROW_STYLE}>
              <div style={{ ...LABEL_CELL, background: bg ?? LABEL_CELL.background }}>{row.label}</div>
              <div style={{ ...CELL, textAlign: 'center', background: bg }}>
                <span style={{ fontWeight: isDiff ? 700 : 400 }}>{row.left}</span>
              </div>
              <div style={{ ...CELL, textAlign: 'center', background: bg }}>
                <span style={{ fontWeight: isDiff ? 700 : 400 }}>{row.right}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
