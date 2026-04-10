import { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { MqttMessage } from '../../stores/requestStore';
import { vscode } from '../../vscode';
import { useI18n } from '../../i18n';

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  return `${(b / 1024).toFixed(1)} KB`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

const MAX_DISPLAY = 500;

export function MqttPanel() {
  const { getActiveTab, updateTab } = useTabStore();
  const tab = getActiveTab();
  const t = useI18n();

  const [subTopic, setSubTopic] = useState('');
  const [subQos, setSubQos] = useState<0 | 1 | 2>(0);
  const [pubTopic, setPubTopic] = useState('');
  const [pubPayload, setPubPayload] = useState('');
  const [pubQos, setPubQos] = useState<0 | 1 | 2>(0);
  const [pubRetain, setPubRetain] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tab?.mqttMessages?.length, autoScroll]);

  if (!tab) return null;

  const messages: MqttMessage[] = tab.mqttMessages ?? [];
  const subscriptions: string[] = tab.mqttSubscriptions ?? [];
  const isConnected = tab.mqttStatus === 'connected';
  const isConnecting = tab.mqttStatus === 'connecting' || tab.loading;
  const duration = tab.mqttConnectedAt ? Date.now() - tab.mqttConnectedAt : 0;
  const sent = messages.filter((m) => m.direction === 'sent').length;
  const received = messages.filter((m) => m.direction === 'received').length;
  const displayed = messages.slice(-MAX_DISPLAY);
  const truncated = messages.length > MAX_DISPLAY;

  function handleSubscribe() {
    if (!subTopic.trim() || !tab?.mqttConnectionId) return;
    vscode.postMessage({
      type: 'mqttSubscribe',
      payload: { connectionId: tab.mqttConnectionId, topic: subTopic.trim(), qos: subQos },
    });
    setSubTopic('');
  }

  function handleUnsubscribe(topic: string) {
    if (!tab?.mqttConnectionId) return;
    vscode.postMessage({
      type: 'mqttUnsubscribe',
      payload: { connectionId: tab.mqttConnectionId, topic },
    });
  }

  function handlePublish() {
    if (!pubTopic.trim() || !tab?.mqttConnectionId) return;
    vscode.postMessage({
      type: 'mqttPublish',
      payload: {
        connectionId: tab.mqttConnectionId,
        topic: pubTopic.trim(),
        payload: pubPayload,
        qos: pubQos,
        retain: pubRetain,
      },
    });
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyPayload(payload: string) {
    navigator.clipboard.writeText(payload).catch(() => {
      vscode.postMessage({ type: 'copyToClipboard', payload: { text: payload } });
    });
  }

  const statusColor = tab.mqttStatus === 'connected'
    ? 'var(--vscode-terminal-ansiGreen, #4ec94e)'
    : tab.mqttStatus === 'connecting'
      ? 'var(--vscode-terminal-ansiYellow, #dcdcaa)'
      : tab.mqttStatus === 'error'
        ? 'var(--vscode-terminal-ansiRed, #f44747)'
        : 'var(--panel-fg)';

  const statusLabel = tab.mqttStatus === 'connected'
    ? `${t('mqttStatusConnected')}${isConnected && duration > 0 ? ' · ' + formatDuration(duration) : ''}`
    : tab.mqttStatus === 'connecting' ? t('mqttStatusConnecting')
    : tab.mqttStatus === 'error' ? t('mqttStatusError')
    : t('mqttStatusDisconnected');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 13, overflow: 'hidden' }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '6px 14px',
        borderBottom: '1px solid var(--border-color, #555)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
          <span style={{ color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
        </span>
        <span style={{ opacity: 0.6 }}>↑ {sent} {t('mqttPublishedLabel')}</span>
        <span style={{ opacity: 0.6 }}>↓ {received} {t('mqttReceivedLabel')}</span>
        <span style={{ opacity: 0.6 }}>{subscriptions.length} {subscriptions.length !== 1 ? t('mqttSubscriptions') : t('mqttSubscription')}</span>
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
            {t('mqttAutoScroll')}
          </button>
          <button
            style={{
              fontSize: 11,
              background: 'none',
              border: '1px solid var(--border-color, #555)',
              borderRadius: 3,
              padding: '2px 7px',
              cursor: 'pointer',
              color: 'var(--panel-fg)',
            }}
            onClick={() => updateTab(tab.id, { mqttMessages: [] })}
          >
            {t('mqttClear')}
          </button>
        </div>
      </div>

      {/* Error detail banner */}
      {tab.mqttStatus === 'error' && tab.responseError && (
        <div style={{
          padding: '6px 14px',
          fontSize: 12,
          color: 'var(--vscode-errorForeground, #f48771)',
          borderBottom: '1px solid var(--border-color, #555)',
          flexShrink: 0,
          fontFamily: 'monospace',
        }}>
          {tab.responseError}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: subscriptions + message log */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Subscriptions */}
          <div style={{
            padding: '8px 14px', borderBottom: '1px solid var(--border-color, #555)',
            flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontWeight: 600, opacity: 0.7, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('mqttSubscriptionsSection')}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="url-input"
                type="text"
                placeholder={t('mqttTopicPlaceholder')}
                value={subTopic}
                onChange={(e) => setSubTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                disabled={!isConnected}
                style={{ flex: 1, minWidth: 180, padding: '4px 8px', fontSize: 13 }}
              />
              <select
                value={subQos}
                onChange={(e) => setSubQos(Number(e.target.value) as 0 | 1 | 2)}
                disabled={!isConnected}
                style={{
                  padding: '4px 8px', fontSize: 12,
                  background: 'var(--input-bg, #3c3c3c)', color: 'var(--panel-fg)',
                  border: '1px solid var(--border-color, #555)', borderRadius: 4, width: 80,
                }}
              >
                <option value={0}>QoS 0</option>
                <option value={1}>QoS 1</option>
                <option value={2}>QoS 2</option>
              </select>
              <button
                className="send-btn"
                disabled={!isConnected || !subTopic.trim()}
                onClick={handleSubscribe}
                style={{ padding: '4px 12px', fontSize: 12 }}
              >
                {t('mqttSubscribeBtn')}
              </button>
            </div>
            {subscriptions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {subscriptions.map((t) => (
                  <span key={t} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'var(--vscode-badge-background, #4d4d4d)',
                    color: 'var(--vscode-badge-foreground, #fff)',
                    borderRadius: 10, padding: '2px 8px', fontSize: 11,
                  }}>
                    {t}
                    <button
                      onClick={() => handleUnsubscribe(t)}
                      disabled={!isConnected}
                      title="Unsubscribe"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: 'inherit', opacity: 0.6, fontSize: 12, lineHeight: 1,
                      }}
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Message log */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', opacity: 0.4, marginTop: 24, fontSize: 12 }}>
                {isConnected ? t('mqttNoMessages') : t('mqttConnectToStart')}
              </div>
            )}
            {truncated && (
              <div style={{ textAlign: 'center', opacity: 0.5, fontSize: 11, padding: '4px 0' }}>
                (Showing last {MAX_DISPLAY} of {messages.length} messages)
              </div>
            )}
            {displayed.map((msg) => {
              const isSent = msg.direction === 'sent';
              const isExpanded = expandedIds.has(msg.id);
              const truncPayload = msg.payload.length > 200 && !isExpanded;
              return (
                <div key={msg.id} style={{
                  padding: '6px 14px',
                  borderBottom: '1px solid var(--border-color-subtle, rgba(128,128,128,0.15))',
                  fontFamily: 'monospace',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                      background: isSent ? 'var(--vscode-terminal-ansiBlue, #3b8eda)' : 'var(--vscode-terminal-ansiGreen, #4ec94e)',
                      color: '#fff',
                    }}>
                      {isSent ? '↑ PUB' : '↓ SUB'}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '1px 6px', borderRadius: 3,
                      background: 'var(--vscode-badge-background, #4d4d4d)',
                      color: 'var(--vscode-badge-foreground, #ccc)',
                    }}>
                      {msg.topic}
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.5 }}>QoS {msg.qos}</span>
                    {msg.retained && (
                      <span style={{ fontSize: 10, opacity: 0.6, fontStyle: 'italic' }}>retained</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.45 }}>
                      {formatTime(msg.timestamp)} · {formatBytes(msg.size)}
                    </span>
                    <button
                      onClick={() => copyPayload(msg.payload)}
                      title="Copy payload"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: 12, padding: 0 }}
                    >⎘</button>
                  </div>
                  <div
                    style={{
                      fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      opacity: 0.85, lineHeight: 1.4,
                      maxHeight: isExpanded ? 'none' : '4.5em',
                      overflow: isExpanded ? 'visible' : 'hidden',
                    }}
                  >
                    {truncPayload ? msg.payload.slice(0, 200) : msg.payload}
                  </div>
                  {msg.payload.length > 200 && (
                    <button
                      onClick={() => toggleExpand(msg.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: 11, padding: '2px 0' }}
                    >
                      {isExpanded ? 'Show less' : `Show all (${msg.payload.length} chars)`}
                    </button>
                  )}
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Right: publish panel */}
        <div style={{
          width: 240, flexShrink: 0, borderLeft: '1px solid var(--border-color, #555)',
          display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 8,
        }}>
          <div style={{ fontWeight: 600, opacity: 0.7, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('mqttPublishSection')}</div>
          <input
            className="url-input"
            type="text"
            placeholder={t('mqttTopicPubPlaceholder')}
            value={pubTopic}
            disabled={!isConnected}
            onChange={(e) => setPubTopic(e.target.value)}
            style={{ padding: '4px 8px', fontSize: 13 }}
          />
          <textarea
            className="url-input"
            placeholder={t('mqttPayloadPlaceholder')}
            value={pubPayload}
            disabled={!isConnected}
            onChange={(e) => setPubPayload(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePublish(); }}
            rows={5}
            style={{ padding: '4px 8px', fontSize: 12, resize: 'vertical', fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select
              value={pubQos}
              onChange={(e) => setPubQos(Number(e.target.value) as 0 | 1 | 2)}
              disabled={!isConnected}
              style={{
                flex: 1, padding: '4px 6px', fontSize: 12,
                background: 'var(--input-bg, #3c3c3c)', color: 'var(--panel-fg)',
                border: '1px solid var(--border-color, #555)', borderRadius: 4,
              }}
            >
              <option value={0}>QoS 0</option>
              <option value={1}>QoS 1</option>
              <option value={2}>QoS 2</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={pubRetain}
                disabled={!isConnected}
                onChange={(e) => setPubRetain(e.target.checked)}
              />
              {t('mqttRetain')}
            </label>
          </div>
          <button
            className="send-btn"
            disabled={!isConnected || !pubTopic.trim()}
            onClick={handlePublish}
            style={{ padding: '6px 0', fontSize: 13 }}
          >
            {t('mqttPublishBtn')}
          </button>
          {!isConnected && !isConnecting && (
            <div style={{ fontSize: 11, opacity: 0.45, textAlign: 'center', marginTop: 4 }}>
              {t('mqttConnectFirst')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
