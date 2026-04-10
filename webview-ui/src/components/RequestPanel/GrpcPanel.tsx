import { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { GrpcMessage } from '../../stores/requestStore';
import { useI18n } from '../../i18n';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

const MAX_DISPLAY = 500;

const STATUS_COLOR: Record<string, string> = {
  idle: 'var(--panel-fg)',
  connecting: 'var(--vscode-terminal-ansiYellow, #dcdcaa)',
  streaming: 'var(--vscode-terminal-ansiGreen, #4ec9b0)',
  done: 'var(--vscode-terminal-ansiBlue, #569cd6)',
  error: 'var(--vscode-errorForeground, #f48771)',
};

const STATUS_DOT: Record<string, string> = {
  idle: '○',
  connecting: '◌',
  streaming: '●',
  done: '◉',
  error: '✕',
};

export function GrpcPanel() {
  const { getActiveTab, updateTab } = useTabStore();
  const tab = getActiveTab();
  const t = useI18n();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tab?.grpcMessages?.length, autoScroll]);

  if (!tab) return null;

  const messages: GrpcMessage[] = tab.grpcMessages ?? [];
  const status = tab.grpcStatus ?? 'idle';
  const isStreaming = status === 'streaming';
  const isConnecting = status === 'connecting';
  const duration = tab.grpcCallStartedAt ? Date.now() - tab.grpcCallStartedAt : 0;
  const sent = messages.filter((m) => m.direction === 'sent').length;
  const received = messages.filter((m) => m.direction === 'received' && !m.isEnd).length;
  const displayed = messages.slice(-MAX_DISPLAY);
  const truncated = messages.length > MAX_DISPLAY;

  const opts = tab.grpcOptions ?? {};
  const callTypeLabel = (() => {
    const svc = tab.grpcServices?.find((s) => s.name === opts.serviceName);
    const m = svc?.methods.find((m) => m.name === opts.methodName);
    if (!m) return null;
    if (m.requestStream && m.responseStream) return t('grpcCallTypeBidi');
    if (m.requestStream) return t('grpcCallTypeClient');
    if (m.responseStream) return t('grpcCallTypeServer');
    return t('grpcCallTypeUnary');
  })();

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClear() {
    updateTab(tab!.id, { grpcMessages: [] });
  }

  const noServiceSelected = !opts.serviceName || !opts.methodName;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 13 }}>

      {/* ── Status Bar ──────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '5px 12px',
        borderBottom: '1px solid var(--border-color, #444)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <span style={{ color: STATUS_COLOR[status] ?? 'var(--panel-fg)', fontWeight: 600, fontSize: 14 }}>
          {STATUS_DOT[status] ?? '○'}
        </span>
        <span style={{ color: STATUS_COLOR[status] ?? 'var(--panel-fg)', fontWeight: 600 }}>
          {t((`grpcStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`) as Parameters<typeof t>[0]) ?? status}
        </span>
        {callTypeLabel && (
          <span style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 8,
            background: 'var(--vscode-terminal-ansiBlue, #569cd6)',
            color: '#fff',
            opacity: 0.85,
          }}>
            {callTypeLabel}
          </span>
        )}
        {opts.serviceName && opts.methodName && (
          <span style={{ opacity: 0.65, fontSize: 11, fontFamily: 'monospace' }}>
            {opts.serviceName.split('.').pop()}/{opts.methodName}
          </span>
        )}
        {duration > 0 && (isStreaming || status === 'done' || status === 'error') && (
          <span style={{ opacity: 0.55, fontSize: 11 }}>{formatDuration(duration)}</span>
        )}
        <span style={{ opacity: 0.6, fontSize: 11 }}>↑{sent} ↓{received}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setAutoScroll((v) => !v)}
            title="Toggle auto-scroll"
            style={{
              fontSize: 11,
              background: 'none',
              border: '1px solid var(--border-color, #555)',
              borderRadius: 3,
              padding: '2px 7px',
              cursor: 'pointer',
              opacity: autoScroll ? 1 : 0.45,
              color: 'var(--panel-fg)',
            }}
          >
            {t('grpcAutoScroll')}
          </button>
          <button
            onClick={handleClear}
            style={{
              fontSize: 11,
              background: 'none',
              border: '1px solid var(--border-color, #555)',
              borderRadius: 3,
              padding: '2px 7px',
              cursor: 'pointer',
              color: 'var(--panel-fg)',
            }}
          >
            {t('grpcClear')}
          </button>
        </div>
      </div>

      {/* ── No service selected hint ─────────────────────── */}
      {noServiceSelected && (
        <div style={{
          padding: '12px 14px',
          fontSize: 12,
          opacity: 0.55,
          fontStyle: 'italic',
          borderBottom: '1px solid var(--border-color, #444)',
          flexShrink: 0,
        }}>
          {t('grpcNoServiceHint')}
        </div>
      )}

      {/* ── Error banner (when status is error and no messages) ─── */}
      {status === 'error' && tab.responseError && messages.length === 0 && (
        <div style={{
          padding: '8px 14px',
          fontSize: 12,
          color: 'var(--vscode-errorForeground, #f48771)',
          borderBottom: '1px solid var(--border-color, #444)',
          flexShrink: 0,
          fontFamily: 'monospace',
        }}>
          {tab.responseError}
        </div>
      )}

      {/* ── Message Log ─────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {truncated && (
          <div style={{ padding: '4px 12px', fontSize: 11, opacity: 0.5, textAlign: 'center' }}>
            (showing last {MAX_DISPLAY} of {messages.length} messages)
          </div>
        )}
        {displayed.map((msg) => {
          const isSent = msg.direction === 'sent';
          const isExpanded = expandedIds.has(msg.id);
          const isEndMarker = msg.isEnd && !msg.data;

          if (isEndMarker) {
            return (
              <div
                key={msg.id}
                style={{
                  padding: '3px 12px',
                  fontSize: 11,
                  opacity: 0.45,
                  fontStyle: 'italic',
                }}
              >
                {t('grpcStreamEndedMarker')}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              style={{
                padding: '5px 12px',
                borderBottom: '1px solid var(--border-color, #333)',
                cursor: 'pointer',
              }}
              onClick={() => toggleExpand(msg.id)}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: msg.isError
                    ? 'var(--vscode-errorForeground, #f48771)'
                    : isSent
                      ? 'var(--vscode-terminal-ansiBlue, #569cd6)'
                      : 'var(--vscode-terminal-ansiGreen, #4ec9b0)',
                }}>
                  {msg.isError ? '✕ ERR' : isSent ? '↑ REQ' : '↓ RES'}
                </span>
                <span style={{ fontSize: 11, opacity: 0.5 }}>{formatTime(msg.timestamp)}</span>
                {msg.isEnd && !isEndMarker && (
                  <span style={{ fontSize: 10, opacity: 0.55, fontStyle: 'italic' }}>(final)</span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.4 }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
              {isExpanded ? (
                <pre style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontFamily: 'var(--vscode-editor-font-family, monospace)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowX: 'auto',
                  color: msg.isError ? 'var(--vscode-errorForeground, #f48771)' : 'var(--panel-fg)',
                  background: 'var(--input-bg, #2d2d2d)',
                  padding: '6px 8px',
                  borderRadius: 3,
                }}>
                  {msg.data || (msg.errorMessage ?? '')}
                </pre>
              ) : (
                <div style={{
                  fontSize: 11,
                  opacity: 0.65,
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: 2,
                  color: msg.isError ? 'var(--vscode-errorForeground, #f48771)' : undefined,
                }}>
                  {msg.isError ? (msg.errorMessage ?? msg.data) : msg.data.replace(/\s+/g, ' ').substring(0, 120)}
                </div>
              )}
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>

    </div>
  );
}
