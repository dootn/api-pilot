import { useEffect } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { RequestBody, KeyValuePair } from '../../stores/requestStore';
import { KeyValueEditor } from '../shared/KeyValueEditor';
import { vscode } from '../../vscode';

const BODY_TYPES: { value: RequestBody['type']; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'form-data' },
  { value: 'x-www-form-urlencoded', label: 'urlencoded' },
  { value: 'raw', label: 'raw' },
  { value: 'binary', label: 'file' },
];

const RAW_CONTENT_TYPES: { value: string; label: string }[] = [
  { value: 'text/plain', label: 'Text' },
  { value: 'application/json', label: 'JSON' },
  { value: 'application/xml', label: 'XML' },
  { value: 'text/html', label: 'HTML' },
  { value: 'application/javascript', label: 'JS' },
];

export function BodyEditor() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);

  // Listen for filePicked response from extension
  useEffect(() => {
    if (!tab) return;
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'filePicked' && msg.requestId === tab.id) {
        const { path, name } = msg.payload as { path: string; name: string };
        updateTab(tab.id, { body: { ...tab.body, binaryPath: path, binaryName: name } });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [tab?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!tab) return null;

  const body = tab.body;
  const setBody = (newBody: RequestBody) => updateTab(tab.id, { body: newBody });

  const handleTypeChange = (type: RequestBody['type']) => {
    // Preserve all existing data across type switches — only change the active type
    const newBody: RequestBody = { ...body, type };
    // Initialize default values for the new type if first time
    if ((type === 'json' || type === 'raw') && !newBody.raw) {
      newBody.raw = type === 'json' ? '{\n  \n}' : '';
    }
    if (type === 'x-www-form-urlencoded' && !newBody.urlEncoded) {
      newBody.urlEncoded = [{ key: '', value: '', enabled: true }];
    }
    if (type === 'form-data' && !newBody.formData) {
      newBody.formData = [{ key: '', value: '', enabled: true }];
    }
    setBody(newBody);
  };

  return (
    <div>
      {/* Horizontal radio-style type selector */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 8px 4px', flexWrap: 'wrap', alignItems: 'center' }}>
        {BODY_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleTypeChange(value)}
            style={{
              padding: '3px 10px',
              fontSize: 12,
              border: '1px solid',
              borderRadius: 3,
              cursor: 'pointer',
              borderColor: body.type === value ? 'var(--button-bg)' : 'var(--border-color)',
              background: body.type === value ? 'var(--button-bg)' : 'transparent',
              color: body.type === value ? 'var(--button-fg)' : 'var(--panel-fg)',
              fontWeight: body.type === value ? 600 : 400,
              opacity: body.type === value ? 1 : 0.75,
            }}
          >
            {label}
          </button>
        ))}

        {/* Content-Type sub-selector for raw */}
        {body.type === 'raw' && (
          <span style={{ display: 'flex', gap: 2, marginLeft: 8, borderLeft: '1px solid var(--border-color)', paddingLeft: 8 }}>
            {RAW_CONTENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setBody({ ...body, rawContentType: value })}
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  border: '1px solid',
                  borderRadius: 3,
                  cursor: 'pointer',
                  borderColor: body.rawContentType === value ? 'var(--info-fg)' : 'var(--border-color)',
                  background: body.rawContentType === value ? 'rgba(55,148,255,0.15)' : 'transparent',
                  color: body.rawContentType === value ? 'var(--info-fg)' : 'var(--panel-fg)',
                  opacity: body.rawContentType === value ? 1 : 0.65,
                }}
              >
                {label}
              </button>
            ))}
          </span>
        )}
      </div>

      {body.type === 'none' && (
        <div className="empty-state" style={{ padding: '20px' }}>
          <span style={{ opacity: 0.6 }}>This request does not have a body</span>
        </div>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <textarea
          className="body-textarea"
          value={body.raw || ''}
          onChange={(e) => setBody({ ...body, raw: e.target.value })}
          placeholder={body.type === 'json' ? '{\n  "key": "value"\n}' : 'Enter raw body'}
          spellCheck={false}
        />
      )}

      {body.type === 'x-www-form-urlencoded' && (
        <KeyValueEditor
          items={body.urlEncoded || [{ key: '', value: '', enabled: true }]}
          onChange={(items) => setBody({ ...body, urlEncoded: items })}
        />
      )}

      {body.type === 'form-data' && (
        <KeyValueEditor
          items={body.formData || [{ key: '', value: '', enabled: true }]}
          onChange={(items) => setBody({ ...body, formData: items })}
        />
      )}

      {body.type === 'binary' && (
        <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="save-btn"
            onClick={() => vscode.postMessage({ type: 'selectBinaryFile', requestId: tab.id })}
            style={{ alignSelf: 'flex-start' }}
          >
            📂 Choose File
          </button>
          {body.binaryName ? (
            <div style={{ fontSize: 12, color: 'var(--success-fg)' }}>
              ✓ {body.binaryName}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.5 }}>No file selected</div>
          )}
        </div>
      )}
    </div>
  );
}
