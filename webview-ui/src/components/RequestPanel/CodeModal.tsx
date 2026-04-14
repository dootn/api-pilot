import { useState, useMemo } from 'react';
import type { RequestTab } from '../../stores/tabStore';
import {
  generateCurl,
  generateJsFetch,
  generateJsAxios,
  generatePython,
} from '../../utils/codeGenerators';
import { useEnvironments } from '../../hooks/useEnvironments';
import { useI18n } from '../../i18n';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { Modal } from '../shared/Modal';
import { ToggleGroup, Button } from '../shared/ui';

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
  const { copied, copy, reset: resetCopied } = useCopyToClipboard();
  const { environments, activeEnvId } = useEnvironments();
  const t = useI18n();

  const varMap = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId);
    const vars = (env?.variables ?? []).filter((v) => v.enabled);
    return new Map(vars.map((v) => [v.key, v.value]));
  }, [environments, activeEnvId]);

  const resolvedTab = useMemo(() => resolveTabVars(tab, varMap), [tab, varMap]);
  const code = buildCode(activeLang, resolvedTab);

  const handleCopy = () => copy(code);

  return (
    <Modal onClose={onClose} width="min(720px, 96vw)" maxHeight="80vh">
      <div className="code-modal-content">
        {/* Header */}
        <div className="code-modal-header border-b">
          <span className="code-modal-title">{t('codeSnippetTitle')}</span>
          <button onClick={onClose} className="icon-btn" title={t('closeBtn')}>✕</button>
        </div>

        {/* Language tabs */}
        <div className="code-modal-tabs border-b">
          <ToggleGroup
            options={CODE_TABS.map(t => ({ value: t.id, label: t.label }))}
            value={activeLang}
            onChange={(v) => { setActiveLang(v); resetCopied(); }}
          />
        </div>

        {/* Code area */}
        <div className="code-modal-body">
          <pre className="code-modal-pre">{code}</pre>
        </div>

        {/* Footer */}
        <div className="code-modal-footer border-t">
          <Button
            variant={copied ? 'primary' : 'primary'}
            btnSize="sm"
            onClick={handleCopy}
            style={copied ? { background: 'var(--success-fg, #4ec9b0)' } : undefined}
          >
            {copied ? t('codeSnippetCopied') : t('codeSnippetCopy')}
          </Button>
          <Button variant="secondary" btnSize="sm" onClick={onClose}>
            {t('closeBtn')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
