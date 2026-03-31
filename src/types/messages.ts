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
