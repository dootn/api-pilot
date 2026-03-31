export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface RequestBody {
  type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';
  raw?: string;
  rawContentType?: string;
  formData?: KeyValuePair[];
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
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  preScript?: string;
  postScript?: string;
  createdAt: number;
  updatedAt: number;
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
}

export interface HistoryEntry {
  id: string;
  request: ApiRequest;
  response: ApiResponse;
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
