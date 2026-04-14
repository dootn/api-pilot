import { useState } from 'react';
import { useActiveTab } from '../../stores/tabStore';
import type { ApiResponse } from '../../stores/requestStore';
import { vscode } from '../../vscode';
import { BodyViewer } from './BodyViewer';
import { useI18n } from '../../i18n';
import { TestResultsTab } from './TestResultsTab';
import { ConsoleTab } from './ConsoleTab';
import { TimingTab } from './TimingTab';
import { SslErrorSummary, SslTab } from './SslTab';
import { formatBytes } from '../../utils/formatters';
import { Button } from '../shared/ui';

type ResponseTab = 'body' | 'headers' | 'tests' | 'console' | 'ssl' | 'timing';

function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  return 'server-error';
}

const formatSize = formatBytes;

function getFilenameFromResponse(response: ApiResponse, url?: string): string {
  const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\n]+)/i);
    if (match) return decodeURIComponent(match[1].trim().replace(/"/g, ''));
  }
  if (url) {
    try {
      const path = new URL(url).pathname;
      const name = path.split('/').pop();
      if (name) return name;
    } catch { /* ignore */ }
  }
  const ext = response.contentType ? `.${response.contentType.split('/')[1]?.split('+')[0] ?? 'bin'}` : '.bin';
  return `response${ext}`;
}

function downloadResponse(response: ApiResponse, url?: string) {
  const filename = getFilenameFromResponse(response, url);
  vscode.postMessage({
    type: 'downloadFile',
    payload: {
      filename,
      contentType: response.contentType,
      bodyBase64: response.bodyBase64,
      body: response.body,
    },
  });
}

export function ResponsePanel() {
  const tab = useActiveTab();
  const response = tab?.response ?? null;
  const responseError = tab?.responseError ?? null;
  const loading = tab?.loading ?? false;
  const sslInfo = tab?.sslInfo ?? null;
  const t = useI18n();
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');

  if (loading) {
    return (
      <div className="response-panel">
        <div className="empty-state">
          <div className="loading-spinner" />
          <div style={{ marginTop: 12 }}>{t('sendingRequest')}</div>
        </div>
      </div>
    );
  }

  if (responseError) {
    return (
      <div className="response-panel">
        <div className="error-message">
          <strong>{t('respErrorPrefix')}</strong>{responseError}
        </div>
        {sslInfo && <SslErrorSummary sslInfo={sslInfo} />}
      </div>
    );
  }

  if (!response) {
    return (
      <div className="response-panel">
        <div className="empty-state">
          <div className="icon">⚡</div>
          <div>{t('emptyResponseHint')}</div>
          <div style={{ marginTop: 4, fontSize: 11 }} className="text-secondary">
            {t('ctrlEnterHint')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="response-panel">
      <div className="response-meta">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="text-secondary" style={{ fontSize: 10 }}>{t('respStatus')}</span>
          <span className={`status ${getStatusClass(response.status)}`}>
            {response.status} {response.statusText}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="text-secondary" style={{ fontSize: 10 }}>{t('respTime')}</span>
          <span className="time">{response.time}ms</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="text-secondary" style={{ fontSize: 10 }}>{t('respSize')}</span>
          <span className="size">{formatSize(response.bodySize)}</span>
        </div>
        <Button
          variant="ghost"
          btnSize="sm"
          onClick={() => downloadResponse(response, tab?.url)}
          title={t('respDownloadTitle')}
          className="ml-auto"
        >
          {t('respDownload')}
        </Button>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          {t('respBody')}
        </button>
        <button
          className={`tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          {t('respHeaders')} ({Object.keys(response.headers).length})
        </button>
        <button
          className={`tab ${activeTab === 'tests' ? 'active' : ''}`}
          onClick={() => setActiveTab('tests')}
          style={
            (response.testResults?.length ?? 0) === 0 ? { opacity: 0.6, pointerEvents: 'auto' } : {}
          }
        >
          {t('respTests')}
          {(response.testResults?.length ?? 0) > 0 && (
            <span
              style={{
                marginLeft: 5, fontSize: 10, fontWeight: 600, padding: '1px 5px',
                borderRadius: 8, lineHeight: '14px', display: 'inline-block',
                verticalAlign: 'middle',
                background: response.testResults?.every((r) => r.passed)
                  ? 'var(--success-fg, #4ec9b0)'
                  : 'var(--error-fg, #f14c4c)',
                color: '#fff',
              }}
            >
              {response.testResults?.filter((r) => r.passed).length}/{response.testResults?.length}
            </span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'console' ? 'active' : ''}`}
          onClick={() => setActiveTab('console')}
          style={
            (response.consoleEntries?.length ?? 0) === 0 ? { opacity: 0.6, pointerEvents: 'auto' } : {}
          }
        >
          {t('respConsole')}
          {(response.consoleEntries?.length ?? 0) > 0 && (
            <span
              style={{
                marginLeft: 5, fontSize: 10, fontWeight: 600, padding: '1px 5px',
                borderRadius: 8, lineHeight: '14px', display: 'inline-block',
                verticalAlign: 'middle',
                background: response.consoleEntries?.some((e) => e.level === 'error')
                  ? 'var(--error-fg, #f14c4c)'
                  : response.consoleEntries?.some((e) => e.level === 'warn')
                  ? 'var(--warning-fg, #cca700)'
                  : 'var(--badge-bg)',
                color: response.consoleEntries?.some((e) => e.level === 'error') ||
                  response.consoleEntries?.some((e) => e.level === 'warn') ? '#fff' : 'var(--badge-fg)',
              }}
            >
              {response.consoleEntries?.length}
            </span>
          )}
        </button>
        {sslInfo && (
          <button
            className={`tab ${activeTab === 'ssl' ? 'active' : ''}`}
            onClick={() => setActiveTab('ssl')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {t('respSSL')}
            {!sslInfo.authorized && (
              <span
                style={{
                  marginLeft: 2,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: 8,
                  lineHeight: '14px',
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  background: 'var(--warning-fg, #cca700)',
                  color: '#fff',
                }}
                title={t('respCertNotTrusted')}
              >
                !
              </span>
            )}
          </button>
        )}
        {response.timingBreakdown && (
          <button
            className={`tab ${activeTab === 'timing' ? 'active' : ''}`}
            onClick={() => setActiveTab('timing')}
          >
            {t('timingTab')}
          </button>
        )}
      </div>

      <div className="response-body">
        {activeTab === 'body' && (
          <BodyViewer
            body={response.body}
            contentType={response.contentType}
            bodyBase64={response.bodyBase64}
            bodySize={response.bodySize}
          />
        )}

        {activeTab === 'headers' && (
          <table className="response-headers-table">
            <thead>
              <tr>
                <th>{t('headerColName')}</th>
                <th>{t('headerColValue')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(response.headers).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'tests' && (
          <TestResultsTab results={response.testResults ?? []} />
        )}

        {activeTab === 'console' && (
          <ConsoleTab entries={response.consoleEntries ?? []} />
        )}

        {activeTab === 'timing' && response.timingBreakdown && (
          <TimingTab timing={response.timingBreakdown} totalTime={response.time} />
        )}

        {activeTab === 'ssl' && sslInfo && (
          <SslTab sslInfo={sslInfo} />
        )}
      </div>
    </div>
  );
}
