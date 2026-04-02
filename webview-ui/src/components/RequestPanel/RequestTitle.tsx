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
    </div>
  );
}
