import { useEffect } from 'react';
import { useI18n } from '../../i18n';

interface ApiMethod {
  sig: string;
  desc: string;
  returns?: string;
}

interface ApiSection {
  title: string;
  badge: string;
  badgeColor: string;
  methods: ApiMethod[];
}

const API_SECTIONS: ApiSection[] = [
  {
    title: 'pm.request',
    badge: 'Pre & Post',
    badgeColor: '#569cd6',
    methods: [
      { sig: 'pm.request.url', desc: 'The request URL string.', returns: 'string' },
      { sig: 'pm.request.method', desc: 'HTTP method (GET, POST, …).', returns: 'string' },
      { sig: 'pm.request.body', desc: 'The request body object.', returns: 'object' },
      { sig: 'pm.request.headers.get(key)', desc: 'Get a request header value by name (case-insensitive).', returns: 'string | null' },
      { sig: 'pm.request.headers.add({ key, value })', desc: 'Add or overwrite a request header.' },
      { sig: 'pm.request.headers.remove(key)', desc: 'Remove a request header by name.' },
      { sig: 'pm.request.params.get(key)', desc: 'Get a query parameter value by name.', returns: 'string | null' },
      { sig: 'pm.request.params.add({ key, value })', desc: 'Add a query parameter.' },
      { sig: 'pm.request.params.remove(key)', desc: 'Remove a query parameter by name.' },
    ],
  },
  {
    title: 'pm.response',
    badge: 'Post-response only',
    badgeColor: '#4ec9b0',
    methods: [
      { sig: 'pm.response.code', desc: 'HTTP status code.', returns: 'number' },
      { sig: 'pm.response.status', desc: 'Alias for pm.response.code.', returns: 'number' },
      { sig: 'pm.response.statusText', desc: 'Status text, e.g. "OK".', returns: 'string' },
      { sig: 'pm.response.responseTime', desc: 'Round-trip time in milliseconds.', returns: 'number' },
      { sig: 'pm.response.size', desc: 'Response body size in bytes.', returns: 'number' },
      { sig: 'pm.response.headers.get(key)', desc: 'Get a response header value (case-insensitive).', returns: 'string | null' },
      { sig: 'pm.response.text()', desc: 'Response body as a raw string.', returns: 'string' },
      { sig: 'pm.response.json()', desc: 'Parse and return the response body as JSON. Returns null on parse failure.', returns: 'any | null' },
    ],
  },
  {
    title: 'pm.environment',
    badge: 'Pre & Post',
    badgeColor: '#569cd6',
    methods: [
      { sig: 'pm.environment.get(key)', desc: 'Get the value of an environment variable. Values set during this script run take priority.', returns: 'string | null' },
      { sig: 'pm.environment.set(key, value)', desc: 'Set an environment variable. Changes are persisted to the active environment after the script completes.' },
    ],
  },
  {
    title: 'pm.variables',
    badge: 'Pre & Post',
    badgeColor: '#569cd6',
    methods: [
      { sig: 'pm.variables.get(key)', desc: 'Get a script-local variable (not persisted).', returns: 'any | null' },
      { sig: 'pm.variables.set(key, value)', desc: 'Set a script-local variable. Visible only within the current script run.' },
    ],
  },
  {
    title: 'pm.test',
    badge: 'Post-response only',
    badgeColor: '#4ec9b0',
    methods: [
      {
        sig: 'pm.test(name, fn)',
        desc: 'Define a named test. The callback `fn` should throw or return false to fail. Results appear in the Tests tab.',
      },
    ],
  },
  {
    title: 'pm.expect',
    badge: 'Pre & Post',
    badgeColor: '#569cd6',
    methods: [
      { sig: 'pm.expect(value).to.equal(expected)', desc: 'Strict equality (===).' },
      { sig: 'pm.expect(value).to.eql(expected)', desc: 'Deep equality (JSON comparison).' },
      { sig: 'pm.expect(value).to.include(str)', desc: 'String includes substr.' },
      { sig: 'pm.expect(value).to.be.ok()', desc: 'Value is truthy.' },
      { sig: 'pm.expect(value).to.be.null()', desc: 'Value is null.' },
      { sig: 'pm.expect(value).to.be.a(type)', desc: 'typeof value === type.' },
      { sig: 'pm.expect(value).to.be.above(n)', desc: 'value > n.' },
      { sig: 'pm.expect(value).to.be.below(n)', desc: 'value < n.' },
      { sig: 'pm.expect(value).to.be.within(lo, hi)', desc: 'lo ≤ value ≤ hi.' },
      { sig: 'pm.expect(value).to.have.property(key)', desc: 'Object has the given key.' },
      { sig: 'pm.expect(value).to.have.status(code)', desc: 'Object.status === code.' },
      { sig: 'pm.expect(value).to.not.equal(expected)', desc: 'value !== expected.' },
      { sig: 'pm.expect(value).to.not.be.ok()', desc: 'Value is falsy.' },
      { sig: 'pm.expect(value).to.not.be.null()', desc: 'Value is not null.' },
    ],
  },
  {
    title: 'console',
    badge: 'Pre & Post',
    badgeColor: '#569cd6',
    methods: [
      { sig: 'console.log(...args)', desc: 'Log a message. Output appears in the Console tab.' },
      { sig: 'console.warn(...args)', desc: 'Log a warning.' },
      { sig: 'console.error(...args)', desc: 'Log an error.' },
    ],
  },
];

const CODE: React.CSSProperties = {
  fontFamily: 'var(--vscode-editor-font-family, monospace)',
  fontSize: 12,
  background: 'rgba(255,255,255,0.06)',
  padding: '1px 5px',
  borderRadius: 3,
  color: '#ce9178',
};

export function ScriptDocs({ onClose }: { onClose: () => void }) {
  const t = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          width: '720px',
          maxWidth: '95vw',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{t('scriptDocsTitle')}</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--panel-fg)',
              cursor: 'pointer', fontSize: 16, padding: '0 4px', opacity: 0.7,
            }}
          >✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '12px 16px', flex: 1 }}>
          {API_SECTIONS.map((section) => (
            <div key={section.title} style={{ marginBottom: 20 }}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ ...CODE, fontSize: 13, color: '#9cdcfe', padding: '2px 7px' }}>
                  {section.title}
                </span>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 8,
                  background: section.badgeColor + '22',
                  color: section.badgeColor,
                  border: `1px solid ${section.badgeColor}44`,
                }}>
                  {section.badge}
                </span>
              </div>

              {/* Method rows */}
              <div style={{
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
              }}>
                {section.methods.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      padding: '7px 12px',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.025)',
                      borderTop: i > 0 ? '1px solid var(--border-color)' : 'none',
                      alignItems: 'start',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <code style={CODE}>{m.sig}</code>
                      {m.returns && (
                        <span style={{ fontSize: 10, opacity: 0.55, paddingLeft: 2 }}>
                          → <span style={{ color: '#b5cea8' }}>{m.returns}</span>
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>{m.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
