import type { RequestTab } from '../../stores/tabStore';
import { vscode } from '../../vscode';

/** Build the common API request payload from a tab. */
function buildPayload(tab: RequestTab, overrides?: Record<string, unknown>) {
  return {
    id: tab.id,
    name: tab.name,
    protocol: tab.protocol,
    method: tab.method,
    url: tab.url.trim(),
    params: tab.params.filter((p) => p.key),
    headers: tab.headers.filter((h) => h.key),
    body: tab.body,
    auth: tab.auth,
    preScript: tab.preScript,
    postScript: tab.postScript,
    sslVerify: tab.sslVerify ?? true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function useProtocolHandlers(
  tab: RequestTab | undefined,
  updateTab: (id: string, updates: Partial<RequestTab>) => void,
  flags: { isWs: boolean; isSse: boolean; isMqtt: boolean; isGrpc: boolean }
) {
  const handleWsToggle = () => {
    if (!tab || !tab.url.trim()) return;

    if (tab.wsStatus === 'connected' || tab.wsStatus === 'connecting') {
      if (tab.wsConnectionId) {
        vscode.postMessage({ type: 'wsDisconnect', payload: { connectionId: tab.wsConnectionId } });
      }
      updateTab(tab.id, { wsStatus: 'disconnected', wsConnectionId: undefined, loading: false });
      return;
    }

    updateTab(tab.id, { loading: true, wsMessages: [], responseError: null });
    vscode.postMessage({ type: 'wsConnect', tabId: tab.id, payload: buildPayload(tab) });
  };

  const handleGrpcCall = () => {
    if (!tab || !tab.url.trim()) return;

    if (tab.grpcStatus === 'streaming' || tab.grpcStatus === 'connecting') {
      if (tab.grpcCallId) {
        vscode.postMessage({ type: 'grpcCancel', payload: { callId: tab.grpcCallId } });
      }
      updateTab(tab.id, { grpcStatus: 'idle', grpcCallId: undefined, loading: false });
      return;
    }

    updateTab(tab.id, { loading: true, grpcMessages: [], responseError: null });
    vscode.postMessage({ type: 'grpcCall', tabId: tab.id, payload: buildPayload(tab, { grpcOptions: tab.grpcOptions }) });
  };

  const handleMqttToggle = () => {
    if (!tab || !tab.url.trim()) return;

    if (tab.mqttStatus === 'connected' || tab.mqttStatus === 'connecting') {
      if (tab.mqttConnectionId) {
        vscode.postMessage({ type: 'mqttDisconnect', payload: { connectionId: tab.mqttConnectionId } });
      }
      updateTab(tab.id, { mqttStatus: 'disconnected', mqttConnectionId: undefined, loading: false });
      return;
    }

    updateTab(tab.id, { loading: true, mqttMessages: [], mqttSubscriptions: [], responseError: null });
    vscode.postMessage({
      type: 'mqttConnect', tabId: tab.id,
      payload: buildPayload(tab, { body: { type: 'none' }, preScript: undefined, postScript: undefined, mqttOptions: tab.mqttOptions }),
    });
  };

  const handleSseToggle = () => {
    if (!tab || !tab.url.trim()) return;

    if (tab.sseStatus === 'connected' || tab.sseStatus === 'connecting') {
      if (tab.sseConnectionId) {
        vscode.postMessage({ type: 'sseDisconnect', payload: { connectionId: tab.sseConnectionId } });
      }
      updateTab(tab.id, { sseStatus: 'disconnected', sseConnectionId: undefined, loading: false });
      return;
    }

    updateTab(tab.id, { loading: true, sseEvents: [], responseError: null });
    vscode.postMessage({
      type: 'sseConnect', tabId: tab.id,
      payload: buildPayload(tab, { method: 'GET', body: { type: 'none' }, preScript: undefined, postScript: undefined }),
    });
  };

  const handleSend = () => {
    if (!tab || !tab.url.trim()) return;

    if (flags.isWs) { handleWsToggle(); return; }
    if (flags.isGrpc) { handleGrpcCall(); return; }
    if (flags.isMqtt) { handleMqttToggle(); return; }
    if (flags.isSse) { handleSseToggle(); return; }

    if (tab.loading) {
      vscode.postMessage({ type: 'cancelRequest', requestId: tab.id });
      updateTab(tab.id, { loading: false });
      return;
    }

    updateTab(tab.id, { loading: true, response: null, responseError: null });

    vscode.postMessage({
      type: 'sendRequest',
      requestId: tab.id,
      payload: buildPayload(tab),
    });
  };

  return { handleSend };
}
