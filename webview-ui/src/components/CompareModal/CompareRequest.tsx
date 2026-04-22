import { useI18n } from '../../i18n';
import type { RequestTab } from '../../stores/tabStore';
import type { KeyValuePair } from '../../stores/requestStore';

interface Props {
  leftTab: RequestTab | null;
  rightTab: RequestTab | null;
}

function parseParams(url: string): Record<string, string> {
  try {
    const u = new URL(url.startsWith('http') ? url : `http://x.com/${url}`);
    const out: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { out[k] = v; });
    return out;
  } catch {
    return {};
  }
}

function enabledEntries(pairs: KeyValuePair[]): Record<string, string> {
  return Object.fromEntries(pairs.filter((p) => p.enabled && p.key).map((p) => [p.key, p.value]));
}

export function CompareRequest({ leftTab, rightTab }: Props) {
  const t = useI18n();

  const GRID2: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 0,
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    overflow: 'hidden',
    fontSize: 13,
    marginBottom: 16,
  };

  const GRID3: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 0,
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    overflow: 'hidden',
    fontSize: 12,
    marginBottom: 16,
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

  const SECTION_LABEL: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
    marginTop: 16,
  };

  const DIFF_BG = 'rgba(255,200,0,0.12)';
  const MISSING = 'rgba(128,128,128,0.4)';

  // Method + URL
  const methodDiff = leftTab?.method !== rightTab?.method;
  const urlDiff = leftTab?.url !== rightTab?.url;

  // Query params from URL + enabled params
  const leftParams = { ...parseParams(leftTab?.url ?? ''), ...enabledEntries(leftTab?.params ?? []) };
  const rightParams = { ...parseParams(rightTab?.url ?? ''), ...enabledEntries(rightTab?.params ?? []) };
  const allParamKeys = Array.from(new Set([...Object.keys(leftParams), ...Object.keys(rightParams)])).sort();

  // Request headers
  const leftReqHeaders = enabledEntries(leftTab?.headers ?? []);
  const rightReqHeaders = enabledEntries(rightTab?.headers ?? []);
  const allHeaderKeys = Array.from(new Set([...Object.keys(leftReqHeaders), ...Object.keys(rightReqHeaders)])).sort();

  function KVTable({ allKeys, leftMap, rightMap, emptyMsg }: {
    allKeys: string[];
    leftMap: Record<string, string>;
    rightMap: Record<string, string>;
    emptyMsg: string;
  }) {
    if (allKeys.length === 0) {
      return <div style={{ opacity: 0.5, fontSize: 12, marginBottom: 16 }}>{emptyMsg}</div>;
    }
    return (
      <div style={GRID3}>
        <div style={HEAD}>{t('compareKey')}</div>
        <div style={HEAD}>{t('compareLeft')}</div>
        <div style={HEAD}>{t('compareRight')}</div>
        {allKeys.map((key) => {
          const lv = leftMap[key];
          const rv = rightMap[key];
          const isDiff = lv !== rv;
          const bg = isDiff ? DIFF_BG : undefined;
          return (
            <>
              <div key={key + '-k'} style={{ ...CELL, fontFamily: 'monospace', background: bg }}>{key}</div>
              <div key={key + '-l'} style={{ ...CELL, background: bg, color: lv === undefined ? MISSING : undefined }}>{lv ?? '(missing)'}</div>
              <div key={key + '-r'} style={{ ...CELL, background: bg, color: rv === undefined ? MISSING : undefined }}>{rv ?? '(missing)'}</div>
            </>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 0', overflow: 'auto' }}>
      {/* Method + URL */}
      <div style={SECTION_LABEL}>{t('compareMethod')} / {t('compareUrl')}</div>
      <div style={GRID2}>
        <div style={HEAD}>{t('compareLeft')}</div>
        <div style={HEAD}>{t('compareRight')}</div>
        <div style={{ ...CELL, background: methodDiff ? DIFF_BG : undefined }}>
          <span style={{ fontWeight: 700, marginRight: 8, color: 'var(--accent-color)' }}>{leftTab?.method ?? '—'}</span>
          <span style={{ opacity: 0.6, fontSize: 11 }}>{leftTab?.url || '—'}</span>
        </div>
        <div style={{ ...CELL, background: (methodDiff || urlDiff) ? DIFF_BG : undefined }}>
          <span style={{ fontWeight: 700, marginRight: 8, color: 'var(--accent-color)' }}>{rightTab?.method ?? '—'}</span>
          <span style={{ opacity: 0.6, fontSize: 11 }}>{rightTab?.url || '—'}</span>
        </div>
      </div>

      {/* Query params */}
      <div style={SECTION_LABEL}>{t('compareQueryParams')}</div>
      <KVTable allKeys={allParamKeys} leftMap={leftParams} rightMap={rightParams} emptyMsg="—" />

      {/* Request headers */}
      <div style={SECTION_LABEL}>{t('compareReqHeaders')}</div>
      <KVTable allKeys={allHeaderKeys} leftMap={leftReqHeaders} rightMap={rightReqHeaders} emptyMsg="—" />
    </div>
  );
}
