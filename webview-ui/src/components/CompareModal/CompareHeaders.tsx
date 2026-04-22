import { useI18n } from '../../i18n';
import type { ApiResponse } from '../../stores/requestStore';

interface Props {
  leftResponse: ApiResponse | null;
  rightResponse: ApiResponse | null;
}

export function CompareHeaders({ leftResponse, rightResponse }: Props) {
  const t = useI18n();

  const leftHeaders: Record<string, string> = leftResponse?.headers ?? {};
  const rightHeaders: Record<string, string> = rightResponse?.headers ?? {};
  const allKeys = Array.from(new Set([...Object.keys(leftHeaders), ...Object.keys(rightHeaders)])).sort();

  const GRID: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 0,
    fontSize: 12,
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    overflow: 'hidden',
  };

  const CELL: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
    wordBreak: 'break-all',
  };

  const HEAD: React.CSSProperties = {
    ...CELL,
    fontWeight: 700,
    background: 'var(--vscode-sideBarSectionHeader-background, rgba(0,0,0,0.1))',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const DIFF_BG = 'rgba(255,200,0,0.12)';
  const MISSING = 'rgba(128,128,128,0.4)';

  if (allKeys.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', opacity: 0.6, fontSize: 13 }}>
        {t('compareNoResponse')}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 0', overflow: 'auto' }}>
      <div style={GRID}>
        <div style={HEAD}>{t('compareKey')}</div>
        <div style={HEAD}>{t('compareLeft')}</div>
        <div style={HEAD}>{t('compareRight')}</div>
        {allKeys.map((key) => {
          const lv = leftHeaders[key];
          const rv = rightHeaders[key];
          const isDiff = lv !== rv;
          const bg = isDiff ? DIFF_BG : undefined;
          return (
            <>
              <div key={key + '-k'} style={{ ...CELL, fontFamily: 'monospace', background: bg }}>{key}</div>
              <div key={key + '-l'} style={{ ...CELL, background: bg, color: lv === undefined ? MISSING : undefined }}>
                {lv ?? '(missing)'}
              </div>
              <div key={key + '-r'} style={{ ...CELL, background: bg, color: rv === undefined ? MISSING : undefined }}>
                {rv ?? '(missing)'}
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
}
