import { create } from 'zustand';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | string;

export type Protocol = 'http' | 'websocket' | 'sse' | 'mqtt' | 'grpc';

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type SseStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type MqttStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

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
  graphql?: { query: string; variables: string };
}

export interface AuthConfig {
  type: 'none' | 'bearer' | 'basic' | 'apikey';
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  value?: string;
  in?: 'header' | 'query';
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

interface RequestState {
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  activeTab: 'params' | 'headers' | 'body' | 'auth';

  response: ApiResponse | null;
  responseError: string | null;
  loading: boolean;

  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  setParams: (params: KeyValuePair[]) => void;
  setHeaders: (headers: KeyValuePair[]) => void;
  setBody: (body: RequestBody) => void;
  setAuth: (auth: AuthConfig) => void;
  setActiveTab: (tab: RequestState['activeTab']) => void;
  setResponse: (response: ApiResponse | null) => void;
  setResponseError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useRequestStore = create<RequestState>((set) => ({
  method: 'GET',
  url: '',
  params: [{ key: '', value: '', enabled: true }],
  headers: [{ key: '', value: '', enabled: true }],
  body: { type: 'none' },
  auth: { type: 'none' },
  activeTab: 'params',
  response: null,
  responseError: null,
  loading: false,

  setMethod: (method) => set({ method }),
  setUrl: (url) => set({ url }),
  setParams: (params) => set({ params }),
  setHeaders: (headers) => set({ headers }),
  setBody: (body) => set({ body }),
  setAuth: (auth) => set({ auth }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setResponse: (response) => set({ response, responseError: null }),
  setResponseError: (responseError) => set({ responseError, response: null }),
  setLoading: (loading) => set({ loading }),
}));
