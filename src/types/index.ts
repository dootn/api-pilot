export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type Protocol = 'http' | 'websocket' | 'sse' | 'mqtt';

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type SseStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SseEvent {
  id: string;          // internal uuid
  eventId?: string;    // SSE 'id:' field
  event: string;       // SSE 'event:' field (default 'message')
  data: string;        // SSE 'data:' field content
  timestamp: number;
  size: number;
}

export type MqttStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MqttMessage {
  id: string;
  direction: 'sent' | 'received';
  topic: string;
  payload: string;        // UTF-8 text or base64 for binary
  qos: 0 | 1 | 2;
  retained: boolean;
  timestamp: number;
  size: number;
}

export interface MqttSubscription {
  topic: string;
  qos: 0 | 1 | 2;
}

export interface MqttOptions {
  clientId?: string;        // auto-generated if empty
  cleanSession?: boolean;   // default true
  keepAlive?: number;       // default 60 (seconds)
  username?: string;
  password?: string;
  lastWillTopic?: string;
  lastWillPayload?: string;
  lastWillQos?: 0 | 1 | 2;
  lastWillRetain?: boolean;
}

export interface WsMessage {
  id: string;
  direction: 'sent' | 'received';
  timestamp: number;
  type: 'text' | 'binary';
  data: string;           // text content or base64 for binary
  event?: string;         // (reserved for future use)
  size: number;
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
  fileData?: string;  // base64 encoded file data
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

export type AuthConfig =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'apikey'; key: string; value: string; in: 'header' | 'query' }
  | { type: 'oauth2'; grantType: string; accessTokenUrl: string; clientId: string; clientSecret: string; scope: string };

export interface ApiRequest {
  id: string;
  name: string;
  description?: string;
  protocol?: Protocol;         // defaults to 'http'
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  preScript?: string;
  postScript?: string;
  sslVerify?: boolean;
  mqttOptions?: MqttOptions;   // MQTT-specific connection options
  createdAt: number;
  updatedAt: number;
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
  connect: number;   // DNS + TCP + TLS: from request start to first byte sent
  ttfb: number;      // Time to first byte: from request sent to response headers received
  download: number;  // Body download time
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

export interface WsSessionSummary {
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  duration: number;  // ms
}

export interface SseSessionSummary {
  eventCount: number;
  duration: number;  // ms
}

export interface MqttSessionSummary {
  publishedCount: number;
  receivedCount: number;
  subscribedTopics: string[];
  duration: number;  // ms
}

export interface HistoryEntry {
  id: string;
  request: ApiRequest;
  response?: ApiResponse;
  wsSession?: WsSessionSummary;
  sseSession?: SseSessionSummary;
  mqttSession?: MqttSessionSummary;
  timestamp: number;
}

export interface CollectionItem {
  type: 'request' | 'folder';
  name: string;
  request?: ApiRequest;
  items?: CollectionItem[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  items: CollectionItem[];
  variables?: KeyValuePair[];
  createdAt: number;
  updatedAt: number;
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
  createdAt: number;
  updatedAt: number;
}
