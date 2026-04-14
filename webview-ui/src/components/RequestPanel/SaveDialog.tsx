import { useState, useRef, useEffect, useCallback } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { vscode } from '../../vscode';
import { useI18n } from '../../i18n';

interface FolderItem {
  type: string;
  name: string;
  items?: FolderItem[];
}

interface CollectionBrief {
  id: string;
  name: string;
  items: FolderItem[];
}

function FolderRows({
  collectionId,
  items,
  depth,
  onSave,
}: {
  collectionId: string;
  items: FolderItem[];
  depth: number;
  onSave: (collectionId: string, folderId?: string) => void;
}) {
  const folders = items.filter((i) => i.type === 'folder');
  if (folders.length === 0) return null;
  return (
    <>
      {folders.map((folder) => (
        <div key={folder.name}>
          <div
            className="save-dropdown-item"
            style={{ paddingLeft: 12 + depth * 14 }}
            onClick={() => onSave(collectionId, folder.name)}
          >
            {'  '.repeat(depth)}📂 {folder.name}
          </div>
          {folder.items?.length ? (
            <FolderRows
              collectionId={collectionId}
              items={folder.items}
              depth={depth + 1}
              onSave={onSave}
            />
          ) : null}
        </div>
      ))}
    </>
  );
}

function SaveColTree({
  col,
  onSave,
}: {
  col: CollectionBrief;
  onSave: (collectionId: string, folderId?: string) => void;
}) {
  return (
    <>
      <div
        className="save-dropdown-item"
        onClick={() => onSave(col.id)}
        style={{ fontWeight: 600 }}
      >
        📁 {col.name}
      </div>
      {col.items?.length ? (
        <FolderRows collectionId={col.id} items={col.items} depth={1} onSave={onSave} />
      ) : null}
    </>
  );
}

export function SaveDialog({
  collectionId,
  disabled,
  onDirectSave,
  onSaveAs,
}: {
  collectionId?: string;
  disabled: boolean;
  onDirectSave: () => void;
  onSaveAs: (collectionId: string, folderId?: string) => void;
}) {
  const t = useI18n();
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [collections, setCollections] = useState<CollectionBrief[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const saveDropdownRef = useRef<HTMLDivElement>(null);

  // Load collections and listen for response when save dropdown opens
  useEffect(() => {
    if (!showSaveDropdown) return;
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'collections') {
        setCollections((msg.payload as CollectionBrief[]) ?? []);
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'getCollections' });
    return () => window.removeEventListener('message', handler);
  }, [showSaveDropdown]);

  useClickOutside(saveDropdownRef, useCallback(() => setShowSaveDropdown(false), []), showSaveDropdown);

  const handleDirectSave = () => {
    onDirectSave();
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleSaveAs = (colId: string, folderId?: string) => {
    onSaveAs(colId, folderId);
    setSaveStatus('saved');
    setShowSaveDropdown(false);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  return (
    <>
      {/* Save: update existing collection item — shown when tab is bound to a collection */}
      {collectionId && (
        <button
          className={`save-btn ${saveStatus === 'saved' ? 'saved' : ''}`}
          onClick={handleDirectSave}
          title={t('urlSaveTitleUpdate')}
          disabled={disabled}
        >
          {saveStatus === 'saved' ? t('urlSavedBtn') : t('urlSaveBtn')}
        </button>
      )}

      {/* Save As: always available, picks collection */}
      <div className="save-wrap" ref={saveDropdownRef}>
        <button
          className="save-btn"
          onClick={() => setShowSaveDropdown((v) => !v)}
          title={t('urlSaveTitleAs')}
          disabled={disabled}
        >
          {collectionId ? t('urlSaveAsBtn') : t('urlSaveNewBtn')}
        </button>

        {showSaveDropdown && (
          <div className="save-dropdown">
            {collections.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 12, opacity: 0.6 }}>
                {t('urlNoCollections')}
              </div>
            ) : (
              collections.map((col) => (
                <SaveColTree
                  key={col.id}
                  col={col}
                  onSave={handleSaveAs}
                />
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
