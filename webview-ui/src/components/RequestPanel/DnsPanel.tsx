import { useActiveTab } from '../../stores/tabStore';
import type { DnsRecord, DnsResponse } from '../../stores/requestStore';
import { useI18n } from '../../i18n';
import { useState } from 'react';

// All DNS flags with display labels
const DNS_FLAG_FIELDS: { key: string; label: string; title: string }[] = [
  { key: 'qr',  label: 'QR',  title: 'Query/Response' },
  { key: 'aa',  label: 'AA',  title: 'Authoritative Answer' },
  { key: 'tc',  label: 'TC',  title: 'Truncated' },
  { key: 'rd',  label: 'RD',  title: 'Recursion Desired' },
  { key: 'ra',  label: 'RA',  title: 'Recursion Available' },
  { key: 'ad',  label: 'AD',  title: 'Authentic Data (DNSSEC)' },
  { key: 'cd',  label: 'CD',  title: 'Checking Disabled (DNSSEC)' },
];

const OPCODE_LABELS: Record<number, string> = { 0: 'QUERY', 1: 'IQUERY', 2: 'STATUS', 4: 'NOTIFY', 5: 'UPDATE' };
const RCODE_LABELS: Record<number, string> = {
  0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED',
  6: 'YXDOMAIN', 7: 'YXRRSET', 8: 'NXRRSET', 9: 'NOTAUTH', 10: 'NOTZONE',
};

function FlagsRow({ flags }: { flags: Record<string, unknown> }) {
  const opcode = flags.opcode as number | undefined ?? 0;
  const rcode = flags.rcode as number | undefined ?? 0;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {DNS_FLAG_FIELDS.map(({ key, label, title }) => {
        const active = flags[key] === true;
        return (
          <span
            key={key}
            title={title}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 3, fontSize: 11, fontWeight: 600,
              border: `1px solid ${active ? '#4ec9b0' : 'var(--border-color)'}`,
              color: active ? '#4ec9b0' : 'var(--panel-fg-muted, #666)',
              background: active ? 'rgba(78,201,176,0.08)' : 'transparent',
              cursor: 'default',
            }}
          >
            {label}
            <span style={{ fontSize: 9, opacity: 0.8 }}>{active ? '✓' : '✗'}</span>
          </span>
        );
      })}
      <span style={{ fontSize: 11, color: 'var(--panel-fg-muted, #666)', paddingLeft: 4 }}>
        OPCODE: <strong style={{ color: 'var(--panel-fg)' }}>{OPCODE_LABELS[opcode] ? `${OPCODE_LABELS[opcode]}(${opcode})` : opcode}</strong>
      </span>
      <span style={{ fontSize: 11, color: 'var(--panel-fg-muted, #666)' }}>
        RCODE: <strong style={{ color: rcode === 0 ? '#4ec9b0' : '#f48771' }}>{RCODE_LABELS[rcode] ? `${RCODE_LABELS[rcode]}(${rcode})` : rcode}</strong>
      </span>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  A: '#4ec9b0',
  AAAA: '#4fc1ff',
  CNAME: '#9cdcfe',
  MX: '#dcdcaa',
  TXT: '#ce9178',
  NS: '#c586c0',
  PTR: '#4ec9b0',
  SOA: '#808080',
  SRV: '#569cd6',
  ANY: '#b5cea8',
};

function StatusBadge({ status }: { status: DnsResponse['status'] }) {
  const colors: Record<string, string> = {
    ok: '#4ec9b0',
    error: '#f48771',
    nxdomain: '#dcdcaa',
    timeout: '#ce9178',
  };
  const labels: Record<string, string> = {
    ok: 'OK',
    error: 'ERROR',
    nxdomain: 'NXDOMAIN',
    timeout: 'TIMEOUT',
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 700,
      color: colors[status] ?? '#808080',
      border: `1px solid ${colors[status] ?? '#808080'}`,
      letterSpacing: '0.05em',
    }}>
      {labels[status] ?? status.toUpperCase()}
    </span>
  );
}

function RecordRow({ record }: { record: DnsRecord }) {
  const color = TYPE_COLORS[record.type] ?? '#808080';
  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
      <td style={{ padding: '4px 8px', width: 60 }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 6px',
          borderRadius: 3,
          fontSize: 10,
          fontWeight: 700,
          color,
          border: `1px solid ${color}`,
        }}>{record.type}</span>
      </td>
      <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
        {record.type === 'SRV'
          ? `${record.value}:${record.port} (priority=${record.priority}, weight=${record.weight})`
          : record.type === 'MX'
          ? `${record.value} (priority=${record.priority})`
          : record.type === 'SOA'
          ? (record.entries ?? [record.value]).join(' | ')
          : record.type === 'TXT'
          ? `"${record.value}"`
          : record.value}
      </td>
      <td style={{ padding: '4px 8px', fontSize: 11, color: 'var(--panel-fg-muted, #888)', width: 80, textAlign: 'right' }}>
        {record.ttl != null ? `TTL ${record.ttl}` : ''}
      </td>
    </tr>
  );
}

export function DnsPanel() {
  const tab = useActiveTab();
  const t = useI18n();
  const [activeTab, setActiveTab] = useState<'records' | 'raw'>('records');

  if (!tab) return null;

  const dnsResponse: DnsResponse | undefined = tab.dnsResponse;
  const loading = tab.loading;

  const hasRaw = dnsResponse?.raw != null;
  const showRecords = !loading && dnsResponse && activeTab === 'records';
  const showRaw = !loading && dnsResponse && activeTab === 'raw' && hasRaw;

  return (
    <div className="flex-col flex-1" style={{ minHeight: 0, overflow: 'auto', padding: 12, gap: 12, display: 'flex', flexDirection: 'column' }}>
      {loading && (
        <div className="empty-state" style={{ marginTop: 16 }}>
          <div className="loading-spinner" />
          <div style={{ marginTop: 8, fontSize: 12 }}>{t('dnsQuerying')}</div>
        </div>
      )}

      {!loading && tab.responseError && (
        <div className="error-message">
          <strong>{t('respErrorPrefix')}</strong>{tab.responseError}
        </div>
      )}

      {!loading && dnsResponse && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          {/* Summary bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <StatusBadge status={dnsResponse.status} />
            <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{dnsResponse.hostname}</span>
            <span style={{ fontSize: 11, color: 'var(--panel-fg)', opacity: 0.7 }}>
              {t('dnsQueryType')}: <strong>{dnsResponse.queryType}</strong>
            </span>
            <span style={{ fontSize: 11, color: 'var(--panel-fg)', opacity: 0.7 }}>
              {t('dnsRecords')}: <strong>{dnsResponse.records.length}</strong>
            </span>
            <span style={{ fontSize: 11, color: 'var(--panel-fg)', opacity: 0.7 }}>
              {t('respTime')}: <strong>{dnsResponse.time}ms</strong>
            </span>
            {dnsResponse.server && (
              <span style={{ fontSize: 11, color: 'var(--panel-fg)', opacity: 0.7 }}>
                {t('dnsDnsServer')}: <strong>{dnsResponse.server}</strong>
              </span>
            )}
          </div>

          {dnsResponse.error && (
            <div style={{ fontSize: 12, color: 'var(--error-fg, #f48771)', padding: '6px 8px', background: 'var(--error-bg, rgba(244,135,113,0.1))', borderRadius: 4 }}>
              {dnsResponse.error}
            </div>
          )}

          {/* Tabs */}
          {hasRaw && (
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              <button
                onClick={() => setActiveTab('records')}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: activeTab === 'records' ? 600 : 400,
                  border: 'none',
                  background: activeTab === 'records' ? 'var(--button-background)' : 'transparent',
                  color: activeTab === 'records' ? 'var(--panel-fg)' : 'var(--panel-fg-muted, #888)',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                Records
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: activeTab === 'raw' ? 600 : 400,
                  border: 'none',
                  background: activeTab === 'raw' ? 'var(--button-background)' : 'transparent',
                  color: activeTab === 'raw' ? 'var(--panel-fg)' : 'var(--panel-fg-muted, #888)',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                Raw
              </button>
            </div>
          )}

          {/* Records Tab */}
          {showRecords ? (
            <>
              {dnsResponse.records.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 11, opacity: 0.7, width: 60 }}>{t('dnsColType')}</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 11, opacity: 0.7 }}>{t('dnsColValue')}</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 11, opacity: 0.7, width: 80 }}>TTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dnsResponse.records.map((r, i) => (
                        <RecordRow key={i} record={r} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {dnsResponse.records.length === 0 && dnsResponse.status === 'ok' && (
                <div className="empty-state" style={{ fontSize: 12 }}>
                  {t('dnsNoRecords')}
                </div>
              )}
            </>
          ) : null}

          {/* Raw Tab */}
          {showRaw && dnsResponse && dnsResponse.raw ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              {(dnsResponse.raw as Record<string, unknown>).flags ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--panel-fg-muted, #888)', fontWeight: 600 }}>Flags</span>
                  <FlagsRow flags={(dnsResponse.raw as Record<string, unknown>).flags as Record<string, unknown>} />
                </div>
              ) : null}
              <div style={{
                flex: 1,
                overflow: 'auto',
                background: 'var(--editor-background, #1e1e1e)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                padding: 12,
                fontFamily: 'monospace',
                fontSize: 11,
                color: 'var(--editor-fg, #d4d4d4)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}>
                {JSON.stringify(dnsResponse.raw, null, 2)}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {!loading && !dnsResponse && !tab.responseError && (
        <div className="empty-state">
          <div className="icon">🔍</div>
          <div>{t('dnsEmptyHint')}</div>
          <div style={{ marginTop: 4, fontSize: 11 }} className="text-secondary">
            {t('ctrlEnterHint')}
          </div>
        </div>
      )}
    </div>
  );
}
