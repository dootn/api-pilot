export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type Protocol = 'http' | 'websocket' | 'sse' | 'mqtt' | 'grpc' | 'dns' | 'redis';

// DNS query type — any IANA-registered name (A, MX, HTTPS…) or a numeric type code like "65"
export type DnsQueryType = string;

export interface DnsOptions {
  queryType: string;         // record type: 'A', 'MX', 'HTTPS', '65', …
  dnsServer?: string;        // e.g. "udp://1.1.1.1:53" or "tcp://1.1.1.1:53"
  timeout?: number;          // ms, default 5000
  class?: string;            // query class: 'IN' (default), 'CH', 'HS', 'ANY'
  recursionDesired?: boolean; // RD flag, default true
  checkingDisabled?: boolean; // CD flag — bypass DNSSEC validation
  dnssec?: boolean;           // add EDNS OPT with DO bit — request DNSSEC records
  ednsBufferSize?: number;    // EDNS UDP payload size, e.g. 1232 or 4096
}

export interface DnsRecord {
  type: string;
  value: string;
  ttl?: number;
  priority?: number;   // MX, SRV
  weight?: number;     // SRV
  port?: number;       // SRV
  entries?: string[];  // TXT raw chunks
}

export interface DnsResponse {
  hostname: string;
  queryType: string;
  records: DnsRecord[];
  time: number;       // query time ms
  server?: string;    // DNS server used (undefined = system default)
  status: 'ok' | 'error' | 'nxdomain' | 'timeout';
  error?: string;
  raw?: Record<string, unknown>;  // full decoded DNS response (questions, answers, authorities, additionals, flags)
}

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
  grpcOptions?: GrpcOptions;   // gRPC-specific options
  dnsOptions?: DnsOptions;     // DNS-specific options
  redisOptions?: RedisOptions; // Redis-specific options
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

export type GrpcStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error';

export type GrpcCallType = 'unary' | 'server_streaming' | 'client_streaming' | 'bidi_streaming';

export interface GrpcMessage {
  id: string;
  direction: 'sent' | 'received';
  data: string;            // JSON-encoded protobuf message
  timestamp: number;
  isEnd?: boolean;         // server/bidi: end-of-stream marker
  isError?: boolean;
  errorMessage?: string;
}

export interface GrpcFieldDef {
  name: string;
  typeName: string;   // "string", "int32", "bool", or a nested message type name
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
  name: string;            // fully-qualified, e.g. "helloworld.Greeter"
  methods: GrpcMethodDef[];
}

export interface GrpcOptions {
  /** TLS mode */
  tls?: 'none' | 'tls' | 'mtls';
  /** CA certificate PEM (for TLS/mTLS) */
  caCert?: string;
  /** Client certificate PEM (mTLS only) */
  clientCert?: string;
  /** Client key PEM (mTLS only) */
  clientKey?: string;
  /** Custom metadata key-value pairs (sent as gRPC headers) */
  metadata?: { key: string; value: string; enabled: boolean }[];
  /** Proto source: 'reflection' | 'proto' */
  protoSource?: 'reflection' | 'proto';
  /** Proto file content (when protoSource === 'proto') */
  protoContent?: string;
  /** Proto file name (for display only) */
  protoFileName?: string;
  /** Selected service name */
  serviceName?: string;
  /** Selected method name */
  methodName?: string;
}

export interface GrpcSessionSummary {
  callType: GrpcCallType;
  serviceName: string;
  methodName: string;
  sentCount: number;
  receivedCount: number;
  statusCode?: string;     // gRPC status code string, e.g. 'OK', 'NOT_FOUND'
  statusMessage?: string;
  duration: number;        // ms
}

export type RedisStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RedisMessage {
  id: string;
  direction: 'sent' | 'received';
  command?: string;    // raw command string (for 'sent')
  response: string;    // formatted response
  timestamp: number;
  isError?: boolean;
}

export interface RedisOptions {
  db?: number;             // database index 0-15, default 0
  username?: string;       // Redis 6+ ACL username
  password?: string;
  tls?: boolean;           // enable TLS (rediss://)
  connectTimeout?: number; // ms, default 10000
}

export interface RedisSessionSummary {
  sentCount: number;
  receivedCount: number;
  duration: number;  // ms
}

export interface DnsSessionSummary {
  hostname: string;
  queryType: string;
  recordCount: number;
  duration: number;  // ms
  status: DnsResponse['status'];
  rcode?: number;
}

export interface HistoryEntry {
  id: string;
  request: ApiRequest;
  response?: ApiResponse;
  wsSession?: WsSessionSummary;
  sseSession?: SseSessionSummary;
  mqttSession?: MqttSessionSummary;
  grpcSession?: GrpcSessionSummary;
  dnsSession?: DnsSessionSummary;
  dnsResponse?: DnsResponse;
  redisSession?: RedisSessionSummary;
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
