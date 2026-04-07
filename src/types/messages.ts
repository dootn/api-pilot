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
