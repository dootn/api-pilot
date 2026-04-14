import { useRef, useState } from 'react';
import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { GrpcOptions, GrpcServiceDef } from '../../stores/requestStore';
import { vscode } from '../../vscode';
import { useI18n } from '../../i18n';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { SECTION_STYLE, callTypeLabel, generateTemplate } from './grpcUtils';
import { GrpcTemplateModal } from './GrpcTemplateModal';
import { Select, Input, Textarea, Button, Checkbox, FileInput, Option } from '../shared/ui';

export function GrpcOptions() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
  const t = useI18n();
  const protoFileInputRef = useRef<HTMLInputElement>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [sendPayload, setSendPayload] = useState('{\n  \n}');
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const { copied, copy, reset: resetCopied } = useCopyToClipboard();

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
    copy(templateContent);
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
        <div className="section-header">{t('grpcServiceDiscovery')}</div>
        <div className="flex-row gap-8" style={{ marginBottom: 8 }}>
          <Button
            variant={opts.protoSource === 'reflection' ? 'primary' : 'secondary'}
            onClick={handleReflect}
            disabled={!tab.url.trim()}
            fullWidth
          >
            {t('grpcReflectBtn')}
          </Button>
          <Button
            variant={opts.protoSource === 'proto' ? 'primary' : 'secondary'}
            onClick={handleProtoFileClick}
            fullWidth
          >
            {t('grpcUploadProtoBtn')}
          </Button>
          <FileInput
            ref={protoFileInputRef}
            accept=".proto"
            style={{ display: 'none' }}
            onChange={handleProtoFileChange}
          />
        </div>
        {opts.protoFileName && (
          <div className="text-secondary" style={{ fontSize: 11, marginBottom: 4 }}>
            {t('grpcProtoFileLabel')} {opts.protoFileName}
          </div>
        )}
        {services.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label className="grpc-label">{t('grpcServiceLabel')}</label>
              <Select
                fullWidth
                value={opts.serviceName ?? ''}
                onChange={(e) => {
                  const svc = e.target.value;
                  const firstMethod = services.find((s) => s.name === svc)?.methods[0]?.name ?? '';
                  updateTab(tab!.id, {
                    grpcOptions: { ...opts, serviceName: svc, methodName: firstMethod },
                    isDirty: true,
                  });
                }}
              >
                <Option value="">{t('grpcSelectService')}</Option>
                {services.map((s) => (
                  <Option key={s.name} value={s.name}>{s.name}</Option>
                ))}
              </Select>
            </div>
            <div>
              <label className="grpc-label">{t('grpcMethodLabel')}</label>
              <Select
                fullWidth
                value={opts.methodName ?? ''}
                onChange={(e) => setOpt('methodName', e.target.value)}
                disabled={!opts.serviceName}
              >
                <Option value="">{t('grpcSelectMethod')}</Option>
                {methods.map((m) => (
                  <Option key={m.name} value={m.name}>
                    {m.name} ({callTypeLabel(m, t)})
                  </Option>
                ))}
              </Select>
            </div>
          </div>
        ) : (
          <div className="text-secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
            {t('grpcNoServicesHint')}
          </div>
        )}
      </div>

      {/* ── Request Body ──────────────────────────────── */}
      <div style={SECTION_STYLE}>
        <div className="flex-row justify-between" style={{ marginBottom: 8 }}>
          <div className="section-header">{t('grpcReqBodyLabel')}</div>
          <Button
            variant="ghost"
            btnSize="sm"
            onClick={() => {
              const svc = services.find((s) => s.name === opts.serviceName);
              const method = svc?.methods.find((m) => m.name === opts.methodName);
              if (!method || !tab.grpcMessageDefs) return;
              const template = generateTemplate(method.requestType, tab.grpcMessageDefs);
              const raw = JSON.stringify(template, null, 2);
              setTemplateContent(raw);
              resetCopied();
            }}
            disabled={!opts.serviceName || !opts.methodName || !tab.grpcMessageDefs}
            title={!tab.grpcMessageDefs ? 'Run service discovery first' : undefined}
          >
            ⚡ Template
          </Button>
        </div>
        <Textarea
          code
          fullWidth
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
          style={jsonError ? { borderColor: 'var(--vscode-inputValidation-errorBorder, #f48771)' } : undefined}
        />
        {jsonError && (
          <div style={{ fontSize: 11, color: 'var(--vscode-inputValidation-errorForeground, #f48771)', marginTop: 4 }}>
            {jsonError}
          </div>
        )}
      </div>

      {/* ── TLS / Security ────────────────────────────── */}      <div style={SECTION_STYLE}>
        <div className="section-header">{t('grpcTlsSection')}</div>
        <div style={{ marginBottom: 8 }}>
          <label className="grpc-label">{t('grpcTlsModeLabel')}</label>
          <Select
            fullWidth
            value={opts.tls ?? 'none'}
            onChange={(e) => setOpt('tls', e.target.value as 'none' | 'tls' | 'mtls')}
          >
            <Option value="none">{t('grpcTlsPlaintext')}</Option>
            <Option value="tls">{t('grpcTlsTls')}</Option>
            <Option value="mtls">{t('grpcTlsMtls')}</Option>
          </Select>
        </div>
        {(opts.tls === 'tls' || opts.tls === 'mtls') && (
          <div style={{ marginBottom: 8 }}>
            <label className="grpc-label">{t('grpcCaCertLabel')}</label>
            <Textarea
              code
              fullWidth
              value={opts.caCert ?? ''}
              onChange={(e) => setOpt('caCert', e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----\n..."
              rows={3}
            />
          </div>
        )}
        {opts.tls === 'mtls' && (
          <>
            <div style={{ marginBottom: 8 }}>
              <label className="grpc-label">{t('grpcClientCertLabel')}</label>
              <Textarea
                code
                fullWidth
                value={opts.clientCert ?? ''}
                onChange={(e) => setOpt('clientCert', e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----\n..."
                rows={3}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label className="grpc-label">{t('grpcClientKeyLabel')}</label>
              <Textarea
                code
                fullWidth
                value={opts.clientKey ?? ''}
                onChange={(e) => setOpt('clientKey', e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----\n..."
                rows={3}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Metadata (gRPC headers) ────────────────────── */}
      <div style={SECTION_STYLE}>
        <div className="flex-row justify-between" style={{ marginBottom: 8 }}>
          <div className="section-header">{t('grpcMetadataSection')}</div>
          <Button variant="ghost" btnSize="sm" onClick={addMetadataRow}>
            + Add
          </Button>
        </div>
        {metadataRows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: 6, marginBottom: 5, alignItems: 'center' }}>
            <Checkbox
              checked={row.enabled}
              onChange={(e) => updateMetadata(i, 'enabled', e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            <Input
              fullWidth
              value={row.key}
              onChange={(e) => updateMetadata(i, 'key', e.target.value)}
              placeholder={t('grpcMetaKeyPlaceholder')}
            />
            <Input
              fullWidth
              value={row.value}
              onChange={(e) => updateMetadata(i, 'value', e.target.value)}
              placeholder={t('grpcMetaValuePlaceholder')}
            />
            <Button variant="ghost" btnSize="sm" onClick={() => deleteMetadataRow(i)} title="Delete row" style={{ opacity: 0.5 }}>
              ×
            </Button>
          </div>
        ))}
      </div>

      {/* ── Streaming Send Panel ──────────────────────── */}
      {showSendPanel && (
        <div style={{ ...SECTION_STYLE, borderTop: '1px solid var(--border-color, #444)', paddingTop: 14 }}>
          <div className="section-header">{t('grpcSendStreamLabel')}</div>
          <div className="text-secondary" style={{ fontSize: 11, marginBottom: 5 }}>
            {t('grpcCtrlEnterHint')}
          </div>
          <Textarea
            code
            fullWidth
            value={sendPayload}
            onChange={(e) => setSendPayload(e.target.value)}
            onKeyDown={handleStreamKeyDown}
            rows={5}
          />
          <div className="flex-row gap-8" style={{ marginTop: 6 }}>
            <Button
              variant="primary"
              onClick={handleStreamSend}
              disabled={!sendPayload.trim()}
            >
              {t('grpcSendBtn')}
            </Button>
            <Button
              variant="danger"
              onClick={handleEndStream}
            >
              {t('grpcEndStreamBtn')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Template Modal ────────────────────────────── */}
      {templateContent !== null && (
        <GrpcTemplateModal
          content={templateContent}
          copied={copied}
          onCopy={handleCopyTemplate}
          onClose={() => setTemplateContent(null)}
        />
      )}
    </div>
  );
}
