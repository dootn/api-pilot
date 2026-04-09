import { useCallback, useEffect, useState } from 'react';
import { vscode } from '../../vscode';
import { useVscodeMessage } from '../../hooks/useVscodeMessage';
import { useTabStore } from '../../stores/tabStore';
import type { ApiResponse } from '../../stores/requestStore';
import { useI18n } from '../../i18n';

interface WsSessionSummary {
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  duration: number;
}

interface SseSessionSummary {
  eventCount: number;
  duration: number;
}

interface MqttSessionSummary {
  publishedCount: number;
  receivedCount: number;
  subscribedTopics: string[];
  duration: number;
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  request: {
    id: string;
    name: string;
    method: string;
    url: string;
    protocol?: string;
    [key: string]: unknown;
  };
  response?: ApiResponse;
  wsSession?: WsSessionSummary;
  sseSession?: SseSessionSummary;
  mqttSession?: MqttSessionSummary;
}

interface HistoryGroup {
  date: string;
  label: string;
  entries: HistoryEntry[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#4ec9b0',
  POST: '#cca700',
  PUT: '#3794ff',
  DELETE: '#f14c4c',
  PATCH: '#c586c0',
  OPTIONS: '#888',
  HEAD: '#888',
};

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return '#4ec9b0';
  if (status >= 300 && status < 400) return '#3794ff';
  if (status >= 400 && status < 500) return '#cca700';
  return '#f14c4c';
}

function shortenUrl(url: string): string {
  return url;
}

export function HistorySidebar() {
  const [groups, setGroups] = useState<HistoryGroup[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const addTabWithData = useTabStore((s) => s.addTabWithData);
  const t = useI18n();

  useEffect(() => {
    vscode.postMessage({ type: 'getHistory' });
    // Auto-expand today
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setExpandedDates(new Set([todayKey]));
  }, []);

  const handleMessage = useCallback(
    (msg: { type: string; payload?: unknown }) => {
      if (msg.type === 'history') {
        const data = msg.payload as { groups: HistoryGroup[] };
        setGroups(data.groups);
      } else if (msg.type === 'historyChanged') {
        vscode.postMessage({ type: 'getHistory' });
      }
    },
    []
  );

  useVscodeMessage(handleMessage);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const openEntry = (entry: HistoryEntry, _forceNewTab = false) => {
    const { id: _unused, ...requestData } = entry.request;
    addTabWithData({
      ...(requestData as Parameters<typeof addTabWithData>[0]),
      ...(entry.response ? { response: entry.response } : {}),
    });
  };

  return (
    <div className="history-sidebar">
      <div className="sidebar-actions">
        <button
          className="sidebar-action-btn sidebar-action-btn-danger"
          title={t('hisClearAll')}
          onClick={() => vscode.postMessage({ type: 'clearHistory' })}
        >
          {t('hisClearAll')}
        </button>
      </div>

      {/* Filter input */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-color)' }}>
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder={t('sidebarFilter')}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: 11,
            background: 'var(--input-bg)',
            color: 'var(--input-fg)',
            border: '1px solid var(--input-border)',
            borderRadius: 4,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div className="sidebar-tree">
        {(() => {
          const lowerFilter = filterText.toLowerCase().trim();
          const visibleGroups = lowerFilter
            ? groups.flatMap((group) => {
                const matchedEntries = group.entries.filter(
                  (entry) =>
                    (entry.request.url ?? '').toLowerCase().includes(lowerFilter) ||
                    entry.request.method.toLowerCase().includes(lowerFilter) ||
                    (entry.request.name ?? '').toLowerCase().includes(lowerFilter)
                );
                return matchedEntries.length > 0 ? [{ ...group, entries: matchedEntries }] : [];
              })
            : groups;
          if (visibleGroups.length === 0) {
            return <div className="sidebar-empty">{t('hisEmpty')}</div>;
          }
          return visibleGroups.map((group) => {
            const expanded = lowerFilter ? true : expandedDates.has(group.date);
            return (
              <div key={group.date}>
                <div
                  className="sidebar-tree-item sidebar-date-group"
                  onClick={() => toggleDate(group.date)}
                >
                  <span className="sidebar-arrow">{expanded ? '▼' : '▶'}</span>
                  <span className="sidebar-item-label">{group.label}</span>
                  <span className="sidebar-badge">{group.entries.length}</span>
                  {expanded && (
                    <button
                      className="sidebar-inline-action"
                      title={t('hisDeleteDay')}
                      onClick={(e) => {
                        e.stopPropagation();
                        vscode.postMessage({
                          type: 'deleteHistoryGroup',
                          payload: { date: group.date, label: group.label },
                        });
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>
                {expanded &&
                  group.entries.map((entry) => {
                    const method = entry.request.method || 'GET';
                    const protocol = entry.request.protocol as string | undefined;
                    const isWs = protocol === 'websocket';
                    const isSse = protocol === 'sse';
                    const isMqtt = protocol === 'mqtt';
                    const displayMethod = isWs
                      ? 'WS'
                      : isSse
                        ? 'SSE'
                        : isMqtt
                          ? 'MQTT'
                          : method;
                    const url = shortenUrl(entry.request.url || '');
                    return (
                      <div
                        key={entry.id}
                        className="sidebar-tree-item sidebar-history-entry"
                        style={{ paddingLeft: 22 }}
                        onClick={(e) => {
                          const forceNewTab = e.ctrlKey || e.metaKey;
                          openEntry(entry, forceNewTab);
                        }}
                      >
                        <span
                          className="sidebar-method"
                          style={{ color: isWs ? 'var(--vscode-terminal-ansiCyan, #4ec9b0)' : isSse ? 'var(--vscode-terminal-ansiYellow, #dcdcaa)' : isMqtt ? 'var(--vscode-terminal-ansiMagenta, #c586c0)' : (METHOD_COLORS[method] || '#888') }}
                        >
                          {displayMethod}
                        </span>
                        <span className="sidebar-item-label" title={entry.request.url}>
                          {url}
                        </span>
                        {isWs ? (
                          <span className="sidebar-status" style={{ color: 'var(--vscode-terminal-ansiCyan, #4ec9b0)', fontSize: 10 }}>
                            ↑{entry.wsSession?.sentCount ?? 0} ↓{entry.wsSession?.receivedCount ?? 0}
                          </span>
                        ) : isSse ? (
                          <span className="sidebar-status" style={{ color: 'var(--vscode-terminal-ansiYellow, #dcdcaa)', fontSize: 10 }}>
                            ↓{entry.sseSession?.eventCount ?? 0}
                          </span>
                        ) : isMqtt ? (
                          <span className="sidebar-status" style={{ color: 'var(--vscode-terminal-ansiMagenta, #c586c0)', fontSize: 10 }}>
                            ↑{entry.mqttSession?.publishedCount ?? 0} ↓{entry.mqttSession?.receivedCount ?? 0}
                          </span>
                        ) : (
                          <span
                            className="sidebar-status"
                            style={{ color: statusColor(entry.response?.status ?? 0) }}
                          >
                            {entry.response?.status ?? '?'}
                          </span>
                        )}
                        <button
                          className="sidebar-inline-action"
                          title={t('hisDeleteEntry')}
                          onClick={(e) => {
                            e.stopPropagation();
                            vscode.postMessage({
                              type: 'deleteHistoryEntry',
                              payload: { id: entry.id },
                            });
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
