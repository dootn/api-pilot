import { useRef, useState } from 'react';
import { useTabStore } from '../../stores/tabStore';
import type { GrpcOptions, GrpcServiceDef, GrpcMethodDef, GrpcMessageDef } from '../../stores/requestStore';
import { vscode } from '../../vscode';
import { useI18n, type TranslationKey } from '../../i18n';

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
  marginBottom: 3,
  display: 'block',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 13,
  padding: '4px 8px',
  background: 'var(--input-bg, #3c3c3c)',
  border: '1px solid var(--border-color, #555)',
  borderRadius: 4,
  color: 'var(--panel-fg)',
};

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 16,
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.5,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 8,
};

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginBottom: 8,
};

function callTypeLabel(m: GrpcMethodDef, t: (key: TranslationKey) => string): string {
  if (m.requestStream && m.responseStream) return t('grpcCallTypeBidi');
  if (m.requestStream) return t('grpcCallTypeClient');
  if (m.responseStream) return t('grpcCallTypeServer');
  return t('grpcCallTypeUnary');
}

function generateTemplate(
  typeName: string,
  messageDefs: Record<string, GrpcMessageDef>,
  depth = 0
): unknown {
  if (depth > 5) return {};
  const cleanName = typeName.replace(/^\./, '');
  const def = messageDefs[cleanName];
  if (!def) return {};
  const obj: Record<string, unknown> = {};
  for (const field of def.fields) {
    const val = generateFieldValue(field.typeName, messageDefs, depth + 1);
    obj[field.name] = field.repeated ? [val] : val;
  }
  return obj;
}

function generateFieldValue(
  typeName: string,
  messageDefs: Record<string, GrpcMessageDef>,
  depth: number
): unknown {
  switch (typeName) {
    case 'string': return '';
    case 'bool': return false;
    case 'bytes': return '';
    case 'double': case 'float': return 0.0;
    case 'int32': case 'int64': case 'uint32': case 'uint64':
    case 'sint32': case 'sint64': case 'fixed32': case 'fixed64':
    case 'sfixed32': case 'sfixed64': return 0;
    default: return generateTemplate(typeName, messageDefs, depth);
  }
}

export function GrpcOptions() {
  const { getActiveTab, updateTab } = useTabStore();
  const tab = getActiveTab();
  const t = useI18n();
  const protoFileInputRef = useRef<HTMLInputElement>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [sendPayload, setSendPayload] = useState('{\n  \n}');
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!tab) return null;

  const opts: GrpcOptions = tab.grpcOptions ?? {};
  const services: GrpcServiceDef[] = tab.grpcServices ?? [];

  function setOpt<K extends keyof GrpcOptions>(key: K, value: GrpcOptions[K]) {
    updateTab(tab!.id, { grpcOptions: { ...opts, [key]: value }, isDirty: true });
  }

  const status = tab.grpcStatus ?? 'idle';
  const isStreaming = status === 'streaming';
  const isClientStreaming = (() => {
    const svc = services.find((s) => s.name === opts.serviceName);
    const m = svc?.methods.find((m) => m.name === opts.methodName);
    return m?.requestStream ?? false;
  })();
  const showSendPanel = isClientStreaming && isStreaming;

  function handleStreamSend() {
    if (!tab?.grpcCallId) return;
    vscode.postMessage({
      type: 'grpcSend',
      payload: { callId: tab.grpcCallId, data: sendPayload },
    });
  }

  function handleEndStream() {
    if (!tab?.grpcCallId) return;
    vscode.postMessage({
      type: 'grpcCancel',
      payload: { callId: tab.grpcCallId },
    });
  }

  function handleStreamKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (showSendPanel) handleStreamSend();
    }
  }

  function handleCopyTemplate() {
    if (!templateContent) return;
    navigator.clipboard.writeText(templateContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleProtoFileClick() {
    protoFileInputRef.current?.click();
  }

  function handleProtoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      updateTab(tab!.id, {
        grpcOptions: { ...opts, protoSource: 'proto', protoContent: content, protoFileName: file.name },
        isDirty: true,
      });
      // Trigger proto loading
      vscode.postMessage({
        type: 'grpcLoadProto',
        tabId: tab!.id,
        payload: { protoContent: content, protoFileName: file.name },
      });
    };
    reader.readAsText(file);
    // Reset so same file can be re-uploaded
    e.target.value = '';
  }

  function handleReflect() {
    if (!tab?.url.trim()) return;
    updateTab(tab!.id, { grpcOptions: { ...opts, protoSource: 'reflection' }, isDirty: true });
    vscode.postMessage({
      type: 'grpcReflect',
      tabId: tab!.id,
      payload: {
        id: tab!.id,
        name: tab!.name,
        protocol: tab!.protocol,
        method: tab!.method,
        url: tab!.url.trim(),
        params: [],
        headers: [],
        body: { type: 'none' },
        auth: tab!.auth,
        grpcOptions: tab!.grpcOptions,
        sslVerify: tab!.sslVerify ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  }

  const selectedService = services.find((s) => s.name === opts.serviceName);
  const methods = selectedService?.methods ?? [];

  const metadataRows = opts.metadata ?? [{ key: '', value: '', enabled: true }];

  function updateMetadata(index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) {
    const next = metadataRows.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    setOpt('metadata', next);
  }

  function addMetadataRow() {
    setOpt('metadata', [...metadataRows, { key: '', value: '', enabled: true }]);
  }

  function deleteMetadataRow(index: number) {
    const next = metadataRows.filter((_, i) => i !== index);
    setOpt('metadata', next.length > 0 ? next : [{ key: '', value: '', enabled: true }]);
  }

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

      {/* ── Service Discovery ─────────────────────────── */}
      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE}>{t('grpcServiceDiscovery')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            onClick={handleReflect}
            disabled={!tab.url.trim()}
            style={{
              flex: 1,
              padding: '5px 10px',
              fontSize: 12,
              cursor: tab.url.trim() ? 'pointer' : 'not-allowed',
              background: opts.protoSource === 'reflection' ? 'var(--button-bg)' : 'var(--input-bg, #3c3c3c)',
              color: opts.protoSource === 'reflection' ? 'var(--button-fg)' : 'var(--panel-fg)',
              border: '1px solid var(--border-color, #555)',
              borderRadius: 4,
            }}
          >
            {t('grpcReflectBtn')}
          </button>
          <button
            onClick={handleProtoFileClick}
            style={{
              flex: 1,
              padding: '5px 10px',
              fontSize: 12,
              cursor: 'pointer',
              background: opts.protoSource === 'proto' ? 'var(--button-bg)' : 'var(--input-bg, #3c3c3c)',
              color: opts.protoSource === 'proto' ? 'var(--button-fg)' : 'var(--panel-fg)',
              border: '1px solid var(--border-color, #555)',
              borderRadius: 4,
            }}
          >
            {t('grpcUploadProtoBtn')}
          </button>
          <input
            ref={protoFileInputRef}
            type="file"
            accept=".proto"
            style={{ display: 'none' }}
            onChange={handleProtoFileChange}
          />
        </div>
        {opts.protoFileName && (
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>
            {t('grpcProtoFileLabel')} {opts.protoFileName}
          </div>
        )}
        {services.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={LABEL_STYLE}>{t('grpcServiceLabel')}</label>
              <select
                value={opts.serviceName ?? ''}
                onChange={(e) => {
                  const svc = e.target.value;
                  const firstMethod = services.find((s) => s.name === svc)?.methods[0]?.name ?? '';
                  updateTab(tab!.id, {
                    grpcOptions: { ...opts, serviceName: svc, methodName: firstMethod },
                    isDirty: true,
                  });
                }}
                style={INPUT_STYLE}
              >
                <option value="">{t('grpcSelectService')}</option>
                {services.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>{t('grpcMethodLabel')}</label>
              <select
                value={opts.methodName ?? ''}
                onChange={(e) => setOpt('methodName', e.target.value)}
                disabled={!opts.serviceName}
                style={INPUT_STYLE}
              >
                <option value="">{t('grpcSelectMethod')}</option>
                {methods.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({callTypeLabel(m, t)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, opacity: 0.45, fontStyle: 'italic' }}>
            {t('grpcNoServicesHint')}
          </div>
        )}
      </div>

      {/* ── Request Body ──────────────────────────────── */}
      <div style={SECTION_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={SECTION_TITLE}>{t('grpcReqBodyLabel')}</div>
          <button
            onClick={() => {
              const svc = services.find((s) => s.name === opts.serviceName);
              const method = svc?.methods.find((m) => m.name === opts.methodName);
              if (!method || !tab.grpcMessageDefs) return;
              const template = generateTemplate(method.requestType, tab.grpcMessageDefs);
              const raw = JSON.stringify(template, null, 2);
              setTemplateContent(raw);
              setCopied(false);
            }}
            disabled={!opts.serviceName || !opts.methodName || !tab.grpcMessageDefs}
            title={!tab.grpcMessageDefs ? 'Run service discovery first' : undefined}
            style={{
              fontSize: 11, padding: '2px 8px',
              background: 'none',
              border: '1px solid var(--border-color, #555)',
              borderRadius: 3, cursor: 'pointer',
              color: 'var(--panel-fg)',
              opacity: (!opts.serviceName || !opts.methodName || !tab.grpcMessageDefs) ? 0.4 : 1,
            }}
          >
            ⚡ Template
          </button>
        </div>
        <textarea
          value={tab.body?.raw ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            updateTab(tab.id, { body: { ...tab.body, type: 'raw', raw }, isDirty: true });
            try {
              if (raw.trim()) JSON.parse(raw);
              setJsonError(null);
            } catch (err) {
              setJsonError(String(err));
            }
          }}
          placeholder={'{\n  \n}'}
          rows={8}
          spellCheck={false}
          style={{
            ...INPUT_STYLE,
            resize: 'vertical',
            fontFamily: 'monospace',
            fontSize: 12,
            ...(jsonError ? { borderColor: 'var(--vscode-inputValidation-errorBorder, #f48771)' } : {}),
          }}
        />
        {jsonError && (
          <div style={{ fontSize: 11, color: 'var(--vscode-inputValidation-errorForeground, #f48771)', marginTop: 4 }}>
            {jsonError}
          </div>
        )}
      </div>

      {/* ── TLS / Security ────────────────────────────── */}      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE}>{t('grpcTlsSection')}</div>
        <div style={{ marginBottom: 8 }}>
          <label style={LABEL_STYLE}>{t('grpcTlsModeLabel')}</label>
          <select
            value={opts.tls ?? 'none'}
            onChange={(e) => setOpt('tls', e.target.value as 'none' | 'tls' | 'mtls')}
            style={INPUT_STYLE}
          >
            <option value="none">{t('grpcTlsPlaintext')}</option>
            <option value="tls">{t('grpcTlsTls')}</option>
            <option value="mtls">{t('grpcTlsMtls')}</option>
          </select>
        </div>
        {(opts.tls === 'tls' || opts.tls === 'mtls') && (
          <div style={{ marginBottom: 8 }}>
            <label style={LABEL_STYLE}>{t('grpcCaCertLabel')}</label>
            <textarea
              value={opts.caCert ?? ''}
              onChange={(e) => setOpt('caCert', e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----\n..."
              rows={3}
              style={{ ...INPUT_STYLE, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
            />
          </div>
        )}
        {opts.tls === 'mtls' && (
          <>
            <div style={{ marginBottom: 8 }}>
              <label style={LABEL_STYLE}>{t('grpcClientCertLabel')}</label>
              <textarea
                value={opts.clientCert ?? ''}
                onChange={(e) => setOpt('clientCert', e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----\n..."
                rows={3}
                style={{ ...INPUT_STYLE, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={LABEL_STYLE}>{t('grpcClientKeyLabel')}</label>
              <textarea
                value={opts.clientKey ?? ''}
                onChange={(e) => setOpt('clientKey', e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----\n..."
                rows={3}
                style={{ ...INPUT_STYLE, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Metadata (gRPC headers) ────────────────────── */}
      <div style={SECTION_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={SECTION_TITLE}>{t('grpcMetadataSection')}</div>
          <button
            onClick={addMetadataRow}
            style={{ fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--border-color, #555)', borderRadius: 3, cursor: 'pointer', color: 'var(--panel-fg)' }}
          >
            + Add
          </button>
        </div>
        {metadataRows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: 6, marginBottom: 5, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => updateMetadata(i, 'enabled', e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            <input
              value={row.key}
              onChange={(e) => updateMetadata(i, 'key', e.target.value)}
              placeholder={t('grpcMetaKeyPlaceholder')}
              style={INPUT_STYLE}
            />
            <input
              value={row.value}
              onChange={(e) => updateMetadata(i, 'value', e.target.value)}
              placeholder={t('grpcMetaValuePlaceholder')}
              style={INPUT_STYLE}
            />
            <button
              onClick={() => deleteMetadataRow(i)}
              title="Delete row"
              style={{ fontSize: 13, lineHeight: 1, padding: '2px 5px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--panel-fg)', opacity: 0.5 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* ── Streaming Send Panel ──────────────────────── */}
      {showSendPanel && (
        <div style={{ ...SECTION_STYLE, borderTop: '1px solid var(--border-color, #444)', paddingTop: 14 }}>
          <div style={SECTION_TITLE}>{t('grpcSendStreamLabel')}</div>
          <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 5 }}>
            {t('grpcCtrlEnterHint')}
          </div>
          <textarea
            value={sendPayload}
            onChange={(e) => setSendPayload(e.target.value)}
            onKeyDown={handleStreamKeyDown}
            rows={5}
            spellCheck={false}
            style={{
              ...INPUT_STYLE,
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              onClick={handleStreamSend}
              disabled={!sendPayload.trim()}
              style={{
                padding: '5px 14px',
                fontSize: 12,
                cursor: sendPayload.trim() ? 'pointer' : 'not-allowed',
                background: 'var(--button-bg)',
                color: 'var(--button-fg)',
                border: 'none',
                borderRadius: 4,
              }}
            >
              {t('grpcSendBtn')}
            </button>
            <button
              onClick={handleEndStream}
              style={{
                padding: '5px 14px',
                fontSize: 12,
                cursor: 'pointer',
                background: 'var(--input-bg, #3c3c3c)',
                color: 'var(--vscode-errorForeground, #f48771)',
                border: '1px solid var(--border-color, #555)',
                borderRadius: 4,
              }}
            >
              {t('grpcEndStreamBtn')}
            </button>
          </div>
        </div>
      )}

      {/* ── Template Modal ────────────────────────────── */}
      {templateContent !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setTemplateContent(null)}
        >
          <div
            style={{
              background: 'var(--vscode-editor-background, #1e1e1e)',
              border: '1px solid var(--border-color, #555)',
              borderRadius: 6,
              padding: '16px 18px',
              minWidth: 340,
              maxWidth: '80vw',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{t('grpcTemplateTitle')}</span>
              <button
                onClick={() => setTemplateContent(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--panel-fg)', fontSize: 16, lineHeight: 1, opacity: 0.7 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>{t('grpcTemplateHint')}</div>
            <pre
              style={{
                flex: 1,
                overflowY: 'auto',
                background: 'var(--input-bg, #2d2d2d)',
                border: '1px solid var(--border-color, #444)',
                borderRadius: 4,
                padding: '8px 10px',
                fontSize: 12,
                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                color: 'var(--panel-fg)',
              }}
            >
              {templateContent}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={handleCopyTemplate}
                style={{
                  padding: '5px 14px',
                  fontSize: 12,
                  cursor: 'pointer',
                  background: 'var(--button-bg)',
                  color: 'var(--button-fg)',
                  border: 'none',
                  borderRadius: 4,
                }}
              >
                {copied ? t('codeSnippetCopied') : t('codeSnippetCopy')}
              </button>
              <button
                onClick={() => setTemplateContent(null)}
                style={{
                  padding: '5px 14px',
                  fontSize: 12,
                  cursor: 'pointer',
                  background: 'var(--input-bg, #3c3c3c)',
                  color: 'var(--panel-fg)',
                  border: '1px solid var(--border-color, #555)',
                  borderRadius: 4,
                }}
              >
                {t('closeBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
