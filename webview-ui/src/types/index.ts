// Shared types for the webview frontend.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type Protocol = 'http' | 'websocket' | 'sse' | 'mqtt' | 'grpc';

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type SseStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type MqttStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SseEvent {
  id: string;
  eventId?: string;
  event: string;
  data: string;
  timestamp: number;
  size: number;
}

export interface WsMessage {
  id: string;
  direction: 'sent' | 'received';
  timestamp: number;
  type: 'text' | 'binary';
  data: string;
  event?: string;
  size: number;
}

export interface MqttMessage {
  id: string;
  direction: 'sent' | 'received';
  topic: string;
  payload: string;
  qos: 0 | 1 | 2;
  retained: boolean;
  timestamp: number;
  size: number;
}

export interface MqttOptions {
  clientId?: string;
  cleanSession?: boolean;
  keepAlive?: number;
  username?: string;
  password?: string;
  lastWillTopic?: string;
  lastWillPayload?: string;
  lastWillQos?: 0 | 1 | 2;
  lastWillRetain?: boolean;
}

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface FormDataField {
  key: string;
  value: string;
  enabled: boolean;
  type: 'text' | 'file';
  filePath?: string;
  fileName?: string;
  fileData?: string;
  description?: string;
}

export interface RequestBody {
  type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';
  raw?: string;
  rawContentType?: string;
  formData?: FormDataField[];
  urlEncoded?: KeyValuePair[];
  binaryPath?: string;
  binaryName?: string;
  binaryData?: string;
  graphql?: { query: string; variables: string };
}

export interface AuthConfig {
  type: 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2';
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  value?: string;
  in?: 'header' | 'query';
  grantType?: string;
  accessTokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error';
  args: string;
  source: 'pre' | 'post';
}

export interface SSLCertificate {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  fingerprint: string;
  signatureAlgorithm: string;
  subjectAltNames?: string[];
}

export interface SSLInfo {
  authorized: boolean;
  authorizationError?: string;
  protocol: string;
  cipher: {
    name: string;
    version: string;
  };
  certificate?: SSLCertificate;
  certificateChain?: SSLCertificate[];
  peerCertificate?: Record<string, any>;
}

export interface TimingBreakdown {
  connect: number;
  ttfb: number;
  download: number;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodySize: number;
  time: number;
  contentType?: string;
  bodyBase64?: string;
  testResults?: TestResult[];
  consoleEntries?: ConsoleEntry[];
  sslInfo?: SSLInfo;
  timingBreakdown?: TimingBreakdown;
}

export type GrpcStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error';

export type GrpcCallType = 'unary' | 'server_streaming' | 'client_streaming' | 'bidi_streaming';

export interface GrpcMessage {
  id: string;
  direction: 'sent' | 'received';
  data: string;
  timestamp: number;
  isEnd?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

export interface GrpcFieldDef {
  name: string;
  typeName: string;
  repeated: boolean;
}

export interface GrpcMessageDef {
  fullName: string;
  fields: GrpcFieldDef[];
}

export interface GrpcMethodDef {
  name: string;
  callType: GrpcCallType;
  requestStream: boolean;
  responseStream: boolean;
  requestType: string;
  responseType: string;
}

export interface GrpcServiceDef {
  name: string;
  methods: GrpcMethodDef[];
}

export interface GrpcOptions {
  tls?: 'none' | 'tls' | 'mtls';
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
  metadata?: { key: string; value: string; enabled: boolean }[];
  protoSource?: 'reflection' | 'proto';
  protoContent?: string;
  protoFileName?: string;
  serviceName?: string;
  methodName?: string;
}

export interface WsSessionSummary {
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  duration: number;
}

export interface SseSessionSummary {
  eventCount: number;
  duration: number;
}

export interface MqttSessionSummary {
  publishedCount: number;
  receivedCount: number;
  subscribedTopics: string[];
  duration: number;
}

export interface GrpcSessionSummary {
  callType: GrpcCallType;
  serviceName: string;
  methodName: string;
  sentCount: number;
  receivedCount: number;
  statusCode?: string;
  statusMessage?: string;
  duration: number;
}

export interface HistoryEntry {
  id: string;
  request: {
    id: string;
    name: string;
    protocol?: Protocol;
    method: HttpMethod;
    url: string;
  };
  response?: ApiResponse;
  wsSession?: WsSessionSummary;
  sseSession?: SseSessionSummary;
  mqttSession?: MqttSessionSummary;
  grpcSession?: GrpcSessionSummary;
  timestamp: number;
}
