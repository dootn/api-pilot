import { useRef, useEffect, useState, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import { vscode } from '../../vscode';
import type { WsMessage } from '../../stores/requestStore';
import { formatTime, formatDuration, formatBytes } from '../../utils/formatters';
import { CONNECTION_STATUS_COLORS } from '../../utils/protocolColors';
import { Select, Textarea, Button, Option } from '../shared/ui';
import { TruncatedText } from '../shared/TruncatedText';

const MessageRow = memo(function MessageRow({ msg }: { msg: WsMessage }) {
  const isSent = msg.direction === 'sent';
  const displayText = msg.type === 'binary' ? `[binary base64: ${msg.data}]` : msg.data;

  return (
    <div className={`conv-row ${isSent ? 'conv-row-sent' : ''}`}>
      {/* Direction arrow */}
      <span className={`conv-arrow ${isSent ? 'conv-arrow-sent' : 'conv-arrow-received'}`}>
        {isSent ? '↑' : '↓'}
      </span>

      {/* Timestamp */}
      <span className="conv-timestamp">
        {formatTime(msg.timestamp)}
      </span>

      {/* Binary badge */}
      {msg.type === 'binary' && (
        <span className="conv-badge conv-badge-binary">binary</span>
      )}

      {/* Content + expand/copy */}
      <TruncatedText text={displayText} />

      {/* Size */}
      <span className="conv-size">
        {formatBytes(msg.size)}
      </span>
    </div>
  );
});

export function WsConversation() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();

  const [msgText, setMsgText] = useState('');
  const [msgType, setMsgType] = useState<'text' | 'binary'>('text');
  const [, setTick] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const messageCount = (tab?.wsMessages ?? []).length;

  const virtualizer = useVirtualizer({
    count: messageCount,
    getScrollElement: () => listRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Tick every second to update connection duration display
  useEffect(() => {
    if (tab?.wsStatus !== 'connected') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [tab?.wsStatus]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messageCount > 0) {
      virtualizer.scrollToIndex(messageCount - 1, { align: 'end' });
    }
  }, [messageCount]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const statusColor = CONNECTION_STATUS_COLORS;

  return (
    <div className="conv-container">
      {/* Status bar */}
      <div className="conv-status-bar">
        <span className="conv-status-label" style={{ color: statusColor[tab.wsStatus ?? 'disconnected'] }}>
          <span className="conv-status-dot" style={{ background: statusColor[tab.wsStatus ?? 'disconnected'] }} />
          {(tab.wsStatus ?? 'disconnected').charAt(0).toUpperCase() + (tab.wsStatus ?? 'disconnected').slice(1)}
        </span>

        {isConnected && tab.wsConnectedAt && (
          <span className="conv-status-dim">{formatDuration(tab.wsConnectedAt)}</span>
        )}

        <span className="conv-status-dim">↑{sentCount} ↓{receivedCount}</span>

        <div className="conv-spacer" />

        <button onClick={handleClear} className="conv-action-btn" disabled={!messages.length}>
          Clear
        </button>
      </div>

      {/* Message list */}
      <div ref={listRef} className="conv-list">
        {messages.length === 0 ? (
          <div className="conv-empty">
            {isConnected ? 'No messages yet. Send one below.' : 'Not connected. Use Connect above.'}
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const msg = messages[virtualRow.index];
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
                  <MessageRow msg={msg} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Message input area */}
      <div className="border-t" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, background: 'var(--panel-bg)' }}>
        {/* Toolbar: type toggle */}
        <div className="flex-row gap-6">
          <Select
            inputSize="sm"
            value={msgType}
            onChange={(e) => setMsgType(e.target.value as 'text' | 'binary')}
          >
            <Option value="text">Text</Option>
            <Option value="binary">Binary (Base64)</Option>
          </Select>
        </div>

        {/* Text area + Send button */}
        <div className="flex-row gap-6">
          <Textarea
            code
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
            style={{ flex: 1, resize: 'vertical', padding: '5px 8px' }}
          />
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!isConnected || !msgText.trim()}
            style={{ alignSelf: 'flex-end', padding: '6px 14px' }}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
