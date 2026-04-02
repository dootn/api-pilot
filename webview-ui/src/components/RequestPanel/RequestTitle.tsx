import { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../stores/tabStore';
import { vscode } from '../../vscode';
import { useI18n } from '../../i18n';

export function RequestTitle() {
  const { activeTabId, tabs, updateTab, renameTab } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);
  const t = useI18n();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (editingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
      descriptionInputRef.current.select();
    }
  }, [editingDescription]);

  if (!tab) return null;

  const displayName = tab.isCustomNamed ? tab.name : (tab.url || tab.name);

  function startEdit() {
    setEditValue(displayName);
    setEditing(true);
  }

  function commitEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== displayName) {
      renameTab(tab!.id, trimmed);
      if (tab!.collectionId) {
        vscode.postMessage({
          type: 'syncRequestName',
          payload: { collectionId: tab!.collectionId, requestId: tab!.id, newName: trimmed },
        });
        updateTab(tab!.id, { isDirty: false });
      }
    }
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function startEditDescription() {
    setDescriptionValue(tab?.description || '');
    setEditingDescription(true);
  }

  function commitDescriptionEdit() {
    const trimmed = descriptionValue.trim();
    if (trimmed !== (tab?.description || '')) {
      updateTab(tab!.id, { description: trimmed });
      if (tab!.collectionId) {
        vscode.postMessage({
          type: 'syncRequestDescription',
          payload: { collectionId: tab!.collectionId, requestId: tab!.id, description: trimmed },
        });
      }
    }
    setEditingDescription(false);
  }

  function cancelDescriptionEdit() {
    setEditingDescription(false);
  }

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const importTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (importModalOpen && importTextareaRef.current) {
      importTextareaRef.current.focus();
    }
  }, [importModalOpen]);

  function openImportModal() {
    setImportInput('');
    setImportModalOpen(true);
  }

  function commitImport(newTab: boolean) {
    const trimmed = importInput.trim();
    if (trimmed) {
      vscode.postMessage({ type: 'importRequest', payload: { input: trimmed, newTab } });
    }
    setImportModalOpen(false);
  }

  return (
    <div className="request-title-bar">
      <div className="request-title-header">
        <button
          className="request-title-arrow"
          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
          title={isDescriptionExpanded ? t('requestCollapse') : t('requestExpand')}
        >
          {isDescriptionExpanded ? '▼' : '▶'}
        </button>
        {editing ? (
          <input
            ref={inputRef}
            className="request-title-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              else if (e.key === 'Escape') cancelEdit();
              e.stopPropagation();
            }}
          />
        ) : (
          <span className="request-title-text" title={displayName}>
            {displayName}
            <button
              className="request-title-edit-btn"
              onClick={startEdit}
              title={t('requestRename')}
            >
              ✎
            </button>
          </span>
        )}
        <button
          className="request-title-import-btn"
          onClick={openImportModal}
          title={t('quickImportBtn')}
        >
          {t('quickImportBtn')}
        </button>
      </div>

      {isDescriptionExpanded && (
        <div className="request-description-section">
          {editingDescription ? (
            <input
              ref={descriptionInputRef}
              className="request-description-input"
              placeholder={t('requestAddDesc')}
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={commitDescriptionEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDescriptionEdit();
                else if (e.key === 'Escape') cancelDescriptionEdit();
                e.stopPropagation();
              }}
            />
          ) : (
            <div className="request-description-text" title={tab?.description || t('requestAddDesc')}>
              {tab?.description || t('requestNoDesc')}
              <button
                className="request-description-edit-btn"
                onClick={startEditDescription}
                title={t('requestEditDesc')}
              >
                ✎
              </button>
            </div>
          )}
        </div>
      )}

      {importModalOpen && (
        <div className="import-modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="import-modal-title">{t('quickImportTitle')}</div>
            <textarea
              ref={importTextareaRef}
              className="import-modal-textarea"
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder={t('quickImportPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setImportModalOpen(false);
                e.stopPropagation();
              }}
            />
            <div className="import-modal-actions">
              <button className="import-modal-cancel" onClick={() => setImportModalOpen(false)}>
                {t('quickImportCancel')}
              </button>
              <button className="import-modal-confirm" onClick={() => commitImport(false)} disabled={!importInput.trim()}>
                {t('quickImportCurrentTab')}
              </button>
              <button className="import-modal-confirm import-modal-confirm--new-tab" onClick={() => commitImport(true)} disabled={!importInput.trim()}>
                {t('quickImportNewTab')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
