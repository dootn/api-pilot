import { useState, useEffect, useCallback, useMemo } from 'react';
import type { RequestTab } from '../../stores/tabStore';
import {
  generateCurl,
  generateJsFetch,
  generateJsAxios,
  generatePython,
} from '../../utils/codeGenerators';
import { useEnvironments } from '../../hooks/useEnvironments';
import { useI18n } from '../../i18n';

type CodeLang = 'curl' | 'js-fetch' | 'js-axios' | 'python';

const CODE_TABS: { id: CodeLang; label: string }[] = [
  { id: 'curl',     label: 'cURL'       },
  { id: 'js-fetch', label: 'JS (Fetch)' },
  { id: 'js-axios', label: 'JS (Axios)' },
  { id: 'python',   label: 'Python'     },
];

/** Replace {{varName}} tokens in a string using the provided variable map. */
function resolveVarsInString(text: string, varMap: Map<string, string>): string {
  if (!text || !text.includes('{{')) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, name: string) => varMap.get(name.trim()) ?? match);
}

/** Deep-clone a RequestTab with all string fields resolved against the active env. */
function resolveTabVars(tab: RequestTab, varMap: Map<string, string>): RequestTab {
  if (varMap.size === 0) return tab;
  const json = JSON.stringify(tab);
  const resolved = resolveVarsInString(json, varMap);
  try { return JSON.parse(resolved) as RequestTab; } catch { return tab; }
}

function buildCode(lang: CodeLang, tab: RequestTab): string {
  switch (lang) {
    case 'curl':     return generateCurl(tab);
    case 'js-fetch': return generateJsFetch(tab);
    case 'js-axios': return generateJsAxios(tab);
    case 'python':   return generatePython(tab);
  }
}

export function CodeModal({ tab, onClose }: { tab: RequestTab; onClose: () => void }) {
  const [activeLang, setActiveLang] = useState<CodeLang>('curl');
  const [copied, setCopied] = useState(false);
  const { environments, activeEnvId } = useEnvironments();
  const t = useI18n();

  const varMap = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId);
    const vars = (env?.variables ?? []).filter((v) => v.enabled);
    return new Map(vars.map((v) => [v.key, v.value]));
  }, [environments, activeEnvId]);

  const resolvedTab = useMemo(() => resolveTabVars(tab, varMap), [tab, varMap]);
  const code = buildCode(activeLang, resolvedTab);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

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
          width: 'min(720px, 96vw)',
          maxHeight: '80vh',
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{t('codeSnippetTitle')}</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--panel-fg)', fontSize: 16, lineHeight: 1, padding: '0 2px',
              opacity: 0.7,
            }}
            title={t('closeBtn')}
          >✕</button>
        </div>

        {/* Language tabs */}
        <div style={{
          display: 'flex', gap: 2, padding: '0 14px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          {CODE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveLang(t.id); setCopied(false); }}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeLang === t.id
                  ? '2px solid var(--button-bg)'
                  : '2px solid transparent',
                cursor: 'pointer',
                color: 'var(--panel-fg)',
                fontSize: 12,
                opacity: activeLang === t.id ? 1 : 0.6,
                fontWeight: activeLang === t.id ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Code area */}
        <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
          <pre style={{
            margin: 0,
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: 'var(--panel-fg)',
          }}>{code}</pre>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '8px 14px',
          borderTop: '1px solid var(--border-color)',
        }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '4px 14px',
              background: copied ? 'var(--success-fg, #4ec9b0)' : 'var(--button-bg)',
              color: 'var(--button-fg)',
              border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12,
            }}
          >
            {copied ? t('codeSnippetCopied') : t('codeSnippetCopy')}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '4px 14px',
              background: 'transparent', color: 'var(--panel-fg)',
              border: '1px solid var(--border-color)', borderRadius: 3,
              cursor: 'pointer', fontSize: 12,
            }}
          >
            {t('closeBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
