import { useState, useRef, useEffect, useMemo } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { HttpMethod, Protocol } from '../../stores/requestStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { vscode } from '../../vscode';
import { useEnvironments } from '../../hooks/useEnvironments';
import { renderVarHighlight } from '../../utils/varHighlight';
import { useI18n } from '../../i18n';

const DEFAULT_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

const METHOD_CLASSES: Record<string, string> = {
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

/** Thin alias — delegates to the shared renderVarHighlight utility. */
const renderHighlightedUrl = renderVarHighlight;

export function UrlBar() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const t = useI18n();
  const customHttpMethods = useSettingsStore((s) => s.customHttpMethods);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [collections, setCollections] = useState<CollectionBrief[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const saveDropdownRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [varSuggestions, setVarSuggestions] = useState<{ key: string; value: string }[]>([]);
  const [showVarDropdown, setShowVarDropdown] = useState(false);
  const [varActiveIdx, setVarActiveIdx] = useState(-1);
  const { environments, activeEnvId } = useEnvironments();
  const tab = tabs.find((t) => t.id === activeTabId);

  const activeEnvVars = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId);
    return (env?.variables ?? []).filter((v) => v.enabled);
  }, [environments, activeEnvId]);

  const knownVarNames = useMemo(
    () => new Set(activeEnvVars.map((v) => v.key)),
    [activeEnvVars]
  );

  const varValues = useMemo(
    () => new Map(activeEnvVars.map((v) => [v.key, v.value])),
    [activeEnvVars]
  );

  const urlHighlightRef = useRef<HTMLDivElement>(null);

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

  // Sync horizontal scroll of backing highlight layer with the visible input
  useEffect(() => {
    const input = urlInputRef.current;
    const bg = urlHighlightRef.current;
    if (!input || !bg) return;
    const onScroll = () => { bg.scrollLeft = input.scrollLeft; };
    input.addEventListener('scroll', onScroll);
    return () => input.removeEventListener('scroll', onScroll);
  });

  if (!tab) return null;

  const isWsMode = tab.protocol === 'websocket';
  const isSseMode = tab.protocol === 'sse';

  const handleWsToggle = () => {
    if (!tab.url.trim()) return;

    if (tab.wsStatus === 'connected' || tab.wsStatus === 'connecting') {
      // Disconnect
      if (tab.wsConnectionId) {
        vscode.postMessage({ type: 'wsDisconnect', payload: { connectionId: tab.wsConnectionId } });
      }
      updateTab(tab.id, { wsStatus: 'disconnected', wsConnectionId: undefined, loading: false });
      return;
    }

    // Connect
    updateTab(tab.id, { loading: true, wsMessages: [], responseError: null });
    vscode.postMessage({
      type: 'wsConnect',
      tabId: tab.id,
      payload: {
        id: tab.id,
        name: tab.name,
        protocol: tab.protocol,
        method: tab.method,
        url: tab.url.trim(),
        params: tab.params.filter((p) => p.key),
        headers: tab.headers.filter((h) => h.key),
        body: tab.body,
        auth: tab.auth,
        preScript: tab.preScript,
        postScript: tab.postScript,
        sslVerify: tab.sslVerify ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  };

  const handleSseToggle = () => {
    if (!tab.url.trim()) return;

    if (tab.sseStatus === 'connected' || tab.sseStatus === 'connecting') {
      // Disconnect
      if (tab.sseConnectionId) {
        vscode.postMessage({ type: 'sseDisconnect', payload: { connectionId: tab.sseConnectionId } });
      }
      updateTab(tab.id, { sseStatus: 'disconnected', sseConnectionId: undefined, loading: false });
      return;
    }

    // Connect
    updateTab(tab.id, { loading: true, sseEvents: [], responseError: null });
    vscode.postMessage({
      type: 'sseConnect',
      tabId: tab.id,
      payload: {
        id: tab.id,
        name: tab.name,
        protocol: tab.protocol,
        method: 'GET',
        url: tab.url.trim(),
        params: tab.params.filter((p) => p.key),
        headers: tab.headers.filter((h) => h.key),
        body: { type: 'none' },
        auth: tab.auth,
        preScript: undefined,
        postScript: undefined,
        sslVerify: tab.sslVerify ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  };

  const handleSend = () => {
    if (!tab.url.trim()) return;

    if (isWsMode) {
      handleWsToggle();
      return;
    }

    if (isSseMode) {
      handleSseToggle();
      return;
    }

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
        preScript: tab.preScript,
        postScript: tab.postScript,
        sslVerify: tab.sslVerify ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    const updates: Parameters<typeof updateTab>[1] = { url: newUrl };

    // Auto-detect WebSocket URLs
    const lower = newUrl.toLowerCase();
    if (lower.startsWith('ws://') || lower.startsWith('wss://')) {
      if (!tab.protocol || tab.protocol === 'http') {
        updates.protocol = 'websocket';
      }
    } else if (lower.startsWith('http://') || lower.startsWith('https://')) {
      if (tab.protocol === 'websocket') {
        updates.protocol = 'http';
      }
    }

    updateTab(tab.id, updates);
    const cursorPos = e.target.selectionStart ?? newUrl.length;
    const beforeCursor = newUrl.substring(0, cursorPos);
    const match = beforeCursor.match(/\{\{([^}]*)$/);
    if (match) {
      const partial = match[1].toLowerCase();
      const filtered = activeEnvVars.filter((v) =>
        v.key.toLowerCase().startsWith(partial)
      );
      setVarSuggestions(filtered);
      setShowVarDropdown(filtered.length > 0);
      setVarActiveIdx(-1);
    } else {
      setShowVarDropdown(false);
    }
  };

  const handleVarSelect = (varKey: string) => {
    const input = urlInputRef.current;
    if (!input) return;
    const url = tab.url;
    const cursorPos = input.selectionStart ?? url.length;
    const beforeCursor = url.substring(0, cursorPos);
    const match = beforeCursor.match(/\{\{([^}]*)$/);
    if (!match) return;
    const startIdx = cursorPos - match[0].length;
    const insertion = '{{' + varKey + '}}';
    const newUrl = url.substring(0, startIdx) + insertion + url.substring(cursorPos);
    updateTab(tab.id, { url: newUrl });
    setShowVarDropdown(false);
    const newCursor = startIdx + insertion.length;
    setTimeout(() => {
      input.setSelectionRange(newCursor, newCursor);
      input.focus();
    }, 0);
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSend();
      return;
    }
    if (!showVarDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setVarActiveIdx((prev) => Math.min(prev + 1, varSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setVarActiveIdx((prev) => Math.max(prev - 1, 0));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && varActiveIdx >= 0) {
      e.preventDefault();
      handleVarSelect(varSuggestions[varActiveIdx].key);
    } else if (e.key === 'Escape') {
      setShowVarDropdown(false);
      setVarActiveIdx(-1);
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
      name: tab!.isCustomNamed
        ? tab!.name
        : (tab!.url
            ? (tab!.protocol === 'websocket'
                ? `WS ${tab!.url}`
                : tab!.protocol === 'sse'
                  ? `SSE ${tab!.url}`
                  : `${tab!.method} ${tab!.url}`)
            : tab!.name),
      protocol: tab!.protocol,
      method: tab!.method,
      url: saveUrl,
      params: mergedParams,
      headers: tab!.headers.filter((h) => h.key),
      body: tab!.body,
      auth: tab!.auth,
      preScript: tab!.preScript,
      postScript: tab!.postScript,
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
    // Reset dirty flag after successful save
    updateTab(tab.id, { isDirty: false });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  function handleSaveAs(collectionId: string, folderId?: string) {
    if (!tab) return;
    const req = buildSaveRequest(); // uses tab.id — keeps collection request id in sync with the tab id
    vscode.postMessage({
      type: 'saveToCollection',
      payload: { collectionId, folderId, request: req },
    });
    // Update the tab so that it is now bound to this collection, and clear dirty flag
    updateTab(tab.id, { collectionId, isDirty: false });
    setSaveStatus('saved');
    setShowSaveDropdown(false);
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  return (
    <div className="url-bar">
      {/* Protocol selector */}
      <select
        value={tab.protocol ?? 'http'}
        onChange={(e) => {
          const p = e.target.value as Protocol;
          updateTab(tab.id, { protocol: p });
        }}
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: '4px 6px',
          borderRadius: '4px 0 0 4px',
          border: '1px solid var(--border-color, #555)',
          background: 'var(--input-bg, #3c3c3c)',
          color: tab.protocol === 'websocket'
            ? 'var(--vscode-terminal-ansiCyan, #4ec9b0)'
            : tab.protocol === 'sse'
              ? 'var(--vscode-terminal-ansiYellow, #dcdcaa)'
              : 'var(--panel-fg)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <option value="http">HTTP</option>
        <option value="websocket">WS</option>
        <option value="sse">SSE</option>
      </select>

      {/* Method selector + URL input: connected group, no gap between them */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {/* Method selector — hidden in WS or SSE mode */}
        {!isWsMode && !isSseMode && (
        <select
          className={`method-select ${METHOD_CLASSES[tab.method] || 'method-get'}`}
          value={tab.method}
          onChange={(e) => {
            updateTab(tab.id, { method: e.target.value as HttpMethod });
          }}
        >
          {DEFAULT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {/* Custom methods from VS Code settings */}
          {customHttpMethods.filter((m) => !DEFAULT_METHODS.includes(m as HttpMethod)).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {/* Show current method if it's not in default or settings list (legacy tabs) */}
          {!DEFAULT_METHODS.includes(tab.method as any) &&
            !customHttpMethods.includes(tab.method) &&
            (tab.method as string) !== '__custom__' && (
            <option key={tab.method} value={tab.method}>
              {tab.method}
            </option>
          )}
        </select>
        )}

        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          {/* Highlight backing layer: only active when URL contains {{vars}} */}
          {tab.url.includes('{{') && (
            <div
              ref={urlHighlightRef}
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                padding: '6px 10px',
                fontSize: '13px',
                lineHeight: '1.4',
                whiteSpace: 'pre',
                overflow: 'hidden',
                pointerEvents: 'none',
                background: 'var(--input-bg, #3c3c3c)',
                border: '1px solid transparent',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                zIndex: 0,
                color: 'var(--input-fg, #cccccc)',
              }}
            >
              {renderHighlightedUrl(tab.url, knownVarNames, varValues)}
            </div>
          )}
          <input
            ref={urlInputRef}
            className="url-input"
            type="text"
            placeholder={isWsMode ? 'Enter WebSocket URL (e.g. ws://localhost:3456/ws)' : isSseMode ? 'Enter SSE URL (e.g. http://localhost:3458/sse)' : 'Enter request URL (e.g. https://api.example.com/users)'}
            value={tab.url}
            onChange={handleUrlChange}
            onKeyDown={handleUrlKeyDown}
            onBlur={() => setTimeout(() => setShowVarDropdown(false), 150)}
            spellCheck={false}
            style={{
              width: '100%',
              position: 'relative',
              zIndex: 1,
              ...(tab.url.includes('{{')
                ? { color: 'transparent', caretColor: 'var(--input-fg, #cccccc)', background: 'transparent' }
                : {}),
            }}
          />
          {showVarDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 200,
                marginTop: 2,
                maxHeight: 220,
                overflowY: 'auto',
                background: 'var(--vscode-editorSuggestWidget-background, var(--input-bg))',
                border: '1px solid var(--vscode-editorSuggestWidget-border, var(--border-color))',
                borderRadius: 3,
                boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
              }}
            >
              {varSuggestions.map((v, idx) => (
                <div
                  key={v.key}
                  onMouseDown={(e) => { e.preventDefault(); handleVarSelect(v.key); }}
                  onMouseEnter={() => setVarActiveIdx(idx)}
                  style={{
                    padding: '5px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    background: idx === varActiveIdx
                      ? 'var(--vscode-list-activeSelectionBackground, #094771)'
                      : 'transparent',
                    color: idx === varActiveIdx
                      ? 'var(--vscode-list-activeSelectionForeground, #fff)'
                      : 'var(--panel-fg)',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{'{{'}{v.key}{'}}'}</span>
                  {v.value && (
                    <span style={{ opacity: 0.55, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        className={`send-btn ${(tab.loading || tab.wsStatus === 'connected' || tab.sseStatus === 'connected') ? 'cancel' : ''}`}
        onClick={handleSend}
        disabled={!tab.url.trim() && !tab.loading && tab.wsStatus !== 'connected' && tab.sseStatus !== 'connected'}
      >
        {isWsMode
          ? tab.wsStatus === 'connected'
            ? 'Disconnect'
            : tab.wsStatus === 'connecting' || tab.loading
              ? 'Connecting…'
              : 'Connect'
          : isSseMode
            ? tab.sseStatus === 'connected'
              ? 'Disconnect'
              : tab.sseStatus === 'connecting' || tab.loading
                ? 'Connecting…'
                : 'Connect'
            : tab.loading
              ? t('urlCancel')
              : t('urlSend')}
      </button>

      {/* SSL verify toggle — only meaningful for HTTPS (not WS or SSE mode) */}
      {!isWsMode && !isSseMode && tab.url.trim().toLowerCase().startsWith('https') && (
        <button
          className="ssl-toggle-btn"
          title={(tab.sslVerify ?? true) ? t('urlSslVerifyOn') : t('urlSslVerifyOff')}
          onClick={() => updateTab(tab.id, { sslVerify: !(tab.sslVerify ?? true) })}
          style={{
            background: 'none',
            border: '1px solid var(--border-color, #555)',
            borderRadius: 4,
            cursor: 'pointer',
            padding: '4px 7px',
            fontSize: 14,
            lineHeight: 1,
            opacity: (tab.sslVerify ?? true) ? 1 : 0.6,
            color: (tab.sslVerify ?? true) ? 'var(--vscode-terminal-ansiGreen, #4ec9b0)' : 'var(--vscode-errorForeground, #f48771)',
          }}
        >
          {(tab.sslVerify ?? true) ? '🔒' : '🔓'}
        </button>
      )}

      {/* Save: update existing collection item — only when bound to a collection AND there are unsaved changes */}
      {tab.collectionId && tab.isDirty && (
        <button
          className={`save-btn ${saveStatus === 'saved' ? 'saved' : ''}`}
          onClick={handleDirectSave}
          title={t('urlSaveTitleUpdate')}
          disabled={!tab.url.trim()}
        >
          {saveStatus === 'saved' ? t('urlSavedBtn') : t('urlSaveBtn')}
        </button>
      )}

      {/* Save As: always available, picks collection */}
      <div className="save-wrap" ref={saveDropdownRef}>
        <button
          className="save-btn"
          onClick={() => { setShowSaveDropdown((v) => !v); }}
          title={t('urlSaveTitleAs')}
          disabled={!tab.url.trim()}
        >
          {tab.collectionId ? t('urlSaveAsBtn') : t('urlSaveNewBtn')}
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
