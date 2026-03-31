import { create } from 'zustand';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

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
