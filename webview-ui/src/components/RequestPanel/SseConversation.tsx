import { useRef, useEffect, useState, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { SseEvent } from '../../stores/requestStore';
import { useI18n } from '../../i18n';
import { formatTime, formatDuration, formatBytes } from '../../utils/formatters';
import { CONNECTION_STATUS_COLORS } from '../../utils/protocolColors';
import { TruncatedText } from '../shared/TruncatedText';

const EventRow = memo(function EventRow({ evt }: { evt: SseEvent }) {
  return (
    <div className="conv-row">
      {/* Arrow */}
      <span className="conv-arrow conv-arrow-received">↓</span>

      {/* Timestamp */}
      <span className="conv-timestamp">{formatTime(evt.timestamp)}</span>

      {/* Event type badge (only if non-default) */}
      {evt.event !== 'message' && (
        <span className="conv-badge conv-badge-event">{evt.event}</span>
      )}

      {/* Event ID badge */}
      {evt.eventId && (
        <span className="conv-badge conv-badge-id">id:{evt.eventId}</span>
      )}

      {/* Content */}
      <TruncatedText text={evt.data} />

      {/* Size */}
      <span className="conv-size">
        {formatBytes(evt.size)}
      </span>
    </div>
  );
});

export function SseConversation() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
  const t = useI18n();
  const [tick, setTick] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const eventCount = (tab?.sseEvents ?? []).length;

  const virtualizer = useVirtualizer({
    count: eventCount,
    getScrollElement: () => listRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Tick every second to update connection duration display
  useEffect(() => {
    if (tab?.sseStatus !== 'connected') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [tab?.sseStatus]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!autoScroll || eventCount === 0) return;
    virtualizer.scrollToIndex(eventCount - 1, { align: 'end' });
  }, [eventCount, autoScroll]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tab) return null;

  void tick; // suppress unused warning — used to re-render timer

  const events = tab.sseEvents ?? [];
  const isConnected = tab.sseStatus === 'connected';
  const isError = tab.sseStatus === 'error';

  const handleClear = () => {
    updateTab(tab.id, { sseEvents: [] });
  };

  const statusKey = (tab.sseStatus ?? 'disconnected') as 'connected' | 'connecting' | 'disconnected' | 'error';
  const statusLabelMap = {
    connected: t('sseStatusConnected'),
    connecting: t('sseStatusConnecting'),
    disconnected: t('sseStatusDisconnected'),
    error: t('sseStatusError'),
  };
  const statusLabel = statusLabelMap[statusKey] ?? statusKey;

  const statusColor = CONNECTION_STATUS_COLORS;

  return (
    <div className="conv-container">
      {/* Status bar */}
      <div className="conv-status-bar">
        <span className="conv-status-label" style={{ color: statusColor[statusKey] }}>
          <span className="conv-status-dot" style={{ background: statusColor[statusKey] }} />
          {statusLabel}
        </span>

        {isConnected && tab.sseConnectedAt && (
          <span className="conv-status-dim">{formatDuration(tab.sseConnectedAt)}</span>
        )}

        <span className="conv-status-dim">↓{events.length} events</span>

        <div className="flex-row ml-auto gap-6">
          <button
            onClick={() => setAutoScroll((v) => !v)}
            title="Toggle auto-scroll"
            className="conv-action-btn"
            style={{ opacity: autoScroll ? 1 : 0.45 }}
          >
            {t('sseAutoScroll')}
          </button>
          <button onClick={handleClear} className="conv-action-btn" disabled={!events.length}>
            {t('sseClear')}
          </button>
        </div>
      </div>

      {/* Error detail banner */}
      {isError && tab.responseError && (
        <div className="border-b mono-text" style={{
          padding: '6px 12px',
          fontSize: 12,
          color: 'var(--vscode-errorForeground, #f48771)',
          flexShrink: 0,
          background: 'var(--panel-bg)',
        }}>
          {tab.responseError}
        </div>
      )}

      {/* Event list */}
      <div ref={listRef} className="conv-list">
        {events.length === 0 ? (
          <div className="conv-empty">
            {isConnected ? t('sseWaiting') : t('sseNotConnected')}
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const evt = events[virtualRow.index];
              return (
                <div
                  key={evt.id}
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
                  <EventRow evt={evt} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
