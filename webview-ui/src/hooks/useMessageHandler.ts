import { useCallback } from 'react';
import { useTabStore, type RequestTab } from '../stores/tabStore';
import type { ApiResponse, WsMessage, WsStatus, SseEvent, SseStatus, MqttStatus, MqttMessage, GrpcStatus, GrpcMessage, GrpcServiceDef, GrpcMessageDef } from '../stores/requestStore';
import { useLocaleStore } from '../stores/localeStore';
import { useSettingsStore } from '../stores/settingsStore';

export function useMessageHandler() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const updateTab = useTabStore((s) => s.updateTab);
  const addTabWithData = useTabStore((s) => s.addTabWithData);
  const setActiveTabId = useTabStore((s) => s.setActiveTabId);
  const restoreSession = useTabStore((s) => s.restoreSession);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const setCustomHttpMethods = useSettingsStore((s) => s.setCustomHttpMethods);

  return useCallback(
    (message: { type: string; requestId?: string; payload?: unknown }) => {
      switch (message.type) {
        case 'loadRequest': {
          const raw = message.payload as Partial<RequestTab> & { _newTab?: boolean };
          const { _newTab, ...request } = raw;

          // If the imported request already exists as an open tab, switch to it
          if (request.id && request.collectionId) {
            const existingTab = tabs.find(
              (t) => t.id === request.id && t.collectionId === request.collectionId
            );
            if (existingTab) {
              setActiveTabId(existingTab.id);
              return;
            }
          }

          if (_newTab) {
            // Open in a new tab — strip id so a fresh UUID is generated
            const { id: _id, ...requestWithoutId } = request;
            addTabWithData({ ...requestWithoutId, collectionId: undefined });
          } else if (activeTabId) {
            // Fill current active tab with the imported data (no new tab)
            updateTab(activeTabId, {
              ...request,
              id: activeTabId,          // keep current tab id
              collectionId: undefined,  // break collection binding for imported requests
              isDirty: true,
            });
          } else {
            addTabWithData(request || {});
          }
          return;
        }
        case 'setLocale': {
          setLocale(message.payload as 'en' | 'zh-CN');
          return;
        }
        case 'setCustomMethods': {
          setCustomHttpMethods(message.payload as string[]);
          return;
        }
        case 'requestRenamed': {
          // Sidebar renamed a bookmark — update the matching open tab's name without dirtying it
          const { requestId, newName } = message.payload as { collectionId: string; requestId: string; newName: string };
          const target = tabs.find((t) => t.id === requestId);
          if (target) {
            updateTab(requestId, { name: newName, isCustomNamed: true, isDirty: false });
          }
          return;
        }
        case 'loadTabState': {
          const session = message.payload as {
            tabs: Omit<RequestTab, 'response' | 'responseError' | 'loading' | 'isDirty'>[];
            activeTabId: string;
          };
          if (session?.tabs?.length) {
            const tabs: RequestTab[] = session.tabs.map((t) => ({
              ...t,
              response: null,
              responseError: null,
              loading: false,
              isDirty: false,
            }));
            const activeId = tabs.find((t) => t.id === session.activeTabId)
              ? session.activeTabId
              : tabs[0].id;
            restoreSession(tabs, activeId);
          }
          return;
        }
        case 'wsStatusChanged': {
          const wsMsg = message as unknown as { tabId: string; payload: { status: WsStatus; connectionId?: string; error?: string } };
          const { status, connectionId, error } = wsMsg.payload;
          updateTab(wsMsg.tabId, {
            wsStatus: status,
            wsConnectionId: connectionId,
            loading: status === 'connecting',
            ...(status === 'disconnected' || status === 'error' ? { wsConnectedAt: undefined } : {}),
            ...(status === 'connected' ? { wsConnectedAt: Date.now() } : {}),
            ...(status === 'error' ? { responseError: error ?? 'WebSocket error' } : {}),
          });
          return;
        }
        case 'wsMessageReceived': {
          const wsMsg = message as unknown as { tabId: string; payload: WsMessage };
          const tab = tabs.find((t) => t.id === wsMsg.tabId);
          if (tab) {
            const existing = tab.wsMessages ?? [];
            updateTab(wsMsg.tabId, { wsMessages: [...existing, wsMsg.payload] });
          }
          return;
        }
        case 'sseStatusChanged': {
          const sseMsg = message as unknown as { tabId: string; payload: { status: SseStatus; connectionId?: string; error?: string } };
          const { status, connectionId, error } = sseMsg.payload;
          updateTab(sseMsg.tabId, {
            sseStatus: status,
            sseConnectionId: connectionId,
            loading: status === 'connecting',
            ...(status === 'disconnected' || status === 'error' ? { sseConnectedAt: undefined } : {}),
            ...(status === 'connected' ? { sseConnectedAt: Date.now() } : {}),
            ...(status === 'error' ? { responseError: error ?? 'SSE error' } : {}),
          });
          return;
        }
        case 'sseEventReceived': {
          const sseMsg = message as unknown as { tabId: string; payload: SseEvent };
          const tab = tabs.find((t) => t.id === sseMsg.tabId);
          if (tab) {
            const existing = tab.sseEvents ?? [];
            updateTab(sseMsg.tabId, { sseEvents: [...existing, sseMsg.payload] });
          }
          return;
        }
        case 'mqttStatusChanged': {
          const mqttMsg = message as unknown as { tabId: string; payload: { status: MqttStatus; connectionId?: string; error?: string } };
          const { status, connectionId, error } = mqttMsg.payload;
          updateTab(mqttMsg.tabId, {
            mqttStatus: status,
            mqttConnectionId: connectionId,
            loading: status === 'connecting',
            ...(status === 'disconnected' || status === 'error' ? { mqttConnectedAt: undefined } : {}),
            ...(status === 'connected' ? { mqttConnectedAt: Date.now() } : {}),
            ...(status === 'error' ? { responseError: error ?? 'MQTT error' } : {}),
          });
          return;
        }
        case 'mqttMessageReceived': {
          const mqttMsg = message as unknown as { tabId: string; payload: MqttMessage };
          const tab = tabs.find((t) => t.id === mqttMsg.tabId);
          if (tab) {
            const existing = tab.mqttMessages ?? [];
            updateTab(mqttMsg.tabId, { mqttMessages: [...existing, mqttMsg.payload] });
          }
          return;
        }
        case 'mqttSubscribed': {
          const mqttMsg = message as unknown as { tabId: string; payload: { topic: string } };
          const tab = tabs.find((t) => t.id === mqttMsg.tabId);
          if (tab) {
            const existing = tab.mqttSubscriptions ?? [];
            if (!existing.includes(mqttMsg.payload.topic)) {
              updateTab(mqttMsg.tabId, { mqttSubscriptions: [...existing, mqttMsg.payload.topic] });
            }
          }
          return;
        }
        case 'mqttUnsubscribed': {
          const mqttMsg = message as unknown as { tabId: string; payload: { topic: string } };
          const tab = tabs.find((t) => t.id === mqttMsg.tabId);
          if (tab) {
            const existing = tab.mqttSubscriptions ?? [];
            updateTab(mqttMsg.tabId, { mqttSubscriptions: existing.filter((s) => s !== mqttMsg.payload.topic) });
          }
          return;
        }
        case 'grpcStatusChanged': {
          const grpcMsg = message as unknown as { tabId: string; payload: { status: GrpcStatus; callId?: string; statusCode?: string; statusMessage?: string; error?: string } };
          const { status, callId, error } = grpcMsg.payload;
          updateTab(grpcMsg.tabId, {
            grpcStatus: status,
            grpcCallId: callId,
            loading: status === 'connecting' || status === 'streaming',
            ...(status === 'idle' || status === 'done' || status === 'error' ? { grpcCallStartedAt: undefined } : {}),
            ...(status === 'connecting' ? { grpcCallStartedAt: Date.now() } : {}),
            ...(status === 'error' ? { responseError: error ?? 'gRPC error' } : {}),
          });
          return;
        }
        case 'grpcMessageReceived': {
          const grpcMsg = message as unknown as { tabId: string; payload: GrpcMessage };
          const tab = tabs.find((t) => t.id === grpcMsg.tabId);
          if (tab) {
            const existing = tab.grpcMessages ?? [];
            updateTab(grpcMsg.tabId, { grpcMessages: [...existing, grpcMsg.payload] });
          }
          return;
        }
        case 'grpcServicesDiscovered': {
          const grpcMsg = message as unknown as { tabId: string; payload: { services: GrpcServiceDef[]; messageDefs?: Record<string, GrpcMessageDef>; source: 'reflection' | 'proto' } };
          updateTab(grpcMsg.tabId, {
            grpcServices: grpcMsg.payload.services,
            ...(grpcMsg.payload.messageDefs ? { grpcMessageDefs: grpcMsg.payload.messageDefs } : {}),
          });
          return;
        }
        case 'grpcReflectError': {
          const grpcMsg = message as unknown as { tabId: string; payload: { error: string } };
          updateTab(grpcMsg.tabId, { responseError: grpcMsg.payload.error });
          return;
        }
      }

      const tabId = message.requestId;
      if (!tabId) return;

      switch (message.type) {
        case 'requestResult': {
          const res = message.payload as ApiResponse;
          updateTab(tabId, {
            response: res,
            sslInfo: res.sslInfo,
            responseError: null,
            loading: false,
          });
          break;
        }
        case 'requestError': {
          const errPayload = message.payload as { message: string; sslInfo?: import('../stores/requestStore').SSLInfo };
          updateTab(tabId, {
            responseError: errPayload?.message || 'Unknown error',
            sslInfo: errPayload?.sslInfo,
            response: null,
            loading: false,
          });
          break;
        }
        case 'requestProgress':
          break;
      }
    },
    [updateTab, addTabWithData, restoreSession, tabs, activeTabId, setActiveTabId, setLocale, setCustomHttpMethods]
  );
}
