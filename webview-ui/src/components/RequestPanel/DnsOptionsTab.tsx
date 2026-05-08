import type React from 'react';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { DnsOptions } from '../../stores/requestStore';
import { useI18n } from '../../i18n';
import { Input } from '../shared/ui';

// All IANA-registered DNS record types (named) sorted by popularity then alphabetically
export const DNS_QUERY_TYPES = [
  // Most common
  'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'SOA', 'SRV', 'ANY',
  // DNSSEC
  'DS', 'RRSIG', 'NSEC', 'NSEC3', 'DNSKEY', 'NSEC3PARAM', 'CDS', 'CDNSKEY',
  // Modern
  'CAA', 'HTTPS', 'SVCB', 'TLSA', 'SSHFP', 'OPENPGPKEY', 'SMIMEA',
  // Infrastructure
  'DNAME', 'NAPTR', 'LOC', 'KX', 'CERT', 'HINFO', 'RP', 'AFSDB',
  // Miscellaneous
  'APL', 'DHCID', 'HIP', 'IPSECKEY', 'CSYNC', 'ZONEMD',
  'NID', 'L32', 'L64', 'LP', 'EUI48', 'EUI64',
  'URI', 'SPF', 'SIG', 'KEY', 'NULL',
  // Zone transfers & meta
  'AXFR', 'IXFR', 'OPT', 'TKEY', 'TSIG',
  // Historical
  'DLV', 'TA',
] as const;

const DATALIST_ID = 'dns-type-list';
const DNS_CLASS_DATALIST_ID = 'dns-class-list';
const DNS_CLASS_OPTIONS = ['IN', 'CH', 'HS', 'ANY'];

const selectStyle: React.CSSProperties = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, var(--border-color))',
  borderRadius: 3,
  padding: '3px 6px',
  fontSize: 12,
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: 'pointer', accentColor: 'var(--vscode-focusBorder)' }}
      />
      <span style={{ fontSize: 12 }}>{label}</span>
    </label>
  );
}

export function DnsOptionsTab() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
  const t = useI18n();

  if (!tab) return null;

  const dnsOptions: DnsOptions = {
    queryType: 'A',
    recursionDesired: true,
    ...tab.dnsOptions,
  };

  function updateDnsOptions(updates: Partial<DnsOptions>) {
    if (!tab) return;
    updateTab(tab.id, { dnsOptions: { ...dnsOptions, ...updates }, isDirty: true });
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
        {t('dnsOptionsLabel')}
      </div>

      {/* DNS Server */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, minWidth: 110 }}>{t('dnsDnsServer')}</label>
        <Input
          placeholder={t('dnsDnsServerPlaceholder')}
          value={dnsOptions.dnsServer ?? ''}
          onChange={(e) => updateDnsOptions({ dnsServer: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
      </div>

      {/* Query Type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, minWidth: 110 }}>{t('dnsQueryType')}</label>
        <input
          list={DATALIST_ID}
          value={dnsOptions.queryType}
          onChange={(e) => updateDnsOptions({ queryType: e.target.value })}
          placeholder="A"
          style={{ ...selectStyle, flex: 1, minWidth: 120, maxWidth: 160 }}
        />
        <datalist id={DATALIST_ID}>
          {DNS_QUERY_TYPES.map((qt) => <option key={qt} value={qt} />)}
        </datalist>
        <span style={{ fontSize: 11, opacity: 0.5 }}>{t('dnsTypeHint')}</span>
      </div>

      {/* DNS Class */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, minWidth: 110 }}>{t('dnsClass')}</label>
        <input
          list={DNS_CLASS_DATALIST_ID}
          value={dnsOptions.class ?? ''}
          onChange={(e) => updateDnsOptions({ class: e.target.value || undefined })}
          placeholder="IN"
          style={{ ...selectStyle, flex: 1, minWidth: 80, maxWidth: 120 }}
        />
        <datalist id={DNS_CLASS_DATALIST_ID}>
          {DNS_CLASS_OPTIONS.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      {/* Timeout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, minWidth: 110 }}>{t('dnsTimeout')}</label>
        <Input
          type="number"
          placeholder="5000"
          value={dnsOptions.timeout != null ? String(dnsOptions.timeout) : ''}
          onChange={(e) => updateDnsOptions({ timeout: e.target.value ? parseInt(e.target.value, 10) : undefined })}
          style={{ width: 95 }}
        />
        <span style={{ fontSize: 11, opacity: 0.6 }}>ms</span>
      </div>

      {/* EDNS Buffer Size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, minWidth: 110 }}>{t('dnsEdnsBufferSize')}</label>
        <Input
          type="number"
          placeholder="1232"
          value={dnsOptions.ednsBufferSize != null ? String(dnsOptions.ednsBufferSize) : ''}
          onChange={(e) => updateDnsOptions({ ednsBufferSize: e.target.value ? parseInt(e.target.value, 10) : undefined })}
          style={{ width: 95 }}
        />
        <span style={{ fontSize: 11, opacity: 0.6 }}>bytes</span>
      </div>

      {/* Flags */}
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginTop: 4 }}>
        {t('dnsFlags')}
      </div>
      <Toggle
        checked={dnsOptions.recursionDesired !== false}
        onChange={(v) => updateDnsOptions({ recursionDesired: v })}
        label={t('dnsRD')}
      />
      <Toggle
        checked={dnsOptions.checkingDisabled === true}
        onChange={(v) => updateDnsOptions({ checkingDisabled: v || undefined })}
        label={t('dnsCD')}
      />
      <Toggle
        checked={dnsOptions.dnssec === true}
        onChange={(v) => updateDnsOptions({ dnssec: v || undefined })}
        label={t('dnsDnssec')}
      />
    </div>
  );
}
