import { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { HttpMethod } from '../../stores/requestStore';
import { vscode } from '../../vscode';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

const METHOD_CLASSES: Record<HttpMethod, string> = {
  GET: 'method-get',
  POST: 'method-post',
  PUT: 'method-put',
  DELETE: 'method-delete',
  PATCH: 'method-patch',
  OPTIONS: 'method-options',
  HEAD: 'method-head',
};

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

export function UrlBar() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [collections, setCollections] = useState<CollectionBrief[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const saveDropdownRef = useRef<HTMLDivElement>(null);
  const tab = tabs.find((t) => t.id === activeTabId);

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

  // Close save dropdown when clicking outside
  useEffect(() => {
    if (!showSaveDropdown) return;
    const close = (e: MouseEvent) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(e.target as Node)) {
        setShowSaveDropdown(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showSaveDropdown]);

  if (!tab) return null;

  const handleSend = () => {
    if (!tab.url.trim()) return;

    if (tab.loading) {
      vscode.postMessage({ type: 'cancelRequest', requestId: tab.id });
      updateTab(tab.id, { loading: false });
      return;
    }

    updateTab(tab.id, { loading: true, response: null, responseError: null });

    vscode.postMessage({
      type: 'sendRequest',
      requestId: tab.id,
      payload: {
        id: tab.id,
        name: tab.name,
        method: tab.method,
        url: tab.url.trim(),
        params: tab.params.filter((p) => p.key),
        headers: tab.headers.filter((h) => h.key),
        body: tab.body,
        auth: tab.auth,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSend();
    }
  };

  function buildSaveRequest() {
    let saveUrl = tab!.url.trim();
    const existingParams = tab!.params.filter((p) => p.key);
    const mergedParams = [...existingParams];
    try {
      const urlObj = new URL(saveUrl.startsWith('http') ? saveUrl : 'http://' + saveUrl);
      urlObj.searchParams.forEach((value, key) => {
        if (!mergedParams.find((p) => p.key === key)) {
          mergedParams.push({ key, value, enabled: true });
        }
      });
      if (urlObj.searchParams.toString()) {
        urlObj.search = '';
        saveUrl = urlObj.toString();
      }
    } catch { /* invalid URL, keep as-is */ }
    return {
      id: tab!.id,
      name: tab!.isCustomNamed ? tab!.name : (tab!.url ? `${tab!.method} ${tab!.url}` : tab!.name),
      method: tab!.method,
      url: saveUrl,
      params: mergedParams,
      headers: tab!.headers.filter((h) => h.key),
      body: tab!.body,
      auth: tab!.auth,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function handleDirectSave() {
    if (!tab?.collectionId) return;
    vscode.postMessage({
      type: 'updateCollectionRequest',
      payload: { collectionId: tab.collectionId, request: buildSaveRequest() },
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  function handleSaveAs(collectionId: string, folderId?: string) {
    if (!tab) return;
    const newId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const req = { ...buildSaveRequest(), id: newId };
    vscode.postMessage({
      type: 'saveToCollection',
      payload: { collectionId, folderId, request: req },
    });
    setSaveStatus('saved');
    setShowSaveDropdown(false);
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  return (
    <div className="url-bar">
      <select
        className={`method-select ${METHOD_CLASSES[tab.method]}`}
        value={tab.method}
        onChange={(e) => updateTab(tab.id, { method: e.target.value as HttpMethod })}
      >
        {METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <input
        className="url-input"
        type="text"
        placeholder="Enter request URL (e.g. https://api.example.com/users)"
        value={tab.url}
        onChange={(e) => updateTab(tab.id, { url: e.target.value })}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />

      <button
        className={`send-btn ${tab.loading ? 'cancel' : ''}`}
        onClick={handleSend}
        disabled={!tab.url.trim() && !tab.loading}
      >
        {tab.loading ? 'Cancel' : 'Send'}
      </button>

      {/* Save: update existing collection item (only when opened from a bookmark) */}
      {tab.collectionId && (
        <button
          className={`save-btn ${saveStatus === 'saved' ? 'saved' : ''}`}
          onClick={handleDirectSave}
          title="Save (update bookmark)"
          disabled={!tab.url.trim()}
        >
          {saveStatus === 'saved' ? '✓ Saved' : '💾 Save'}
        </button>
      )}

      {/* Save As: always available, picks collection */}
      <div className="save-wrap" ref={saveDropdownRef}>
        <button
          className="save-btn"
          onClick={() => { setShowSaveDropdown((v) => !v); }}
          title="Save As — add to a collection"
          disabled={!tab.url.trim()}
        >
          {tab.collectionId ? '📋 Save As' : '💾 Save As'}
        </button>

        {showSaveDropdown && (
          <div className="save-dropdown">
            {collections.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 12, opacity: 0.6 }}>
                No collections. Create one in the sidebar.
              </div>
            ) : (
              collections.map((col) => (
                <SaveColTree
                  key={col.id}
                  col={col}
                  onSave={(collectionId, folderId) => handleSaveAs(collectionId, folderId)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
