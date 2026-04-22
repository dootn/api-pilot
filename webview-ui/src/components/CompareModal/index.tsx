import { useState, useMemo } from 'react';
import { Modal } from '../shared/Modal';
import { useTabStore } from '../../stores/tabStore';
import { useI18n } from '../../i18n';
import { CompareSummary } from './CompareSummary';
import { CompareBodyDiff } from './CompareBodyDiff';
import { CompareHeaders } from './CompareHeaders';
import { CompareRequest } from './CompareRequest';

type SubTab = 'summary' | 'body' | 'headers' | 'request';

interface Props {
  initialTabId: string;
  onClose: () => void;
}

export function CompareModal({ initialTabId, onClose }: Props) {
  const t = useI18n();
  const tabs = useTabStore((s) => s.tabs);

  // Only HTTP tabs with a response
  const eligibleTabs = useMemo(
    () => tabs.filter((tab) => (!tab.protocol || tab.protocol === 'http') && tab.response !== null),
    [tabs],
  );

  // Determine default right tab: first eligible tab that is not the initial one
  const defaultRight = eligibleTabs.find((tab) => tab.id !== initialTabId)?.id ?? '';

  const [leftId, setLeftId] = useState<string>(initialTabId);
  const [rightId, setRightId] = useState<string>(defaultRight);
  const [subTab, setSubTab] = useState<SubTab>('summary');

  const leftTab = tabs.find((t) => t.id === leftId) ?? null;
  const rightTab = tabs.find((t) => t.id === rightId) ?? null;

  const SUB_TABS: Array<{ key: SubTab; label: string }> = [
    { key: 'summary', label: t('compareSummary') },
    { key: 'body', label: t('compareBody') },
    { key: 'headers', label: t('compareHeaders') },
    { key: 'request', label: t('compareRequest') },
  ];

  const SELECT_STYLE: React.CSSProperties = {
    background: 'var(--vscode-dropdown-background, #3c3c3c)',
    color: 'var(--vscode-dropdown-foreground, #cccccc)',
    border: '1px solid var(--vscode-dropdown-border, var(--border-color))',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 12,
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  };

  const OPTION_STYLE: React.CSSProperties = {
    background: 'var(--vscode-dropdown-background, #3c3c3c)',
    color: 'var(--vscode-dropdown-foreground, #cccccc)',
  };

  const hasEnoughTabs = eligibleTabs.length < 2;

  return (
    <Modal onClose={onClose} width="90vw" maxHeight="90vh">
      <div style={{ display: 'flex', flexDirection: 'column', height: '85vh', overflow: 'hidden' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>{t('compareTitle')}</span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--panel-fg)', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}
          >
            ×
          </button>
        </div>

        {/* Tab selectors */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-color)',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>{t('compareSelectLeft')}:</span>
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)} style={SELECT_STYLE}>
            {eligibleTabs.map((tab) => (
              <option key={tab.id} value={tab.id} style={OPTION_STYLE}>
                {tab.name}
              </option>
            ))}
          </select>

          <span style={{ fontSize: 16, opacity: 0.4, flexShrink: 0 }}>⇄</span>

          <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>{t('compareSelectRight')}:</span>
          <select value={rightId} onChange={(e) => setRightId(e.target.value)} style={SELECT_STYLE}>
            {eligibleTabs.map((tab) => (
              <option key={tab.id} value={tab.id} style={OPTION_STYLE}>
                {tab.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sub-tabs */}
        <div className="tabs" style={{ flexShrink: 0 }}>
          {SUB_TABS.map(({ key, label }) => (
            <button key={key} className={`tab${subTab === key ? ' active' : ''}`} onClick={() => setSubTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
          {hasEnoughTabs ? (
            <div style={{ padding: '32px 0', textAlign: 'center', opacity: 0.6, fontSize: 13 }}>
              {t('compareNoTabs')}
            </div>
          ) : (
            <>
              {subTab === 'summary' && (
                <CompareSummary leftResponse={leftTab?.response ?? null} rightResponse={rightTab?.response ?? null} />
              )}
              {subTab === 'body' && (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 12 }}>
                  <CompareBodyDiff
                    leftBody={leftTab?.response?.body ?? ''}
                    rightBody={rightTab?.response?.body ?? ''}
                  />
                </div>
              )}
              {subTab === 'headers' && (
                <CompareHeaders leftResponse={leftTab?.response ?? null} rightResponse={rightTab?.response ?? null} />
              )}
              {subTab === 'request' && (
                <CompareRequest leftTab={leftTab} rightTab={rightTab} />
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
