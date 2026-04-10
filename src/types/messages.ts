export interface WebviewMessage {
  type: string;
  requestId?: string;
  payload?: unknown;
}

// Webview -> Extension messages
export interface SendRequestMessage {
  type: 'sendRequest';
  requestId: string;
  payload: import('./index').ApiRequest;
}

export interface CancelRequestMessage {
  type: 'cancelRequest';
  requestId: string;
}

export interface ReadyMessage {
  type: 'ready';
}

export interface CreateEnvironmentMessage {
  type: 'createEnvironment';
  payload: { name: string };
}

export interface UpdateEnvironmentMessage {
  type: 'updateEnvironment';
  payload: { env: import('./index').Environment };
}

export interface DeleteEnvironmentMessage {
  type: 'deleteEnvironment';
  payload: { id: string };
}

export interface CopyAsCurlMessage {
  type: 'copyAsCurl';
  requestId: string;
  payload: import('./index').ApiRequest;
}

// Extension -> Webview messages
export interface RequestResultMessage {
  type: 'requestResult';
  requestId: string;
  payload: import('./index').ApiResponse;
}

export interface RequestErrorMessage {
  type: 'requestError';
  requestId: string;
  payload: { message: string };
}

export interface RequestProgressMessage {
  type: 'requestProgress';
  requestId: string;
  payload: { status: string };
}

// WebSocket messages (Webview -> Extension)
export interface WsConnectMessage {
  type: 'wsConnect';
  tabId: string;
  payload: import('./index').ApiRequest;
}

export interface WsDisconnectMessage {
  type: 'wsDisconnect';
  payload: { connectionId: string };
}

export interface WsSendMessage {
  type: 'wsSend';
  payload: {
    connectionId: string;
    msgType: 'text' | 'binary';
    data: string;
  };
}

// WebSocket messages (Extension -> Webview)
export interface WsStatusChangedMessage {
  type: 'wsStatusChanged';
  tabId: string;
  payload: {
    status: import('./index').WsStatus;
    connectionId?: string;
    error?: string;
  };
}

export interface WsMessageReceivedMessage {
  type: 'wsMessageReceived';
  tabId: string;
  payload: import('./index').WsMessage;
}

// SSE messages (Webview -> Extension)
export interface SseConnectMessage {
  type: 'sseConnect';
  tabId: string;
  payload: import('./index').ApiRequest;
}

export interface SseDisconnectMessage {
  type: 'sseDisconnect';
  payload: { connectionId: string };
}

// SSE messages (Extension -> Webview)
export interface SseStatusChangedMessage {
  type: 'sseStatusChanged';
  tabId: string;
  payload: {
    status: import('./index').SseStatus;
    connectionId?: string;
    error?: string;
  };
}

export interface SseEventReceivedMessage {
  type: 'sseEventReceived';
  tabId: string;
  payload: import('./index').SseEvent;
}

// MQTT messages (Webview -> Extension)
export interface MqttConnectMessage {
  type: 'mqttConnect';
  tabId: string;
  payload: import('./index').ApiRequest;
}

export interface MqttDisconnectMessage {
  type: 'mqttDisconnect';
  payload: { connectionId: string };
}

export interface MqttSubscribeMessage {
  type: 'mqttSubscribe';
  payload: { connectionId: string; topic: string; qos: 0 | 1 | 2 };
}

export interface MqttUnsubscribeMessage {
  type: 'mqttUnsubscribe';
  payload: { connectionId: string; topic: string };
}

export interface MqttPublishMessage {
  type: 'mqttPublish';
  payload: { connectionId: string; topic: string; payload: string; qos: 0 | 1 | 2; retain: boolean };
}

// MQTT messages (Extension -> Webview)
export interface MqttStatusChangedMessage {
  type: 'mqttStatusChanged';
  tabId: string;
  payload: {
    status: import('./index').MqttStatus;
    connectionId?: string;
    error?: string;
  };
}

export interface MqttMessageReceivedMessage {
  type: 'mqttMessageReceived';
  tabId: string;
  payload: import('./index').MqttMessage;
}

// gRPC messages (Webview -> Extension)
export interface GrpcCallMessage {
  type: 'grpcCall';
  tabId: string;
  payload: import('./index').ApiRequest;
}

export interface GrpcSendMessage {
  type: 'grpcSend';
  payload: { callId: string; data: string };
}

export interface GrpcCancelMessage {
  type: 'grpcCancel';
  payload: { callId: string };
}

export interface GrpcReflectMessage {
  type: 'grpcReflect';
  tabId: string;
  payload: import('./index').ApiRequest;
}

// gRPC messages (Extension -> Webview)
export interface GrpcStatusChangedMessage {
  type: 'grpcStatusChanged';
  tabId: string;
  payload: {
    status: import('./index').GrpcStatus;
    callId?: string;
    statusCode?: string;
    statusMessage?: string;
    error?: string;
  };
}

export interface GrpcMessageReceivedMessage {
  type: 'grpcMessageReceived';
  tabId: string;
  payload: import('./index').GrpcMessage;
}

export interface GrpcServicesDiscoveredMessage {
  type: 'grpcServicesDiscovered';
  tabId: string;
  payload: {
    services: import('./index').GrpcServiceDef[];
    source: 'reflection' | 'proto';
  };
}

export interface GrpcReflectErrorMessage {
  type: 'grpcReflectError';
  tabId: string;
  payload: { error: string };
}
