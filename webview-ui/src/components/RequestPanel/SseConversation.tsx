import { useRef, useEffect, useState, useCallback } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { SseEvent } from '../../stores/requestStore';

const TRUNCATE_LEN = 500;

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

function formatDuration(startMs: number): string {
  const secs = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function EventRow({ evt }: { evt: SseEvent }) {
  const needsTruncate = evt.data.length > TRUNCATE_LEN;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(evt.data).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [evt.data]);

  const shownText = needsTruncate && !expanded ? evt.data.slice(0, TRUNCATE_LEN) : evt.data;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '4px 10px',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--border-color, #3c3c3c)',
      }}
    >
      {/* Arrow */}
      <span
        style={{
          flexShrink: 0,
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--vscode-terminal-ansiYellow, #dcdcaa)',
          width: 14,
          paddingTop: 1,
        }}
      >
        ↓
      </span>

      {/* Timestamp */}
      <span style={{ flexShrink: 0, fontSize: 11, opacity: 0.5, paddingTop: 2, width: 66 }}>
        {formatTime(evt.timestamp)}
      </span>

      {/* Event type badge (only if non-default) */}
      {evt.event !== 'message' && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            padding: '1px 5px',
            borderRadius: 3,
            background: 'var(--vscode-terminal-ansiBlue, #569cd6)',
            color: '#fff',
            marginTop: 2,
          }}
        >
          {evt.event}
        </span>
      )}

      {/* Event ID badge */}
      {evt.eventId && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            padding: '1px 5px',
            borderRadius: 3,
            background: 'var(--badge-bg, #555)',
            color: 'var(--badge-fg, #ccc)',
            marginTop: 2,
          }}
        >
          id:{evt.eventId}
        </span>
      )}

      {/* Content */}
      <span
        style={{
          fontFamily: 'var(--vscode-editor-font-family, monospace)',
          fontSize: 12,
          flex: 1,
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
          opacity: 0.95,
        }}
      >
        {shownText}
        {needsTruncate && !expanded && (
          <span
            onClick={() => setExpanded(true)}
            style={{ color: 'var(--vscode-textLink-foreground, #3794ff)', cursor: 'pointer', marginLeft: 4 }}
          >
            …more
          </span>
        )}
        {needsTruncate && expanded && (
          <span
            onClick={() => setExpanded(false)}
            style={{ color: 'var(--vscode-textLink-foreground, #3794ff)', cursor: 'pointer', marginLeft: 4 }}
          >
            {' '}collapse
          </span>
        )}
      </span>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        title="Copy"
        style={{
          flexShrink: 0,
          fontSize: 11,
          padding: '1px 6px',
          background: 'none',
          border: '1px solid var(--border-color)',
          borderRadius: 3,
          cursor: 'pointer',
          color: copied ? 'var(--vscode-terminal-ansiGreen, #4ec9b0)' : 'var(--panel-fg)',
          opacity: 0.6,
        }}
      >
        {copied ? '✓' : 'copy'}
      </button>

      {/* Size */}
      <span style={{ flexShrink: 0, fontSize: 10, opacity: 0.4, paddingTop: 2 }}>
        {evt.size < 1024 ? `${evt.size}B` : `${(evt.size / 1024).toFixed(1)}KB`}
      </span>
    </div>
  );
}

export function SseConversation() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);
  const [tick, setTick] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Tick every second to update connection duration display
  useEffect(() => {
    if (tab?.sseStatus !== 'connected') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [tab?.sseStatus]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tab?.sseEvents?.length]);

  if (!tab) return null;

  void tick; // suppress unused warning — used to re-render timer

  const events = tab.sseEvents ?? [];
  const isConnected = tab.sseStatus === 'connected';

  const handleClear = () => {
    updateTab(tab.id, { sseEvents: [] });
  };

  const statusColor: Record<string, string> = {
    connected: 'var(--vscode-terminal-ansiGreen, #4ec9b0)',
    connecting: 'var(--vscode-terminal-ansiYellow, #dcdcaa)',
    disconnected: 'var(--panel-fg)',
    error: 'var(--vscode-errorForeground, #f48771)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Status bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '4px 12px',
          borderBottom: '1px solid var(--border-color)',
          fontSize: 12,
          flexShrink: 0,
          background: 'var(--panel-bg)',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontWeight: 600,
            color: statusColor[tab.sseStatus ?? 'disconnected'],
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor[tab.sseStatus ?? 'disconnected'],
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          {(tab.sseStatus ?? 'disconnected').charAt(0).toUpperCase() + (tab.sseStatus ?? 'disconnected').slice(1)}
        </span>

        {isConnected && tab.sseConnectedAt && (
          <span style={{ opacity: 0.55 }}>{formatDuration(tab.sseConnectedAt)}</span>
        )}

        <span style={{ opacity: 0.55 }}>↓{events.length} events</span>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleClear}
          style={{
            fontSize: 11,
            padding: '2px 7px',
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            cursor: 'pointer',
            color: 'var(--panel-fg)',
            opacity: events.length ? 0.7 : 0.3,
          }}
          disabled={!events.length}
        >
          Clear
        </button>
      </div>

      {/* Event list */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          background: 'var(--panel-bg)',
        }}
      >
        {events.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              opacity: 0.35,
              fontSize: 13,
              userSelect: 'none',
            }}
          >
            {isConnected ? 'Connected. Waiting for events…' : 'Not connected. Use Connect above.'}
          </div>
        ) : (
          events.map((evt) => <EventRow key={evt.id} evt={evt} />)
        )}
      </div>
    </div>
  );
}
