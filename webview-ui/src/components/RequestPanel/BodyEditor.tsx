import { useEffect, useMemo } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { RequestBody, KeyValuePair, FormDataField } from '../../stores/requestStore';
import { KeyValueEditor } from '../shared/KeyValueEditor';
import { FormDataEditor } from '../shared/FormDataEditor';
import { vscode } from '../../vscode';
import { useI18n } from '../../i18n';
import { useEnvironments } from '../../hooks/useEnvironments';

const BODY_TYPES: { value: RequestBody['type']; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'form-data' },
  { value: 'x-www-form-urlencoded', label: 'urlencoded' },
  { value: 'raw', label: 'raw' },
  { value: 'graphql', label: 'GraphQL' },
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
  const t = useI18n();
  const { environments, activeEnvId } = useEnvironments();

  const knownVarNames = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId);
    const vars = (env?.variables ?? []).filter((v) => v.enabled).map((v) => v.key);
    return new Set(vars);
  }, [environments, activeEnvId]);

  const varValues = useMemo(() => {
    const env = environments.find((e) => e.id === activeEnvId);
    const vars = (env?.variables ?? []).filter((v) => v.enabled);
    return new Map(vars.map((v) => [v.key, v.value]));
  }, [environments, activeEnvId]);

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
    // Set default raw content type to text/plain if not set
    if (type === 'raw' && !newBody.rawContentType) {
      newBody.rawContentType = 'text/plain';
    }
    if (type === 'x-www-form-urlencoded' && !newBody.urlEncoded) {
      newBody.urlEncoded = [{ key: '', value: '', enabled: true }];
    }
    if (type === 'form-data' && !newBody.formData) {
      newBody.formData = [{ key: '', value: '', enabled: true, type: 'text' }];
    }
    if (type === 'graphql' && !newBody.graphql) {
      newBody.graphql = { query: '', variables: '' };
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

        {/* Content-Type sub-selector for raw (optional) */}
        {body.type === 'raw' && (
          <span style={{ display: 'flex', gap: 2, marginLeft: 8, borderLeft: '1px solid var(--border-color)', paddingLeft: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, opacity: 0.6 }}>类型:</span>
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
          <span style={{ opacity: 0.6 }}>{t('noBodyMsg')}</span>
        </div>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <textarea
          className="body-textarea"
          value={body.raw || ''}
          onChange={(e) => setBody({ ...body, raw: e.target.value })}
          placeholder={body.type === 'json' ? t('jsonBodyPlaceholder') : t('rawBodyPlaceholder')}
          spellCheck={false}
        />
      )}

      {body.type === 'x-www-form-urlencoded' && (
        <KeyValueEditor
          items={body.urlEncoded || [{ key: '', value: '', enabled: true }]}
          onChange={(items) => setBody({ ...body, urlEncoded: items })}
          knownVarNames={knownVarNames}
          varValues={varValues}
        />
      )}

      {body.type === 'form-data' && (
        <FormDataEditor
          items={body.formData || [{ key: '', value: '', enabled: true, type: 'text' }]}
          onChange={(items) => setBody({ ...body, formData: items })}
          requestId={tab.id}
          knownVarNames={knownVarNames}
          varValues={varValues}
        />
      )}

      {body.type === 'graphql' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px' }}>
          <div style={{ fontSize: 11, opacity: 0.6, paddingLeft: 2 }}>{t('graphqlQueryLabel')}</div>
          <textarea
            className="body-textarea"
            value={body.graphql?.query || ''}
            onChange={(e) =>
              setBody({ ...body, graphql: { query: e.target.value, variables: body.graphql?.variables || '' } })
            }
            placeholder={t('graphqlQueryPlaceholder')}
            spellCheck={false}
            style={{ minHeight: 120 }}
          />
          <div style={{ fontSize: 11, opacity: 0.6, paddingLeft: 2, marginTop: 4 }}>{t('graphqlVariablesLabel')}</div>
          <textarea
            className="body-textarea"
            value={body.graphql?.variables || ''}
            onChange={(e) =>
              setBody({ ...body, graphql: { query: body.graphql?.query || '', variables: e.target.value } })
            }
            placeholder={t('graphqlVarsPlaceholder')}
            spellCheck={false}
            style={{ minHeight: 72 }}
          />
        </div>
      )}

      {body.type === 'binary' && (
        <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="save-btn"
            onClick={() => vscode.postMessage({ type: 'selectBinaryFile', requestId: tab.id })}
            style={{ alignSelf: 'flex-start' }}
          >
            {t('chooseFile')}
          </button>
          {body.binaryName ? (
            <div style={{ fontSize: 12, color: 'var(--success-fg)' }}>
              ✓ {body.binaryName}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.5 }}>{t('noFileSelected')}</div>
          )}
        </div>
      )}
    </div>
  );
}
