import { useState, useRef, useEffect } from 'react';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { RedisMessage } from '../../stores/requestStore';
import { vscode } from '../../vscode';
import { useI18n } from '../../i18n';
import { useLocaleStore } from '../../stores/localeStore';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatDurationMs, formatTime } from '../../utils/formatters';
import { Select, Input, Button, Option } from '../shared/ui';
import {
  REDIS_CATEGORIES,
  buildCommandString,
  type CategoryId,
  type CmdSpec,
} from './redisCommandCatalog';

// ─── Structured result type (mirrors backend RedisResultData) ─────────────────

type RedisResultData =
  | { t: 'nil' }
  | { t: 'ok'; v: string }
  | { t: 'int'; v: number }
  | { t: 'str'; v: string }
  | { t: 'list'; items: Array<string | null>; col?: string }
  | { t: 'map'; colKey: string; entries: Array<[string | null, string | null]> }
  | { t: 'zset'; members: Array<[string, string]> }
  | { t: 'scan'; cursor: string; keys: string[] }
  | { t: 'info'; sections: Array<{ name: string; fields: Array<[string, string]> }> };

function parseResult(response: string): RedisResultData {
  try {
    const parsed = JSON.parse(response);
    if (parsed && typeof parsed === 'object' && 't' in parsed) {
      // backward compat: old 'arr' type → 'list'
      if (parsed.t === 'arr') return { t: 'list', items: parsed.items };
      return parsed as RedisResultData;
    }
  } catch { /* */ }
  return { t: 'str', v: response };
}

// ─── Table-based response renderer ───────────────────────────────────────────

function renderResponse(response: string, isError: boolean): React.ReactNode {
  if (isError) {
    return (
      <div className="redis-resp-error">
        <span className="redis-resp-error-icon">✕</span>
        <span>{response}</span>
      </div>
    );
  }

  const data = parseResult(response);

  if (data.t === 'nil') {
    return (
      <div className="redis-table-wrap">
        <table className="redis-table redis-table-single">
          <tbody><tr><td className="redis-td-nil">(nil)</td></tr></tbody>
        </table>
      </div>
    );
  }

  if (data.t === 'ok') {
    return (
      <div className="redis-table-wrap">
        <table className="redis-table redis-table-single">
          <tbody><tr><td className="redis-td-ok">✓ {data.v}</td></tr></tbody>
        </table>
      </div>
    );
  }

  if (data.t === 'int') {
    return (
      <div className="redis-table-wrap">
        <table className="redis-table redis-table-single">
          <thead><tr><th>Value</th></tr></thead>
          <tbody><tr><td className="redis-td-int">{data.v}</td></tr></tbody>
        </table>
      </div>
    );
  }

  if (data.t === 'str') {
    return (
      <div className="redis-table-wrap">
        <table className="redis-table redis-table-single">
          <thead><tr><th>Value</th></tr></thead>
          <tbody>
            <tr>
              <td>{data.v === '' ? <em className="redis-td-nil">(empty string)</em> : data.v}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (data.t === 'list') {
    const col = data.col ?? 'Value';
    if (data.items.length === 0) {
      return (
        <div className="redis-table-wrap">
          <table className="redis-table redis-table-single">
            <tbody><tr><td className="redis-td-nil">(empty)</td></tr></tbody>
          </table>
        </div>
      );
    }
    return (
      <div className="redis-table-wrap">
        <table className="redis-table">
          <thead><tr><th>#</th><th>{col}</th></tr></thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={i}>
                <td className="redis-td-idx">{i + 1}</td>
                <td>{item === null ? <em className="redis-td-nil">(nil)</em> : item}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.t === 'map') {
    if (data.entries.length === 0) {
      return (
        <div className="redis-table-wrap">
          <table className="redis-table redis-table-single">
            <tbody><tr><td className="redis-td-nil">(empty)</td></tr></tbody>
          </table>
        </div>
      );
    }
    return (
      <div className="redis-table-wrap">
        <table className="redis-table">
          <thead><tr><th>{data.colKey}</th><th>Value</th></tr></thead>
          <tbody>
            {data.entries.map(([k, v], i) => (
              <tr key={i}>
                <td className="redis-td-field">{k ?? <em className="redis-td-nil">(nil)</em>}</td>
                <td>{v ?? <em className="redis-td-nil">(nil)</em>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.t === 'zset') {
    if (data.members.length === 0) {
      return (
        <div className="redis-table-wrap">
          <table className="redis-table redis-table-single">
            <tbody><tr><td className="redis-td-nil">(empty)</td></tr></tbody>
          </table>
        </div>
      );
    }
    return (
      <div className="redis-table-wrap">
        <table className="redis-table">
          <thead><tr><th>#</th><th>Member</th><th>Score</th></tr></thead>
          <tbody>
            {data.members.map(([member, score], i) => (
              <tr key={i}>
                <td className="redis-td-idx">{i + 1}</td>
                <td>{member}</td>
                <td className="redis-td-score">{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.t === 'scan') {
    return (
      <div className="redis-table-wrap">
        <table className="redis-table">
          <thead><tr><th>Next Cursor</th><th colSpan={2}>Keys ({data.keys.length})</th></tr></thead>
          <tbody>
            {data.keys.length === 0
              ? <tr>
                  <td className="redis-td-idx">{data.cursor}</td>
                  <td colSpan={2} className="redis-td-nil">(none)</td>
                </tr>
              : data.keys.map((k, i) => (
                <tr key={i}>
                  {i === 0 && (
                    <td className="redis-td-idx redis-td-cursor" rowSpan={data.keys.length}>
                      {data.cursor}
                    </td>
                  )}
                  <td className="redis-td-idx">{i + 1}</td>
                  <td>{k}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    );
  }

  if (data.t === 'info') {
    return (
      <div className="redis-info-sections">
        {data.sections.map((sec) => (
          <div key={sec.name}>
            <div className="redis-info-section-title">{sec.name}</div>
            <div className="redis-table-wrap">
              <table className="redis-table">
                <thead><tr><th>Key</th><th>Value</th></tr></thead>
                <tbody>
                  {sec.fields.map(([k, v]) => (
                    <tr key={k}>
                      <td className="redis-td-field">{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ─── Pair grouping ────────────────────────────────────────────────────────────

type ResultPair = {
  id: string;
  command: string;
  response?: string;
  isError?: boolean;
  pending: boolean;
  timestamp: number;
};

function buildPairs(messages: RedisMessage[]): ResultPair[] {
  const pairs: ResultPair[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.direction !== 'sent') continue;
    const next = messages[i + 1];
    const received = next?.direction === 'received' ? next : undefined;
    pairs.push({
      id: m.id,
      command: m.command ?? m.response,
      response: received?.response,
      isError: received?.isError,
      pending: !received,
      timestamp: m.timestamp,
    });
    if (received) i++;
  }
  return pairs;
}

// ─── ResultPair row ───────────────────────────────────────────────────────────

interface ResultPairRowProps {
  pair: ResultPair;
  onRerun: (cmd: string) => void;
  copyText: (text: string) => void;
  copiedText: string | null;
  t: ReturnType<typeof useI18n>;
}

function ResultPairRow({ pair, onRerun, copyText, copiedText, t }: ResultPairRowProps) {
  const isCopied = pair.response != null && copiedText === pair.response;

  return (
    <div className="redis-result-pair">
      <div className="redis-result-cmd-row">
        <span className="redis-cmd-prompt">❯</span>
        <span className="redis-cmd-text">{pair.command}</span>
        <div className="redis-result-actions">
          <button
            className="conv-action-btn"
            onClick={() => onRerun(pair.command)}
            title={t('redisRerun')}
          >
            ↺
          </button>
          {pair.response != null && (
            <button
              className="conv-action-btn"
              onClick={() => copyText(pair.response!)}
              title={t('redisCopy')}
            >
              {isCopied ? t('redisCopied') : t('redisCopy')}
            </button>
          )}
          <span className="redis-result-time">{formatTime(pair.timestamp)}</span>
        </div>
      </div>
      {pair.pending && <div className="redis-result-pending">…</div>}
      {pair.response != null && (
        <div className="redis-result-response">
          {renderResponse(pair.response, pair.isError ?? false)}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function RedisPanel() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
  const t = useI18n();
  const { copy: copyToClipboard } = useCopyToClipboard();

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [category, setCategory] = useState<CategoryId>('General');
  const [selectedCmd, setSelectedCmd] = useState<string>('PING');
  const [args, setArgs] = useState<Record<string, string>>({});
  const [rawMode, setRawMode] = useState(false);
  const [rawCommand, setRawCommand] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const messages: RedisMessage[] = tab?.redisMessages ?? [];

  // Reset command to first in category when category changes
  useEffect(() => {
    const cat = REDIS_CATEGORIES.find((c) => c.id === category)!;
    setSelectedCmd(cat.cmds[0].cmd);
    setArgs({});
  }, [category]);

  // Reset args when command changes
  useEffect(() => {
    setArgs({});
  }, [selectedCmd]);

  if (!tab) return null;

  const isConnected = tab.redisStatus === 'connected';
  const locale = useLocaleStore((s) => s.locale);
  const durationMs = tab.redisConnectedAt ? Date.now() - tab.redisConnectedAt : 0;
  const sent = messages.filter((m) => m.direction === 'sent').length;
  const received = messages.filter((m) => m.direction === 'received').length;

  const allPairs = buildPairs(messages);
  const lastPair = allPairs.length > 0 ? allPairs[allPairs.length - 1] : null;
  const previousPairs = allPairs.slice(0, -1);

  const currentCat = REDIS_CATEGORIES.find((c) => c.id === category)!;
  const currentCmdSpec: CmdSpec | undefined = currentCat.cmds.find((c) => c.cmd === selectedCmd);
  const previewCmd = !rawMode && currentCmdSpec
    ? buildCommandString(currentCmdSpec, args) || currentCmdSpec.cmd
    : null;

  const canExecuteBuilder =
    isConnected &&
    !!currentCmdSpec &&
    currentCmdSpec.args.filter((a) => !a.optional).every((a) => (args[a.name] ?? '').trim().length > 0);

  const canExecuteRaw = isConnected && rawCommand.trim().length > 0;

  const statusColor =
    tab.redisStatus === 'connected'
      ? 'var(--vscode-terminal-ansiGreen, #4ec94e)'
      : tab.redisStatus === 'connecting'
      ? 'var(--vscode-terminal-ansiYellow, #dcdcaa)'
      : tab.redisStatus === 'error'
      ? 'var(--error-fg)'
      : 'var(--panel-fg)';

  const statusLabel =
    tab.redisStatus === 'connected'
      ? `${t('redisStatusConnected')}${durationMs > 0 ? ' · ' + formatDurationMs(durationMs) : ''}`
      : tab.redisStatus === 'connecting'
      ? t('redisStatusConnecting')
      : tab.redisStatus === 'error'
      ? t('redisStatusError')
      : t('redisStatusDisconnected');

  function sendCommand(cmd: string) {
    if (!tab?.redisConnectionId || !cmd.trim()) return;
    vscode.postMessage({
      type: 'redisSendCommand',
      payload: { connectionId: tab.redisConnectionId, command: cmd.trim() },
    });
  }

  function handleExecute() {
    if (rawMode) {
      sendCommand(rawCommand);
      setRawCommand('');
    } else if (currentCmdSpec) {
      sendCommand(buildCommandString(currentCmdSpec, args));
    }
  }

  function handleRerun(cmd: string) {
    sendCommand(cmd);
    if (rawMode) setRawCommand(cmd);
  }

  function handleCopyResult(text: string) {
    copyToClipboard(text);
    setCopiedText(text);
    clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedText(null), 2000);
  }

  function handleArgKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canExecuteBuilder) handleExecute();
    }
  }

  function handleRawKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canExecuteRaw) handleExecute();
    }
  }

  return (
    <div className="conv-container">
      {/* ── Status bar ── */}
      <div className="conv-status-bar">
        <span className="conv-status-label">
          <span className="conv-status-dot" style={{ background: statusColor }} />
          <span style={{ color: statusColor }}>{statusLabel}</span>
        </span>
        <span className="conv-status-dim">↑ {sent} {t('redisSentLabel')}</span>
        <span className="conv-status-dim">↓ {received} {t('redisReceivedLabel')}</span>
        <div className="conv-actions">
          <button
            className="conv-action-btn"
            onClick={() => updateTab(tab.id, { redisMessages: [] })}
          >
            {t('redisClear')}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {tab.redisStatus === 'error' && tab.responseError && (
        <div className="mqtt-error-banner">{tab.responseError}</div>
      )}

      {/* ── Command builder ── */}
      <div className="redis-builder">
        {/* Category tabs */}
        <div className="redis-cat-row">
          {REDIS_CATEGORIES.map((cat) => {
            const isActive = !rawMode && category === cat.id;
            return (
              <button
                key={cat.id}
                className={`redis-cat-tab${isActive ? ' active' : ''}`}
                style={isActive ? { color: cat.color, borderBottomColor: cat.color } : undefined}
                onClick={() => { setRawMode(false); setCategory(cat.id); }}
                disabled={!isConnected}
              >
                {cat.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button
            className={`redis-cat-tab${rawMode ? ' active' : ''}`}
            style={rawMode ? { color: 'var(--panel-fg)', borderBottomColor: 'var(--panel-fg)' } : undefined}
            onClick={() => setRawMode((v) => !v)}
            disabled={!isConnected}
          >
            {t('redisRawMode')}
          </button>
        </div>

        {/* Command / args row */}
        {rawMode ? (
          <div className="redis-cmd-raw-row">
            <Input
              inputSize="sm"
              fullWidth
              value={rawCommand}
              onChange={(e) => setRawCommand(e.target.value)}
              onKeyDown={handleRawKeyDown}
              placeholder={t('redisCommandPlaceholder')}
              disabled={!isConnected}
              spellCheck={false}
              autoComplete="off"
              style={{ fontFamily: 'monospace' }}
            />
            <Button
              variant="primary"
              btnSize="sm"
              onClick={handleExecute}
              disabled={!canExecuteRaw}
            >
              {t('redisExecuteBtn')}
            </Button>
          </div>
        ) : (
          <div className="redis-cmd-row">
            <Select
              inputSize="sm"
              value={selectedCmd}
              onChange={(e) => setSelectedCmd(e.target.value)}
              disabled={!isConnected}
            >
              {currentCat.cmds.map((spec) => (
                <Option key={spec.cmd} value={spec.cmd}>
                  {spec.cmd}
                </Option>
              ))}
            </Select>

            {currentCmdSpec?.args.map((arg) => (
              <div key={arg.name} className="redis-arg-field">
                <label className="redis-arg-label">{arg.name}</label>
                <Input
                  inputSize="sm"
                  type={arg.type === 'number' ? 'number' : 'text'}
                  placeholder={arg.placeholder}
                  value={args[arg.name] ?? ''}
                  onChange={(e) =>
                    setArgs((prev) => ({ ...prev, [arg.name]: e.target.value }))
                  }
                  onKeyDown={handleArgKeyDown}
                  disabled={!isConnected}
                  spellCheck={false}
                  autoComplete="off"
                  style={{
                    width: arg.width === 'sm' ? 70 : arg.width === 'lg' ? 190 : 120,
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            ))}

            <Button
              variant="primary"
              btnSize="sm"
              onClick={handleExecute}
              disabled={!canExecuteBuilder}
            >
              {t('redisExecuteBtn')}
            </Button>
          </div>
        )}

        {/* Command info bar: preview + description */}
        {!rawMode && currentCmdSpec && (
          <div className="redis-cmd-info">
            <span className="redis-cmd-info-preview">$ {previewCmd}</span>
            {currentCmdSpec.desc && (
              <span className="redis-cmd-info-desc">
                {locale === 'zh-CN' ? currentCmdSpec.desc.zh : currentCmdSpec.desc.en}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Result ── */}
      <div className="redis-results">
        {!isConnected && !lastPair && (
          <div className="conv-empty-hint">{t('redisConnectFirst')}</div>
        )}
        {isConnected && !lastPair && (
          <div className="conv-empty-hint">{t('redisNoCommands')}</div>
        )}
        {lastPair && (
          <>
            <ResultPairRow
              pair={lastPair}
              onRerun={handleRerun}
              copyText={handleCopyResult}
              copiedText={copiedText}
              t={t}
            />
            {previousPairs.length > 0 && (
              <div className="redis-history-section">
                <button
                  className="redis-history-toggle"
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  <span className="redis-history-toggle-arrow">{historyOpen ? '▾' : '▸'}</span>
                  {t('redisHistory')} ({previousPairs.length})
                </button>
                {historyOpen && (
                  <div className="redis-history-list">
                    {[...previousPairs].reverse().map((pair) => (
                      <ResultPairRow
                        key={pair.id}
                        pair={pair}
                        onRerun={handleRerun}
                        copyText={handleCopyResult}
                        copiedText={copiedText}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
