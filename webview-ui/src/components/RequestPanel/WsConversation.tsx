import { useRef, useEffect, useState, useCallback } from 'react';
import { useTabStore } from '../../stores/tabStore';
import { vscode } from '../../vscode';
import type { WsMessage } from '../../stores/requestStore';

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

function MessageRow({ msg }: { msg: WsMessage }) {
  const isSent = msg.direction === 'sent';
  const displayText = msg.type === 'binary' ? `[binary base64: ${msg.data}]` : msg.data;
  const needsTruncate = displayText.length > TRUNCATE_LEN;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(displayText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [displayText]);

  const shownText = needsTruncate && !expanded
    ? displayText.slice(0, TRUNCATE_LEN)
    : displayText;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '4px 10px',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--border-color, #3c3c3c)',
        background: isSent ? 'var(--vscode-diffEditor-insertedLineBackground, rgba(78,201,176,0.06))' : 'transparent',
      }}
    >
      {/* Direction arrow */}
      <span
        style={{
          flexShrink: 0,
          fontWeight: 700,
          fontSize: 13,
          color: isSent
            ? 'var(--vscode-terminal-ansiCyan, #4ec9b0)'
            : 'var(--vscode-terminal-ansiYellow, #dcdcaa)',
          width: 14,
          paddingTop: 1,
        }}
      >
        {isSent ? '↑' : '↓'}
      </span>

      {/* Timestamp */}
      <span style={{ flexShrink: 0, fontSize: 11, opacity: 0.5, paddingTop: 2, width: 66 }}>
        {formatTime(msg.timestamp)}
      </span>

      {/* Binary badge */}
      {msg.type === 'binary' && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            padding: '1px 5px',
            borderRadius: 3,
            background: 'var(--vscode-terminal-ansiMagenta, #c678dd)',
            color: '#fff',
            marginTop: 2,
          }}
        >
          binary
        </span>
      )}

      {/* Content + expand/copy */}
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
        {msg.size < 1024 ? `${msg.size}B` : `${(msg.size / 1024).toFixed(1)}KB`}
      </span>
    </div>
  );
}

export function WsConversation() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);

  const [msgText, setMsgText] = useState('');
  const [msgType, setMsgType] = useState<'text' | 'binary'>('text');
  const [tick, setTick] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);

  // Tick every second to update connection duration display
  useEffect(() => {
    if (tab?.wsStatus !== 'connected') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [tab?.wsStatus]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tab?.wsMessages?.length]);

  if (!tab) return null;

  const messages = tab.wsMessages ?? [];
  const sentCount = messages.filter((m) => m.direction === 'sent').length;
  const receivedCount = messages.filter((m) => m.direction === 'received').length;
  const isConnected = tab.wsStatus === 'connected';

  const handleSend = () => {
    if (!msgText.trim() || !tab.wsConnectionId) return;
    vscode.postMessage({
      type: 'wsSend',
      payload: {
        connectionId: tab.wsConnectionId,
        msgType,
        data: msgText,
      },
    });
    setMsgText('');
  };

  const handleClear = () => {
    updateTab(tab.id, { wsMessages: [] });
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
            color: statusColor[tab.wsStatus ?? 'disconnected'],
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor[tab.wsStatus ?? 'disconnected'],
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          {(tab.wsStatus ?? 'disconnected').charAt(0).toUpperCase() + (tab.wsStatus ?? 'disconnected').slice(1)}
        </span>

        {isConnected && tab.wsConnectedAt && (
          <span style={{ opacity: 0.55 }}>
            {formatDuration(tab.wsConnectedAt)}
          </span>
        )}

        <span style={{ opacity: 0.55 }}>
          ↑{sentCount} ↓{receivedCount}
        </span>

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
            opacity: messages.length ? 0.7 : 0.3,
          }}
          disabled={!messages.length}
        >
          Clear
        </button>
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          background: 'var(--panel-bg)',
        }}
      >
        {messages.length === 0 ? (
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
            {isConnected ? 'No messages yet. Send one below.' : 'Not connected. Use Connect above.'}
          </div>
        ) : (
          messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
        )}
      </div>

      {/* Message input area */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flexShrink: 0,
          background: 'var(--panel-bg)',
        }}
      >
        {/* Toolbar: type toggle */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={msgType}
            onChange={(e) => setMsgType(e.target.value as 'text' | 'binary')}
            style={{
              fontSize: 11,
              padding: '2px 5px',
              background: 'var(--input-bg)',
              color: 'var(--panel-fg)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
            }}
          >
            <option value="text">Text</option>
            <option value="binary">Binary (Base64)</option>
          </select>
        </div>

        {/* Text area + Send button */}
        <div style={{ display: 'flex', gap: 6 }}>
          <textarea
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isConnected
                ? msgType === 'binary'
                  ? 'Enter Base64-encoded binary data…'
                  : 'Enter message (Ctrl+Enter to send)…'
                : 'Connect first to send messages'
            }
            disabled={!isConnected}
            rows={3}
            style={{
              flex: 1,
              resize: 'vertical',
              fontFamily: 'var(--vscode-editor-font-family, monospace)',
              fontSize: 12,
              padding: '5px 8px',
              background: 'var(--input-bg)',
              color: 'var(--panel-fg)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              opacity: isConnected ? 1 : 0.5,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!isConnected || !msgText.trim()}
            style={{
              alignSelf: 'flex-end',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--button-bg)',
              color: 'var(--button-fg)',
              border: 'none',
              borderRadius: 4,
              cursor: isConnected && msgText.trim() ? 'pointer' : 'not-allowed',
              opacity: isConnected && msgText.trim() ? 1 : 0.5,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
