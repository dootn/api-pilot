import { useState, useRef } from 'react';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { ScriptDocs } from './ScriptDocs';
import { PRE_SCRIPT_EXAMPLES, POST_SCRIPT_EXAMPLES } from './scriptExamples';
import { Button, Textarea } from '../shared/ui';

/* ---- Examples dropdown (shared between pre/post) ---- */
function ExamplesDropdown({ examples, onSelect }: {
  examples: { labelKey: TranslationKey; code: string }[];
  onSelect: (code: string) => void;
}) {
  const t = useI18n();
  return (
    <div className="script-examples-dropdown" onClick={(e) => e.stopPropagation()}>
      {examples.map((example, idx) => (
        <div
          key={idx}
          className={`script-examples-item${idx < examples.length - 1 ? ' border-b' : ''}`}
          onClick={() => onSelect(example.code)}
        >
          {t(example.labelKey)}
        </div>
      ))}
    </div>
  );
}

/* ---- Active indicator badge ---- */
function ActiveBadge() {
  return <span className="script-active-badge">●</span>;
}

export function ScriptEditor() {
  const updateTab = useTabStore((s) => s.updateTab);
  const t = useI18n();
  const tab = useActiveTab();
  const [showPreExamples, setShowPreExamples] = useState(false);
  const [showPostExamples, setShowPostExamples] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const preTextareaRef = useRef<HTMLTextAreaElement>(null);
  const postTextareaRef = useRef<HTMLTextAreaElement>(null);

  if (!tab) return null;

  const insertExample = (code: string, isPreScript: boolean) => {
    const textarea = isPreScript ? preTextareaRef.current : postTextareaRef.current;
    if (!textarea) return;

    const currentValue = isPreScript ? (tab.preScript || '') : (tab.postScript || '');
    const cursorPos = textarea.selectionStart || currentValue.length;
    
    const newValue = 
      currentValue.substring(0, cursorPos) +
      (currentValue && !currentValue.endsWith('\n') && cursorPos === currentValue.length ? '\n\n' : '') +
      code +
      '\n' +
      currentValue.substring(cursorPos);

    updateTab(tab.id, isPreScript ? { preScript: newValue } : { postScript: newValue });
    
    if (isPreScript) setShowPreExamples(false);
    else setShowPostExamples(false);

    setTimeout(() => textarea.focus(), 0);
  };

  return (
    <>
      {showDocs && <ScriptDocs onClose={() => setShowDocs(false)} />}
      <div className="script-editor-container">
      {/* Pre-request script */}
      <div>
        <div className="script-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="section-header">{t('preScriptLabel')}</span>
            {tab.preScript?.trim() && <ActiveBadge />}
          </div>
          <div style={{ position: 'relative' }}>
            <Button variant="ghost" btnSize="sm" onClick={() => setShowDocs(true)} style={{ marginRight: 4 }}>
              {t('scriptDocsBtn')}
            </Button>
            <Button variant="ghost" btnSize="sm" onClick={() => setShowPreExamples(!showPreExamples)}>
              {t('insertExampleBtn')}
            </Button>
            {showPreExamples && (
              <ExamplesDropdown examples={PRE_SCRIPT_EXAMPLES} onSelect={(code) => insertExample(code, true)} />
            )}
          </div>
        </div>
        <div className="text-secondary" style={{ fontSize: 11, marginBottom: 6 }}>{t('preScriptHelp')}</div>
        <Textarea
          ref={preTextareaRef}
          className="body-textarea"
          value={tab.preScript || ''}
          onChange={(e) => updateTab(tab.id, { preScript: e.target.value })}
          placeholder={t('preScriptPlaceholder')}
          spellCheck={false}
          style={{ minHeight: 110 }}
          onClick={() => setShowPreExamples(false)}
        />
        {tab.preScript?.trim() && (
          <Button variant="ghost" btnSize="sm" onClick={() => updateTab(tab.id, { preScript: '' })} style={{ marginTop: 4 }}>
            {t('clearScriptBtn')}
          </Button>
        )}
      </div>

      <div className="border-t" />

      {/* Post-response script */}
      <div>
        <div className="script-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="section-header">{t('postScriptLabel')}</span>
            {tab.postScript?.trim() && <ActiveBadge />}
          </div>
          <div style={{ position: 'relative' }}>
            <Button variant="ghost" btnSize="sm" onClick={() => setShowPostExamples(!showPostExamples)}>
              {t('insertExampleBtn')}
            </Button>
            {showPostExamples && (
              <ExamplesDropdown examples={POST_SCRIPT_EXAMPLES} onSelect={(code) => insertExample(code, false)} />
            )}
          </div>
        </div>
        <div className="text-secondary" style={{ fontSize: 11, marginBottom: 6 }}>{t('postScriptHelp')}</div>
        <Textarea
          ref={postTextareaRef}
          className="body-textarea"
          value={tab.postScript || ''}
          onChange={(e) => updateTab(tab.id, { postScript: e.target.value })}
          placeholder={t('postScriptPlaceholder')}
          spellCheck={false}
          style={{ minHeight: 110 }}
          onClick={() => setShowPostExamples(false)}
        />
        {tab.postScript?.trim() && (
          <Button variant="ghost" btnSize="sm" onClick={() => updateTab(tab.id, { postScript: '' })} style={{ marginTop: 4 }}>
            {t('clearScriptBtn')}
          </Button>
        )}
      </div>
    </div>
  </>
  );
}
