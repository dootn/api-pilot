import { useState } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { ApiResponse, TestResult, ConsoleEntry, SSLInfo } from '../../stores/requestStore';
import { vscode } from '../../vscode';
import { BodyViewer } from './BodyViewer';
import { useI18n } from '../../i18n';

type ResponseTab = 'body' | 'headers' | 'tests' | 'console' | 'ssl' | 'timing';

function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  return 'server-error';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const { activeTabId, tabs } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);
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
        {sslInfo && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, opacity: 0.7 }}>{t('sslCertDetails')}</div>
            <div style={{
              padding: '8px 10px', marginBottom: 8, borderRadius: 4,
              background: sslInfo.authorized ? 'rgba(78,201,176,0.1)' : 'rgba(241,76,76,0.1)',
              borderLeft: `3px solid ${
                sslInfo.authorized ? 'var(--success-fg, #4ec9b0)' : 'var(--error-fg, #f14c4c)'
              }`,
            }}>
              <div style={{ fontWeight: 600, marginBottom: sslInfo.authorizationError ? 4 : 0 }}>
                {sslInfo.authorized ? t('sslCertValid') : t('sslCertInvalid')}
              </div>
              {sslInfo.authorizationError && (
                <div style={{ fontSize: 11, opacity: 0.8 }}>{sslInfo.authorizationError}</div>
              )}
            </div>
            {sslInfo.certificate && (
              <table style={{ width: '100%', fontSize: 11 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '5px 0', opacity: 0.6, width: '30%' }}>{t('sslSubject')}</td>
                    <td style={{ padding: '5px 0' }}>{sslInfo.certificate.subject.CN || 'N/A'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '5px 0', opacity: 0.6 }}>{t('sslIssuer')}</td>
                    <td style={{ padding: '5px 0' }}>{sslInfo.certificate.issuer.CN || 'N/A'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '5px 0', opacity: 0.6 }}>{t('sslValidTo')}</td>
                    <td style={{ padding: '5px 0' }}>{new Date(sslInfo.certificate.validTo).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5px 0', opacity: 0.6 }}>{t('sslProtocolCipher')}</td>
                    <td style={{ padding: '5px 0', fontFamily: 'var(--vscode-editor-font-family, monospace)' }}>
                      {sslInfo.protocol} / {sslInfo.cipher.name}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!response) {
    return (
      <div className="response-panel">
        <div className="empty-state">
          <div className="icon">⚡</div>
          <div>{t('emptyResponseHint')}</div>
          <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>
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
          <span style={{ fontSize: 10, opacity: 0.5 }}>{t('respStatus')}</span>
          <span className={`status ${getStatusClass(response.status)}`}>
            {response.status} {response.statusText}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10, opacity: 0.5 }}>{t('respTime')}</span>
          <span className="time">{response.time}ms</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10, opacity: 0.5 }}>{t('respSize')}</span>
          <span className="size">{formatSize(response.bodySize)}</span>
        </div>
        <button
          onClick={() => downloadResponse(response, tab?.url)}
          title={t('respDownloadTitle')}
          style={{
            marginLeft: 'auto',
            padding: '2px 8px',
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--panel-fg)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            fontSize: 11,
            opacity: 0.7,
          }}
        >
          {t('respDownload')}
        </button>
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
          (response.testResults?.length ?? 0) > 0 ? (
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(response.testResults ?? []).map((result: TestResult, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px',
                    borderRadius: 4,
                    background: result.passed
                      ? 'rgba(78,201,176,0.08)'
                      : 'rgba(241,76,76,0.08)',
                    borderLeft: `3px solid ${
                      result.passed ? 'var(--success-fg, #4ec9b0)' : 'var(--error-fg, #f14c4c)'
                    }`,
                  }}
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{result.passed ? '✓' : '✗'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12 }}>{result.name}</div>
                    {result.error && (
                      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2, wordBreak: 'break-word' }}>
                        {result.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ paddingTop: 60, paddingBottom: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{t('respNoTests')}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {t('respNoTestsHint')}
              </div>
            </div>
          )
        )}

        {activeTab === 'console' && (
          (response.consoleEntries?.length ?? 0) > 0 ? (
            <div style={{ padding: '4px 0', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 12 }}>
              {(response.consoleEntries ?? []).map((entry: ConsoleEntry, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                    padding: '3px 12px',
                    borderBottom: '1px solid var(--border-color)',
                    background:
                      entry.level === 'error' ? 'rgba(241,76,76,0.06)' :
                      entry.level === 'warn'  ? 'rgba(204,167,0,0.06)' :
                      'transparent',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0, fontSize: 10, marginTop: 1,
                      color:
                        entry.level === 'error' ? 'var(--error-fg, #f14c4c)' :
                        entry.level === 'warn'  ? 'var(--warning-fg, #cca700)' :
                        'var(--info-fg, #3794ff)',
                    }}
                  >
                    {entry.level === 'error' ? '✕' : entry.level === 'warn' ? '⚠' : 'ℹ'}
                  </span>
                  <span style={{ opacity: 0.4, flexShrink: 0, fontSize: 10, marginTop: 1 }}>[{entry.source}]</span>
                  <span style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{entry.args}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ paddingTop: 60, paddingBottom: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🖥 </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{t('respNoConsole')}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {t('respNoConsoleHint')}
              </div>
            </div>
          )
        )}

        {activeTab === 'timing' && response.timingBreakdown && (() => {
          const { connect, ttfb, download } = response.timingBreakdown;
          const total = connect + ttfb + download || 1;
          const phases: { label: string; time: number; color: string }[] = [
            { label: t('timingConnect'), time: connect, color: '#4fc3f7' },
            { label: t('timingTtfb'),    time: ttfb,    color: '#81c995' },
            { label: t('timingDownload'),time: download, color: '#ffb74d' },
          ];
          return (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {phases.map(({ label, time, color }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, opacity: 0.8 }}>
                    <span>{label}</span>
                    <span>{time}ms ({((time / total) * 100).toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max((time / total) * 100, 0.5)}%`, height: '100%', background: color, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)', fontSize: 11, opacity: 0.6 }}>
                {t('timingTotal')}: {response.time}ms
              </div>
            </div>
          );
        })()}

        {activeTab === 'ssl' && sslInfo && (
          <div style={{ padding: '12px 16px', fontSize: 12 }}>
            {/* Connection Status */}
            <div style={{
              padding: '10px 12px',
              marginBottom: 12,
              borderRadius: 4,
              background: sslInfo.authorized
                ? 'rgba(78,201,176,0.1)'
                : 'rgba(204,167,0,0.1)',
              borderLeft: `3px solid ${
                sslInfo.authorized
                  ? 'var(--success-fg, #4ec9b0)'
                  : 'var(--warning-fg, #cca700)'
              }`,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {sslInfo.authorized ? t('sslSecureConn') : t('sslNotTrusted')}
              </div>
              {sslInfo.authorizationError && (
                <div style={{ fontSize: 11, opacity: 0.8 }}>
                  {sslInfo.authorizationError}
                </div>
              )}
            </div>

            {/* Protocol & Cipher */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.7 }}>
                {t('sslConnDetails')}
              </h4>
              <table style={{ width: '100%', fontSize: 11 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', opacity: 0.6 }}>{t('sslProtocol')}</td>
                    <td style={{ padding: '6px 0', fontFamily: 'var(--vscode-editor-font-family, monospace)' }}>
                      {sslInfo.protocol}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', opacity: 0.6 }}>{t('sslCipher')}</td>
                    <td style={{ padding: '6px 0', fontFamily: 'var(--vscode-editor-font-family, monospace)' }}>
                      {sslInfo.cipher.name} ({sslInfo.cipher.version})
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Certificate Details */}
            {sslInfo.certificate && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.7 }}>
                  {t('sslCertSection')}
                </h4>
                <table style={{ width: '100%', fontSize: 11 }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 0', opacity: 0.6, width: '30%' }}>{t('sslSubject')}</td>
                      <td style={{ padding: '6px 0', fontFamily: 'var(--vscode-editor-font-family, monospace)' }}>
                        {sslInfo.certificate.subject.CN || 'N/A'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 0', opacity: 0.6 }}>{t('sslIssuer')}</td>
                      <td style={{ padding: '6px 0', fontFamily: 'var(--vscode-editor-font-family, monospace)' }}>
                        {sslInfo.certificate.issuer.CN || 'N/A'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 0', opacity: 0.6 }}>{t('sslValidFrom')}</td>
                      <td style={{ padding: '6px 0' }}>
                        {new Date(sslInfo.certificate.validFrom).toLocaleString()}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 0', opacity: 0.6 }}>{t('sslValidTo')}</td>
                      <td style={{ padding: '6px 0' }}>
                        {new Date(sslInfo.certificate.validTo).toLocaleString()}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 0', opacity: 0.6 }}>{t('sslSerial')}</td>
                      <td style={{ padding: '6px 0', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 10 }}>
                        {sslInfo.certificate.serialNumber}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 0', opacity: 0.6 }}>{t('sslFingerprint')}</td>
                      <td style={{ padding: '6px 0', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 10, wordBreak: 'break-all' }}>
                        {sslInfo.certificate.fingerprint}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 0', opacity: 0.6 }}>{t('sslSignatureAlg')}</td>
                      <td style={{ padding: '6px 0', fontFamily: 'var(--vscode-editor-font-family, monospace)' }}>
                        {sslInfo.certificate.signatureAlgorithm}
                      </td>
                    </tr>
                    {sslInfo.certificate.subjectAltNames && sslInfo.certificate.subjectAltNames.length > 0 && (
                      <tr>
                        <td style={{ padding: '6px 0', opacity: 0.6, verticalAlign: 'top' }}>{t('sslSubjectAltNames')}</td>
                        <td style={{ padding: '6px 0', fontSize: 10 }}>
                          {sslInfo.certificate.subjectAltNames.join(', ')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Certificate Chain */}
            {sslInfo.certificateChain && sslInfo.certificateChain.length > 1 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.7 }}>
                  {t('sslCertChain')} ({sslInfo.certificateChain.length} certificates)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sslInfo.certificateChain.map((cert, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        #{idx + 1} {cert.subject.CN || 'Unknown'}
                      </div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>
                        Issued by: {cert.issuer.CN || 'Unknown'}
                      </div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>
                        Valid: {new Date(cert.validFrom).toLocaleDateString()} - {new Date(cert.validTo).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
