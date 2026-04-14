import { useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { MqttMessage } from '../../stores/requestStore';
import { vscode } from '../../vscode';
import { useI18n, type TranslationKey } from '../../i18n';
import { formatBytes, formatTime, formatDurationMs } from '../../utils/formatters';
import { MAX_DISPLAY_MESSAGES } from '../../utils/constants';
import { Input, Checkbox, Select, Textarea, Option } from '../shared/ui';

export function MqttPanel() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
  const t = useI18n();

  const [subTopic, setSubTopic] = useState('');
  const [subQos, setSubQos] = useState<0 | 1 | 2>(0);
  const [pubTopic, setPubTopic] = useState('');
  const [pubPayload, setPubPayload] = useState('');
  const [pubQos, setPubQos] = useState<0 | 1 | 2>(0);
  const [pubRetain, setPubRetain] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  if (!tab) return null;

  const messages: MqttMessage[] = tab.mqttMessages ?? [];
  const subscriptions: string[] = tab.mqttSubscriptions ?? [];
  const isConnected = tab.mqttStatus === 'connected';
  const isConnecting = tab.mqttStatus === 'connecting' || tab.loading;
  const durationMs = tab.mqttConnectedAt ? Date.now() - tab.mqttConnectedAt : 0;
  const sent = messages.filter((m) => m.direction === 'sent').length;
  const received = messages.filter((m) => m.direction === 'received').length;
  const displayed = messages.slice(-MAX_DISPLAY_MESSAGES);
  const truncated = messages.length > MAX_DISPLAY_MESSAGES;

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
    ? `${t('mqttStatusConnected')}${isConnected && durationMs > 0 ? ' · ' + formatDurationMs(durationMs) : ''}`
    : tab.mqttStatus === 'connecting' ? t('mqttStatusConnecting')
    : tab.mqttStatus === 'error' ? t('mqttStatusError')
    : t('mqttStatusDisconnected');

  return (
    <div className="conv-container">
      {/* Status bar */}
      <div className="conv-status-bar">
        <span className="conv-status-label">
          <span className="conv-status-dot" style={{ background: statusColor }} />
          <span style={{ color: statusColor }}>{statusLabel}</span>
        </span>
        <span className="conv-status-dim">↑ {sent} {t('mqttPublishedLabel')}</span>
        <span className="conv-status-dim">↓ {received} {t('mqttReceivedLabel')}</span>
        <span className="conv-status-dim">{subscriptions.length} {subscriptions.length !== 1 ? t('mqttSubscriptions') : t('mqttSubscription')}</span>
        <div className="conv-actions">
          <button
            onClick={() => setAutoScroll((v) => !v)}
            title="Toggle auto-scroll"
            className="conv-action-btn"
            style={{ opacity: autoScroll ? 1 : 0.45 }}
          >
            {t('mqttAutoScroll')}
          </button>
          <button
            className="conv-action-btn"
            onClick={() => updateTab(tab.id, { mqttMessages: [] })}
          >
            {t('mqttClear')}
          </button>
        </div>
      </div>

      {/* Error detail banner */}
      {tab.mqttStatus === 'error' && tab.responseError && (
        <div className="mqtt-error-banner">
          {tab.responseError}
        </div>
      )}

      <div className="mqtt-body">
        {/* Left: subscriptions + message log */}
        <div className="mqtt-left">
          {/* Subscriptions */}
          <div className="mqtt-sub-section">
            <div className="mqtt-section-header">{t('mqttSubscriptionsSection')}</div>
            <div className="mqtt-sub-row">
              <Input
                className="url-input mqtt-sub-input"
                type="text"
                placeholder={t('mqttTopicPlaceholder')}
                value={subTopic}
                onChange={(e) => setSubTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                disabled={!isConnected}
              />
              <Select
                className="mqtt-select"
                value={subQos}
                onChange={(e) => setSubQos(Number(e.target.value) as 0 | 1 | 2)}
                disabled={!isConnected}
                style={{ width: 80 }}
              >
                <Option value={0}>QoS 0</Option>
                <Option value={1}>QoS 1</Option>
                <Option value={2}>QoS 2</Option>
              </Select>
              <button
                className="send-btn mqtt-sub-btn"
                disabled={!isConnected || !subTopic.trim()}
                onClick={handleSubscribe}
              >
                {t('mqttSubscribeBtn')}
              </button>
            </div>
            {subscriptions.length > 0 && (
              <div className="mqtt-sub-badges">
                {subscriptions.map((t) => (
                  <span key={t} className="mqtt-sub-badge">
                    {t}
                    <button
                      onClick={() => handleUnsubscribe(t)}
                      disabled={!isConnected}
                      title="Unsubscribe"
                      className="mqtt-unsub-btn"
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Message log */}
          <MqttMessageList
            listRef={listRef}
            messages={messages}
            displayed={displayed}
            truncated={truncated}
            isConnected={isConnected}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            copyPayload={copyPayload}
            autoScroll={autoScroll}
            t={t}
          />
        </div>

        {/* Right: publish panel */}
        <div className="mqtt-pub-panel">
          <div className="mqtt-section-header">{t('mqttPublishSection')}</div>
          <Input
            className="url-input"
            type="text"
            placeholder={t('mqttTopicPubPlaceholder')}
            value={pubTopic}
            disabled={!isConnected}
            onChange={(e) => setPubTopic(e.target.value)}
            style={{ padding: '4px 8px', fontSize: 13 }}
          />
          <Textarea
            className="url-input mqtt-pub-textarea"
            placeholder={t('mqttPayloadPlaceholder')}
            value={pubPayload}
            disabled={!isConnected}
            onChange={(e) => setPubPayload(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePublish(); }}
            rows={5}
          />
          <div className="mqtt-pub-controls">
            <Select
              className="mqtt-select"
              value={pubQos}
              onChange={(e) => setPubQos(Number(e.target.value) as 0 | 1 | 2)}
              disabled={!isConnected}
              style={{ flex: 1 }}
            >
              <Option value={0}>QoS 0</Option>
              <Option value={1}>QoS 1</Option>
              <Option value={2}>QoS 2</Option>
            </Select>
            <label className="mqtt-retain-label">
              <Checkbox
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
            <div className="mqtt-connect-hint">
              {t('mqttConnectFirst')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Virtualized message list sub-component ────────────── */
function MqttMessageList({
  listRef,
  messages,
  displayed,
  truncated,
  isConnected,
  expandedIds,
  toggleExpand,
  copyPayload,
  autoScroll,
  t,
}: {
  listRef: React.RefObject<HTMLDivElement>;
  messages: MqttMessage[];
  displayed: MqttMessage[];
  truncated: boolean;
  isConnected: boolean;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  copyPayload: (payload: string) => void;
  autoScroll: boolean;
  t: (key: TranslationKey) => string;
}) {
  const virtualizer = useVirtualizer({
    count: displayed.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  useEffect(() => {
    if (!autoScroll || displayed.length === 0) return;
    virtualizer.scrollToIndex(displayed.length - 1, { align: 'end' });
  }, [displayed.length, autoScroll]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={listRef} className="conv-list" style={{ padding: '4px 0' }}>
      {messages.length === 0 && (
        <div className="conv-empty" style={{ height: 'auto', marginTop: 24, fontSize: 12 }}>
          {isConnected ? t('mqttNoMessages') : t('mqttConnectToStart')}
        </div>
      )}
      {truncated && (
        <div className="conv-truncated">
          (Showing last {MAX_DISPLAY_MESSAGES} of {messages.length} messages)
        </div>
      )}
      {displayed.length > 0 && (
        <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const msg = displayed[virtualRow.index];
            const isSent = msg.direction === 'sent';
            const isExpanded = expandedIds.has(msg.id);
            const truncPayload = msg.payload.length > 200 && !isExpanded;
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
                <div className="mqtt-msg-row">
                  <div className="mqtt-msg-header">
                    <span className={`mqtt-msg-dir ${isSent ? 'mqtt-msg-dir-sent' : 'mqtt-msg-dir-received'}`}>
                      {isSent ? '↑ PUB' : '↓ SUB'}
                    </span>
                    <span className="mqtt-msg-topic">{msg.topic}</span>
                    <span className="mqtt-msg-qos">QoS {msg.qos}</span>
                    {msg.retained && <span className="mqtt-msg-retained">retained</span>}
                    <span className="mqtt-msg-meta">
                      {formatTime(msg.timestamp)} · {formatBytes(msg.size)}
                    </span>
                    <button onClick={() => copyPayload(msg.payload)} title="Copy payload" className="mqtt-msg-copy">⎘</button>
                  </div>
                  <div className={`mqtt-msg-content${isExpanded ? '' : ' mqtt-msg-content-collapsed'}`}>
                    {truncPayload ? msg.payload.slice(0, 200) : msg.payload}
                  </div>
                  {msg.payload.length > 200 && (
                    <button onClick={() => toggleExpand(msg.id)} className="mqtt-msg-expand">
                      {isExpanded ? 'Show less' : `Show all (${msg.payload.length} chars)`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
