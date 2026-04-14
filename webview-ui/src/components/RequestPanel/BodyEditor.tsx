import { useEffect, useMemo } from 'react';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { RequestBody } from '../../stores/requestStore';
import { KeyValueEditor } from '../shared/KeyValueEditor';
import { FormDataEditor } from '../shared/FormDataEditor';
import { vscode } from '../../vscode';
import { useI18n } from '../../i18n';
import { useEnvironments } from '../../hooks/useEnvironments';
import { ToggleGroup, Button, Textarea } from '../shared/ui';
import { EmptyState } from '../shared/EmptyState';

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
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
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
        <ToggleGroup
          options={BODY_TYPES.map(({ value, label }) => ({ value, label }))}
          value={body.type}
          onChange={(v) => handleTypeChange(v as RequestBody['type'])}
        />

        {/* Content-Type sub-selector for raw (optional) */}
        {body.type === 'raw' && (
          <span style={{ display: 'flex', gap: 2, marginLeft: 8, borderLeft: '1px solid var(--border-color)', paddingLeft: 8, alignItems: 'center' }}>
            <span className="text-secondary" style={{ fontSize: 10 }}>类型:</span>
            <ToggleGroup
              options={RAW_CONTENT_TYPES.map(({ value, label }) => ({ value, label }))}
              value={body.rawContentType || 'text/plain'}
              onChange={(v) => setBody({ ...body, rawContentType: v })}
            />
          </span>
        )}
      </div>

      {body.type === 'none' && (
        <EmptyState padding={20}>{t('noBodyMsg')}</EmptyState>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <Textarea
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
          <div className="text-secondary" style={{ fontSize: 11, paddingLeft: 2 }}>{t('graphqlQueryLabel')}</div>
          <Textarea
            className="body-textarea"
            value={body.graphql?.query || ''}
            onChange={(e) =>
              setBody({ ...body, graphql: { query: e.target.value, variables: body.graphql?.variables || '' } })
            }
            placeholder={t('graphqlQueryPlaceholder')}
            spellCheck={false}
            style={{ minHeight: 120 }}
          />
          <div className="text-secondary" style={{ fontSize: 11, paddingLeft: 2, marginTop: 4 }}>{t('graphqlVariablesLabel')}</div>
          <Textarea
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
          <Button variant="secondary" onClick={() => vscode.postMessage({ type: 'selectBinaryFile', requestId: tab.id })} style={{ alignSelf: 'flex-start' }}>
            {t('chooseFile')}
          </Button>
          {body.binaryName ? (
            <div style={{ fontSize: 12, color: 'var(--success-fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
              ✓ {body.binaryName}
              <Button variant="ghost" onClick={() => setBody({ ...body, binaryPath: undefined, binaryName: undefined })} title={t('removeItem')} style={{ padding: '0 4px', color: 'var(--error-fg)' }}>
                ×
              </Button>
            </div>
          ) : (
            <div className="text-secondary" style={{ fontSize: 12 }}>{t('noFileSelected')}</div>
          )}
        </div>
      )}
    </div>
  );
}
