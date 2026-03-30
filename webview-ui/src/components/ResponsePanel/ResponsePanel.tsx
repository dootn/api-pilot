import { useState } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { ApiResponse } from '../../stores/requestStore';

type ResponseTab = 'body' | 'headers';

function formatJson(text: string): string {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
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

  const bodyIsJson = isJson(response.body);
  const formattedBody = bodyIsJson ? formatJson(response.body) : response.body;

  return (
    <div className="response-panel">
      <div className="response-meta">
        <span className={`status ${getStatusClass(response.status)}`}>
          {response.status} {response.statusText}
        </span>
        <span className="time">{response.time}ms</span>
        <span className="size">{formatSize(response.bodySize)}</span>
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
      </div>

      <div className="response-body">
        {activeTab === 'body' && (
          <pre>{formattedBody || '(empty response)'}</pre>
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
      </div>
    </div>
  );
}
