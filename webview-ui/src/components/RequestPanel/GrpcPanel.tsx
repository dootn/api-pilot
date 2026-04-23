import { useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { GrpcMessage } from '../../stores/requestStore';
import { useI18n, type TranslationKey } from '../../i18n';
import { formatTime, formatDurationMs } from '../../utils/formatters';
import { GRPC_STATUS_COLORS } from '../../utils/protocolColors';
import { MAX_DISPLAY_MESSAGES } from '../../utils/constants';

const STATUS_DOT: Record<string, string> = {
  idle: '○',
  connecting: '◌',
  streaming: '●',
  done: '◉',
  error: '✕',
};

export function GrpcPanel() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
  const t = useI18n();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  if (!tab) return null;

  const messages: GrpcMessage[] = tab.grpcMessages ?? [];
  const status = tab.grpcStatus ?? 'idle';
  const isStreaming = status === 'streaming';
  const durationMs = tab.grpcCallStartedAt ? Date.now() - tab.grpcCallStartedAt : 0;
  const sent = messages.filter((m) => m.direction === 'sent').length;
  const received = messages.filter((m) => m.direction === 'received' && !m.isEnd).length;
  const displayed = messages.slice(-MAX_DISPLAY_MESSAGES);
  const truncated = messages.length > MAX_DISPLAY_MESSAGES;

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
    <div className="conv-container">

      {/* ── Status Bar ──────────────────────────────────── */}
      <div className="conv-status-bar">
        <span className="grpc-status-icon" style={{ color: GRPC_STATUS_COLORS[status] ?? 'var(--panel-fg)' }}>
          {STATUS_DOT[status] ?? '○'}
        </span>
        <span style={{ color: GRPC_STATUS_COLORS[status] ?? 'var(--panel-fg)', fontWeight: 600 }}>
          {t((`grpcStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`) as Parameters<typeof t>[0]) ?? status}
        </span>
        {callTypeLabel && (
          <span className="conv-badge conv-badge-calltype">
            {callTypeLabel}
          </span>
        )}
        {opts.serviceName && opts.methodName && (
          <span className="grpc-method-name">
            {opts.serviceName.split('.').pop()}/{opts.methodName}
          </span>
        )}
        {durationMs > 0 && (isStreaming || status === 'done' || status === 'error') && (
          <span className="conv-status-dim">{formatDurationMs(durationMs)}</span>
        )}
        <span className="conv-status-dim">↑{sent} ↓{received}</span>
        <div className="conv-actions">
          <button
            onClick={() => setAutoScroll((v) => !v)}
            title="Toggle auto-scroll"
            className="conv-action-btn"
            style={{ opacity: autoScroll ? 1 : 0.45 }}
          >
            {t('grpcAutoScroll')}
          </button>
          <button
            onClick={handleClear}
            className="conv-action-btn"
          >
            {t('grpcClear')}
          </button>
        </div>
      </div>

      {/* ── No service selected hint ─────────────────────── */}
      {noServiceSelected && (
        <div className="grpc-hint">
          {t('grpcNoServiceHint')}
        </div>
      )}

      {/* ── Error banner (when status is error and no messages) ─── */}
      {status === 'error' && tab.responseError && messages.length === 0 && (
        <div className="grpc-error-banner">
          {tab.responseError}
        </div>
      )}

      {/* ── Message Log ─────────────────────────────────── */}
      <GrpcMessageList
        listRef={listRef}
        displayed={displayed}
        truncated={truncated}
        messages={messages}
        expandedIds={expandedIds}
        toggleExpand={toggleExpand}
        autoScroll={autoScroll}
        t={t}
      />

    </div>
  );
}

/* ── Virtualized message list sub-component ────────────── */
function GrpcMessageList({
  listRef,
  displayed,
  truncated,
  messages,
  expandedIds,
  toggleExpand,
  autoScroll,
  t,
}: {
  listRef: React.RefObject<HTMLDivElement>;
  displayed: GrpcMessage[];
  truncated: boolean;
  messages: GrpcMessage[];
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  autoScroll: boolean;
  t: (key: TranslationKey) => string;
}) {
  const virtualizer = useVirtualizer({
    count: displayed.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  useEffect(() => {
    if (!autoScroll || displayed.length === 0) return;
    virtualizer.scrollToIndex(displayed.length - 1, { align: 'end' });
  }, [displayed.length, autoScroll]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={listRef} className="conv-list" style={{ padding: '6px 0' }}>
      {truncated && (
        <div className="conv-truncated">
          (showing last {MAX_DISPLAY_MESSAGES} of {messages.length} messages)
        </div>
      )}
      {displayed.length > 0 && (
        <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const msg = displayed[virtualRow.index];
            const isSent = msg.direction === 'sent';
            const isExpanded = expandedIds.has(msg.id);
            const isEndMarker = msg.isEnd && !msg.data;

            return (
              <div
                key={msg.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isEndMarker ? (
                  <div className="grpc-end-marker">
                    {t('grpcStreamEndedMarker')}
                  </div>
                ) : (
                  <div className="grpc-msg-row">
                    <div className="grpc-msg-header">
                      <span
                        className="grpc-msg-dir"
                        style={{
                          color: msg.isError
                            ? 'var(--vscode-errorForeground, #f48771)'
                            : isSent
                              ? 'var(--vscode-terminal-ansiBlue, #569cd6)'
                              : 'var(--vscode-terminal-ansiGreen, #4ec9b0)',
                        }}
                      >
                        {msg.isError ? '✕ ERR' : isSent ? '↑ REQ' : '↓ RES'}
                      </span>
                      <span className="conv-status-dim">{formatTime(msg.timestamp)}</span>
                      {msg.isEnd && !isEndMarker && <span className="grpc-msg-final">(final)</span>}
                      <span className="grpc-msg-toggle" onClick={() => toggleExpand(msg.id)}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                    {isExpanded ? (
                      <pre
                        className="grpc-msg-expanded"
                        style={{ color: msg.isError ? 'var(--vscode-errorForeground, #f48771)' : 'var(--panel-fg)' }}
                      >
                        {msg.data || (msg.errorMessage ?? '')}
                      </pre>
                    ) : (
                      <div
                        className="grpc-msg-collapsed"
                        style={{ color: msg.isError ? 'var(--vscode-errorForeground, #f48771)' : undefined }}
                      >
                        {msg.isError ? (msg.errorMessage ?? msg.data) : msg.data.replace(/\s+/g, ' ').substring(0, 120)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
