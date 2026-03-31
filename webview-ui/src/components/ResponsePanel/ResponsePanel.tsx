import { useState } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { ApiResponse, TestResult, ConsoleEntry } from '../../stores/requestStore';
import { vscode } from '../../vscode';
import { SyntaxHighlighter, detectHighlightLang, langLabel } from './SyntaxHighlighter';

type ResponseTab = 'body' | 'headers' | 'tests' | 'console';

function formatJson(text: string): string {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

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

type MediaCategory = 'image' | 'video' | 'audio' | 'pdf' | 'binary' | 'text';

function getMediaCategory(contentType: string | undefined): MediaCategory {
  if (!contentType) return 'text';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType === 'application/pdf') return 'pdf';
  if (
    contentType === 'application/octet-stream' ||
    contentType === 'application/zip' ||
    contentType === 'application/x-zip-compressed' ||
    contentType === 'application/x-tar' ||
    contentType === 'application/gzip'
  ) {
    return 'binary';
  }
  return 'text';
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

function MediaBody({ response, tabUrl }: { response: ApiResponse; tabUrl?: string }) {
  const category = getMediaCategory(response.contentType);

  if (!response.bodyBase64 && category !== 'text') {
    return <div className="empty-state">Binary content received but could not be rendered.</div>;
  }

  const dataUrl = response.bodyBase64 && response.contentType
    ? `data:${response.contentType};base64,${response.bodyBase64}`
    : undefined;

  const downloadBtn = (
    <button
      onClick={() => downloadResponse(response, tabUrl)}
      style={{
        marginBottom: 12,
        padding: '4px 12px',
        cursor: 'pointer',
        background: 'var(--button-bg)',
        color: 'var(--button-fg)',
        border: 'none',
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      ⬇ Download
    </button>
  );

  if (category === 'image' && dataUrl) {
    return (
      <div style={{ padding: 12 }}>
        {downloadBtn}
        <img
          src={dataUrl}
          alt="response"
          style={{ maxWidth: '100%', display: 'block', borderRadius: 4 }}
        />
      </div>
    );
  }

  if (category === 'video' && dataUrl) {
    return (
      <div style={{ padding: 12 }}>
        {downloadBtn}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video controls style={{ maxWidth: '100%', display: 'block' }}>
          <source src={dataUrl} type={response.contentType} />
        </video>
      </div>
    );
  }

  if (category === 'audio' && dataUrl) {
    return (
      <div style={{ padding: 12 }}>
        {downloadBtn}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls style={{ width: '100%', display: 'block' }}>
          <source src={dataUrl} type={response.contentType} />
        </audio>
      </div>
    );
  }

  if (category === 'pdf' && dataUrl) {
    return (
      <div style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {downloadBtn}
        <embed
          src={dataUrl}
          type="application/pdf"
          style={{ flex: 1, minHeight: 400, width: '100%', border: 'none', borderRadius: 4 }}
        />
      </div>
    );
  }

  // binary or unrenderable
  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.7 }}>
        {response.contentType || 'Binary'} · {formatSize(response.bodySize)}
      </div>
      {downloadBtn}
    </div>
  );
}

export function ResponsePanel() {
  const { activeTabId, tabs } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);
  const response = tab?.response ?? null;
  const responseError = tab?.responseError ?? null;
  const loading = tab?.loading ?? false;
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');

  if (loading) {
    return (
      <div className="response-panel">
        <div className="empty-state">
          <div className="loading-spinner" />
          <div style={{ marginTop: 12 }}>Sending request...</div>
        </div>
      </div>
    );
  }

  if (responseError) {
    return (
      <div className="response-panel">
        <div className="error-message">
          <strong>Error: </strong>{responseError}
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="response-panel">
        <div className="empty-state">
          <div className="icon">⚡</div>
          <div>Enter a URL and click Send to make a request</div>
          <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>
            Ctrl+Enter to send
          </div>
        </div>
      </div>
    );
  }

  const mediaCategory = getMediaCategory(response.contentType);
  const isMediaBody = mediaCategory !== 'text';
  const highlightLang = isMediaBody ? 'text' : detectHighlightLang(response.contentType, response.body);
  const formattedBody = highlightLang === 'json' ? formatJson(response.body) : response.body;
  const bodyLangLabel = langLabel(highlightLang, response.contentType);

  return (
    <div className="response-panel">
      <div className="response-meta">
        <span className={`status ${getStatusClass(response.status)}`}>
          {response.status} {response.statusText}
        </span>
        <span className="time">{response.time}ms</span>
        <span className="size">{formatSize(response.bodySize)}</span>
        {!isMediaBody && (
          <button
            onClick={() => downloadResponse(response, tab?.url)}
            title="Download response body"
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
            ⬇ Download
          </button>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          Body
        </button>
        <button
          className={`tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers ({Object.keys(response.headers).length})
        </button>
        {(response.testResults?.length ?? 0) > 0 && (
          <button
            className={`tab ${activeTab === 'tests' ? 'active' : ''}`}
            onClick={() => setActiveTab('tests')}
          >
            Tests
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
          </button>
        )}
        {(response.consoleEntries?.length ?? 0) > 0 && (
          <button
            className={`tab ${activeTab === 'console' ? 'active' : ''}`}
            onClick={() => setActiveTab('console')}
          >
            Console
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
          </button>
        )}
      </div>

      <div className="response-body">
        {activeTab === 'body' && (
          isMediaBody
            ? <MediaBody response={response} tabUrl={tab?.url} />
            : (
              <div style={{ position: 'relative' }}>
                {bodyLangLabel && (
                  <div style={{
                    position: 'absolute', top: 6, right: 10, zIndex: 1,
                    fontSize: 10, opacity: 0.4, pointerEvents: 'none',
                    fontFamily: 'var(--vscode-editor-font-family, monospace)',
                    userSelect: 'none',
                  }}>
                    {bodyLangLabel}
                  </div>
                )}
                <SyntaxHighlighter
                  code={formattedBody || '(empty response)'}
                  lang={highlightLang}
                />
              </div>
            )
        )}

        {activeTab === 'headers' && (
          <table className="response-headers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
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
        )}

        {activeTab === 'console' && (
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
        )}
      </div>
    </div>
  );
}
