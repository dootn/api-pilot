import { useState, useRef, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { useRunnerStore, RunEntry, RunSummary } from '../../stores/runnerStore';
import { useI18n } from '../../i18n';
import { vscode } from '../../vscode';

interface Props {
  onClose: () => void;
}

function statusIcon(status: RunEntry['status']): string {
  switch (status) {
    case 'running': return '⟳';
    case 'passed':  return '✓';
    case 'failed':  return '✗';
    case 'error':   return '⚠';
  }
}

function statusColor(status: RunEntry['status']): string {
  switch (status) {
    case 'running': return 'var(--vscode-progressBar-background, #007acc)';
    case 'passed':  return 'var(--vscode-testing-iconPassed, #73c991)';
    case 'failed':  return 'var(--vscode-testing-iconFailed, #f48771)';
    case 'error':   return 'var(--vscode-editorWarning-foreground, #e2c08d)';
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function SummaryBar({ summary }: { summary: RunSummary }) {
  const t = useI18n();
  const allPassed = summary.failedTests === 0 && !summary.aborted;
  const color = allPassed
    ? 'var(--vscode-testing-iconPassed, #73c991)'
    : 'var(--vscode-testing-iconFailed, #f48771)';

  return (
    <div
      style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: 24,
        alignItems: 'center',
        fontSize: 12,
        flexShrink: 0,
        background: 'var(--panel-bg)',
      }}
    >
      {summary.aborted && (
        <span style={{ color: 'var(--vscode-editorWarning-foreground, #e2c08d)', fontWeight: 600 }}>
          {t('runnerAborted')}
        </span>
      )}
      <span>
        <strong style={{ color }}>{summary.totalRequests}</strong> {t('runnerSummaryRequests')}
      </span>
      <span>
        <strong style={{ color: 'var(--vscode-testing-iconPassed, #73c991)' }}>{summary.passedTests}</strong>{' '}
        <strong style={{ color: 'var(--vscode-testing-iconFailed, #f48771)' }}>{summary.failedTests}</strong>{' '}
        {t('runnerSummaryTests')}
      </span>
      <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{summary.totalTime} ms</span>
    </div>
  );
}

export function CollectionRunnerModal({ onClose }: Props) {
  const t = useI18n();
  const runnerCollection = useRunnerStore((s) => s.runnerCollection);
  const isRunning = useRunnerStore((s) => s.isRunning);
  const currentRunId = useRunnerStore((s) => s.currentRunId);
  const entries = useRunnerStore((s) => s.entries);
  const summary = useRunnerStore((s) => s.summary);
  const startRun = useRunnerStore((s) => s.startRun);
  const resetRun = useRunnerStore((s) => s.resetRun);

  const requests = runnerCollection?.requests ?? [];

  // Use array indices as selection keys so same-ID or same-name requests are independently selectable
  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(
    () => new Set(requests.map((_, i) => i)),
  );
  const [iterations, setIterations] = useState(1);
  const [delayMs, setDelayMs] = useState(0);
  const [stopOnFailure, setStopOnFailure] = useState(false);
  const [persistEnvChanges, setPersistEnvChanges] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const resultsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll results
  useEffect(() => {
    if (isRunning && resultsEndRef.current) {
      resultsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, isRunning]);

  const allSelected = requests.length > 0 && requests.every((_, i) => selectedIdxs.has(i));

  const toggleRequest = (idx: number) => {
    setSelectedIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIdxs(new Set());
    } else {
      setSelectedIdxs(new Set(requests.map((_, i) => i)));
    }
  };

  const handleRun = () => {
    if (selectedIdxs.size === 0 || !runnerCollection) return;
    resetRun();
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    startRun(runId);
    vscode.postMessage({
      type: 'runCollection',
      runId,
      payload: {
        collectionId: runnerCollection.id,
        selectedRequestIds: [...selectedIdxs].sort((a, b) => a - b).map((i) => requests[i].id),
        iterations,
        delayMs,
        stopOnFailure,
        persistEnvChanges,
      },
    });
  };

  const handleStop = () => {
    if (currentRunId) {
      vscode.postMessage({ type: 'cancelCollectionRun', runId: currentRunId });
    }
  };

  const toggleErrorExpand = (key: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const INPUT_STYLE: React.CSSProperties = {
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border, var(--border-color))',
    borderRadius: 3,
    padding: '3px 6px',
    fontSize: 12,
    width: 70,
  };

  const BTN_BASE: React.CSSProperties = {
    padding: '5px 14px',
    borderRadius: 3,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  };

  return (
    <Modal onClose={onClose} width="680px" maxHeight="90vh">
      <div style={{ display: 'flex', flexDirection: 'column', height: '85vh', overflow: 'hidden' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {t('runnerTitle')}
            {runnerCollection && (
              <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 8, fontSize: 13 }}>
                — {runnerCollection.name}
              </span>
            )}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--panel-fg)', cursor: 'pointer', fontSize: 16, opacity: 0.7 }}
          >
            ✕
          </button>
        </div>

        {/* Body (scrollable split) */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Top section: request list + config */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0,
              maxHeight: '40%',
            }}
          >
            {/* Request checklist */}
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px', borderRight: '1px solid var(--border-color)' }}>
              {requests.length === 0 ? (
                <span style={{ opacity: 0.5, fontSize: 12 }}>{t('runnerNoRequests')}</span>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginBottom: 6,
                      fontSize: 11,
                    }}
                  >
                    <button
                      onClick={toggleAll}
                      style={{ ...BTN_BASE, background: 'transparent', border: '1px solid var(--border-color)', padding: '2px 8px', fontWeight: 400, opacity: 0.8 }}
                    >
                      {allSelected ? t('runnerDeselectAll') : t('runnerSelectAll')}
                    </button>
                    <span style={{ opacity: 0.5, alignSelf: 'center' }}>{selectedIdxs.size} / {requests.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {requests.map((r, idx) => (
                      <label
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          padding: '2px 0',
                          fontSize: 12,
                          opacity: isRunning ? 0.7 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIdxs.has(idx)}
                          onChange={() => !isRunning && toggleRequest(idx)}
                          disabled={isRunning}
                          style={{ cursor: isRunning ? 'default' : 'pointer' }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--method-color, #888)',
                            minWidth: 40,
                            textAlign: 'right',
                          }}
                        >
                          {r.method}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {r.folderPath && (
                            <span style={{ opacity: 0.45, fontSize: 10, marginRight: 4 }}>{r.folderPath} /</span>
                          )}
                          {r.name || r.url}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Config panel */}
            <div style={{ width: 200, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ opacity: 0.8 }}>{t('runnerIterations')}</span>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={iterations}
                  onChange={(e) => setIterations(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={isRunning}
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ opacity: 0.8 }}>{t('runnerDelay')}</span>
                <input
                  type="number"
                  min={0}
                  max={60000}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={isRunning}
                  style={INPUT_STYLE}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isRunning ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={stopOnFailure}
                  onChange={(e) => !isRunning && setStopOnFailure(e.target.checked)}
                  disabled={isRunning}
                />
                <span style={{ opacity: 0.8 }}>{t('runnerStopOnFailure')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isRunning ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={persistEnvChanges}
                  onChange={(e) => !isRunning && setPersistEnvChanges(e.target.checked)}
                  disabled={isRunning}
                />
                <span style={{ opacity: 0.8 }}>{t('runnerPersistEnv')}</span>
              </label>
            </div>
          </div>

          {/* Run / Stop button */}
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              gap: 8,
              flexShrink: 0,
            }}
          >
            {!isRunning ? (
              <button
                onClick={handleRun}
                disabled={requests.length === 0 || selectedIdxs.size === 0}
                style={{
                  ...BTN_BASE,
                  background: 'var(--vscode-button-background, #007acc)',
                  color: 'var(--vscode-button-foreground, #fff)',
                  opacity: (requests.length === 0 || selectedIdxs.size === 0) ? 0.5 : 1,
                }}
              >
                {t('runnerRunBtn')}
              </button>
            ) : (
              <button
                onClick={handleStop}
                style={{
                  ...BTN_BASE,
                  background: 'var(--vscode-button-secondaryBackground, #5a5a5a)',
                  color: 'var(--vscode-button-secondaryForeground, #fff)',
                }}
              >
                {t('runnerCancelBtn')}
              </button>

            )}
          </div>

          {/* Results list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
            {entries.length === 0 && !isRunning && summary === null && (
              <div style={{ opacity: 0.4, fontSize: 12, paddingTop: 8 }}>—</div>
            )}
            {entries.map((entry) => (
              <div
                key={entry.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  padding: '4px 0',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      color: statusColor(entry.status),
                      width: 16,
                      textAlign: 'center',
                      fontSize: 13,
                      animation: entry.status === 'running' ? 'spin 1s linear infinite' : undefined,
                    }}
                  >
                    {statusIcon(entry.status)}
                  </span>
                  {iterations > 1 && (
                    <span style={{ opacity: 0.5, fontSize: 11 }}>
                      [{t('runnerIterationLabel')} {entry.iteration}]
                    </span>
                  )}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.folderPath && (
                      <span style={{ opacity: 0.4, fontSize: 10, marginRight: 4 }}>{entry.folderPath} /</span>
                    )}
                    {entry.requestName}
                  </span>
                  {entry.response && (
                    <span style={{ opacity: 0.6, fontSize: 11, whiteSpace: 'nowrap' }}>
                      {entry.response.status} · {entry.response.time} ms · {formatSize(entry.response.bodySize)}
                    </span>
                  )}
                  {entry.testResults && entry.testResults.length > 0 && (
                    <span style={{ fontSize: 11, opacity: 0.7 }}>
                      {entry.testResults.filter((t) => t.passed).length}/{entry.testResults.length} tests
                    </span>
                  )}
                </div>
                {/* Pre-script console logs */}
                {entry.consoleLogs && entry.consoleLogs.some((l) => l.source === 'pre') && (
                  <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1 }}>
                    {entry.consoleLogs.filter((l) => l.source === 'pre').map((log, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--vscode-editor-font-family, monospace)',
                          color: log.level === 'error'
                            ? 'var(--vscode-editorWarning-foreground, #e2c08d)'
                            : log.level === 'warn'
                              ? 'var(--vscode-editorInfo-foreground, #75beff)'
                              : 'var(--panel-fg)',
                          opacity: 0.65,
                        }}
                      >
                        <span style={{ opacity: 0.5 }}>[pre:{log.level}]</span> {log.args}
                      </div>
                    ))}
                  </div>
                )}
                {/* Post-script console logs */}
                {entry.consoleLogs && entry.consoleLogs.some((l) => l.source === 'post') && (
                  <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1 }}>
                    {entry.consoleLogs.filter((l) => l.source === 'post').map((log, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--vscode-editor-font-family, monospace)',
                          color: log.level === 'error'
                            ? 'var(--vscode-editorWarning-foreground, #e2c08d)'
                            : log.level === 'warn'
                              ? 'var(--vscode-editorInfo-foreground, #75beff)'
                              : 'var(--panel-fg)',
                          opacity: 0.65,
                        }}
                      >
                        <span style={{ opacity: 0.5 }}>[post:{log.level}]</span> {log.args}
                      </div>
                    ))}
                  </div>
                )}
                {/* All test results */}
                {entry.testResults && entry.testResults.length > 0 && (
                  <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1 }}>
                    {entry.testResults.map((test, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 11,
                          color: test.passed
                            ? 'var(--vscode-testing-iconPassed, #73c991)'
                            : 'var(--vscode-testing-iconFailed, #f48771)',
                          opacity: 0.9,
                        }}
                      >
                        {test.passed ? '✓' : '✗'} {test.name}{!test.passed && test.error ? `: ${test.error}` : ''}
                      </div>
                    ))}
                  </div>
                )}
                {/* Error detail */}
                {entry.error && (
                  <div style={{ paddingLeft: 24 }}>
                    <span
                      onClick={() => toggleErrorExpand(entry.key)}
                      style={{ color: 'var(--vscode-editorWarning-foreground, #e2c08d)', fontSize: 11, cursor: 'pointer' }}
                    >
                      {expandedErrors.has(entry.key) ? '▾' : '▸'} {entry.error}
                    </span>
                  </div>
                )}
              </div>
            ))}
            <div ref={resultsEndRef} />
          </div>
        </div>

        {/* Summary bar */}
        {summary && <SummaryBar summary={summary} />}
      </div>
    </Modal>
  );
}
