import { useState, useRef, useEffect, useMemo } from 'react';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import { vscode } from '../../vscode';
import { useEnvironments } from '../../hooks/useEnvironments';
import { useProtocolMode } from '../../hooks/useProtocolMode';
import { renderVarHighlight } from '../../utils/varHighlight';
import { useI18n } from '../../i18n';
import { ProtocolSelector, MethodSelector } from './ProtocolSelector';
import { SaveDialog } from './SaveDialog';
import { useProtocolHandlers } from './useProtocolHandlers';
import { Input } from '../shared/ui';

/** Thin alias — delegates to the shared renderVarHighlight utility. */
const renderHighlightedUrl = renderVarHighlight;

export function UrlBar() {
  const updateTab = useTabStore((s) => s.updateTab);
  const t = useI18n();
  const [varSuggestions, setVarSuggestions] = useState<{ key: string; value: string }[]>([]);
  const [showVarDropdown, setShowVarDropdown] = useState(false);
  const [varActiveIdx, setVarActiveIdx] = useState(-1);
  const { environments, activeEnvId } = useEnvironments();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const tab = useActiveTab();
  const { isWs, isSse, isMqtt, isGrpc, isConnectionProtocol } = useProtocolMode(tab?.protocol);

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

  const { handleSend } = useProtocolHandlers(tab, updateTab, { isWs, isSse, isMqtt, isGrpc });

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    const updates: Parameters<typeof updateTab>[1] = { url: newUrl };

    // Auto-detect WebSocket URLs
    const lower = newUrl.toLowerCase();
    if (lower.startsWith('ws://') || lower.startsWith('wss://')) {
      if (!tab.protocol || tab.protocol === 'http') {
        updates.protocol = 'websocket';
      }
    } else if (lower.startsWith('mqtt://') || lower.startsWith('mqtts://')) {
      if (!tab.protocol || tab.protocol === 'http') {
        updates.protocol = 'mqtt';
      }
    } else if (lower.startsWith('grpc://') || lower.startsWith('grpcs://')) {
      if (!tab.protocol || tab.protocol === 'http') {
        updates.protocol = 'grpc';
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
        : (tab!.protocol === 'websocket' || tab!.protocol === 'sse' || tab!.protocol === 'mqtt' || tab!.protocol === 'grpc'
                ? tab!.url
                : `${tab!.method} ${tab!.url}`),
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
    updateTab(tab.id, { isDirty: false });
  }

  function handleSaveAs(collectionId: string, folderId?: string) {
    if (!tab) return;
    const req = buildSaveRequest();
    vscode.postMessage({
      type: 'saveToCollection',
      payload: { collectionId, folderId, request: req },
    });
    updateTab(tab.id, { collectionId, isDirty: false });
  }

  return (
    <div className="url-bar">
      {/* Protocol selector */}
      <ProtocolSelector
        protocol={tab.protocol}
        onChange={(p) => updateTab(tab.id, { protocol: p })}
      />

      {/* Method selector + URL input: connected group, no gap between them */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {/* Method selector — hidden in WS, SSE, MQTT, or gRPC mode */}
        {!isConnectionProtocol && (
          <MethodSelector
            method={tab.method}
            onChange={(m) => updateTab(tab.id, { method: m })}
          />
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
          <Input
            ref={urlInputRef}
            className="url-input"
            type="text"
            placeholder={isWs ? 'Enter WebSocket URL (e.g. ws://localhost:3456/ws)' : isSse ? 'Enter SSE URL (e.g. http://localhost:3458/sse)' : isMqtt ? 'Enter MQTT broker URL (e.g. mqtt://localhost:1883)' : isGrpc ? 'Enter gRPC target (e.g. grpc://localhost:50051 or host:port)' : 'Enter request URL (e.g. https://api.example.com/users)'}
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
        className={`send-btn ${(tab.loading || tab.wsStatus === 'connected' || tab.sseStatus === 'connected' || tab.mqttStatus === 'connected' || tab.grpcStatus === 'streaming') ? 'cancel' : ''}`}
        onClick={handleSend}
        disabled={!tab.url.trim() && !tab.loading && tab.wsStatus !== 'connected' && tab.sseStatus !== 'connected' && tab.mqttStatus !== 'connected' && tab.grpcStatus !== 'streaming'}
      >
        {isWs
          ? tab.wsStatus === 'connected'
            ? 'Disconnect'
            : tab.wsStatus === 'connecting' || tab.loading
              ? 'Connecting…'
              : 'Connect'
          : isSse
            ? tab.sseStatus === 'connected'
              ? 'Disconnect'
              : tab.sseStatus === 'connecting' || tab.loading
                ? 'Connecting…'
                : 'Connect'
            : isMqtt
              ? tab.mqttStatus === 'connected'
                ? 'Disconnect'
                : tab.mqttStatus === 'connecting' || tab.loading
                  ? 'Connecting…'
                  : 'Connect'
              : isGrpc
                ? tab.grpcStatus === 'streaming' || tab.grpcStatus === 'connecting'
                  ? 'Cancel'
                  : tab.loading
                    ? 'Calling…'
                    : 'Invoke'
                : tab.loading
                  ? t('urlCancel')
                  : t('urlSend')}
      </button>

      {/* SSL verify toggle — only meaningful for HTTPS (not WS, SSE, MQTT, or gRPC mode) */}
      {!isConnectionProtocol && tab.url.trim().toLowerCase().startsWith('https') && (
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

      <SaveDialog
        collectionId={tab.collectionId}
        disabled={!tab.url.trim()}
        onDirectSave={handleDirectSave}
        onSaveAs={handleSaveAs}
      />
    </div>
  );
}
