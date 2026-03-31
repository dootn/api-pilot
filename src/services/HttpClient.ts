import { request } from 'undici';
import { ApiRequest, ApiResponse, KeyValuePair } from '../types';
import { VariableResolver } from './VariableResolver';
import { isBinaryContentType } from './contentTypeUtils';

export class HttpClient {
  private abortControllers = new Map<string, AbortController>();
  private variableResolver = new VariableResolver();

  async send(apiRequest: ApiRequest, requestId: string, envVariables?: KeyValuePair[]): Promise<ApiResponse> {
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    // Resolve environment variables before building the request
    const resolvedRequest = envVariables?.length
      ? this.variableResolver.resolveObject(apiRequest, envVariables)
      : apiRequest;

    try {
      const startTime = Date.now();
      const url = this.buildUrl(resolvedRequest);
      const headers = this.buildHeaders(resolvedRequest);
      const body = this.buildBody(resolvedRequest);

      const response = await request(url, {
        method: resolvedRequest.method,
        headers,
        body,
        signal: controller.signal,
      });

      const flatHeaders = this.flattenHeaders(response.headers);
      const contentTypeHeader = flatHeaders['content-type'] || flatHeaders['Content-Type'] || '';
      const contentType = contentTypeHeader.split(';')[0].trim();

      let responseBody: string;
      let bodyBase64: string | undefined;
      let bodySize: number;

      if (this.isBinaryContentType(contentType)) {
        const buffer = Buffer.from(await response.body.arrayBuffer());
        bodyBase64 = buffer.toString('base64');
        responseBody = '';
        bodySize = buffer.byteLength;
      } else {
        responseBody = await response.body.text();
        bodySize = Buffer.byteLength(responseBody, 'utf-8');
      }

      const endTime = Date.now();

      return {
        status: response.statusCode,
        statusText: this.getStatusText(response.statusCode),
        headers: flatHeaders,
        body: responseBody,
        bodySize,
        time: endTime - startTime,
        contentType: contentType || undefined,
        bodyBase64,
      };
    } finally {
      this.abortControllers.delete(requestId);
    }
  }

  cancel(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  private buildUrl(apiRequest: ApiRequest): string {
    let url = apiRequest.url.trim();
    if (!url.match(/^https?:\/\//i)) {
      url = 'http://' + url;
    }

    const urlObj = new URL(url);

    // Add query params
    const enabledParams = apiRequest.params.filter(p => p.enabled && p.key);
    for (const param of enabledParams) {
      urlObj.searchParams.append(param.key, param.value);
    }

    return urlObj.toString();
  }

  private buildHeaders(apiRequest: ApiRequest): Record<string, string> {
    const headers: Record<string, string> = {};

    // Add enabled headers
    const enabledHeaders = apiRequest.headers.filter(h => h.enabled && h.key);
    for (const header of enabledHeaders) {
      headers[header.key] = header.value;
    }

    // Add auth headers
    this.applyAuth(apiRequest, headers);

    // Add content-type if not set
    if (!headers['Content-Type'] && !headers['content-type']) {
      if (apiRequest.body.type === 'json') {
        headers['Content-Type'] = 'application/json';
      } else if (apiRequest.body.type === 'x-www-form-urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (apiRequest.body.type === 'raw' && apiRequest.body.rawContentType) {
        headers['Content-Type'] = apiRequest.body.rawContentType;
      }
    }

    return headers;
  }

  private applyAuth(apiRequest: ApiRequest, headers: Record<string, string>): void {
    const auth = apiRequest.auth;
    switch (auth.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.token}`;
        break;
      case 'basic': {
        const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
        break;
      }
      case 'apikey':
        if (auth.in === 'header') {
          headers[auth.key] = auth.value;
        }
        break;
    }
  }

  private buildBody(apiRequest: ApiRequest): string | Uint8Array | undefined {
    if (['GET', 'HEAD', 'OPTIONS'].includes(apiRequest.method)) {
      return undefined;
    }

    switch (apiRequest.body.type) {
      case 'none':
        return undefined;
      case 'json':
      case 'raw':
        return apiRequest.body.raw || undefined;
      case 'binary':
        if (apiRequest.body.binaryData) {
          return Buffer.from(apiRequest.body.binaryData, 'base64');
        }
        return undefined;
      case 'graphql':
        if (apiRequest.body.graphql) {
          try {
            return JSON.stringify({
              query: apiRequest.body.graphql.query,
              variables: apiRequest.body.graphql.variables
                ? JSON.parse(apiRequest.body.graphql.variables)
                : undefined,
            });
          } catch {
            return JSON.stringify({ query: apiRequest.body.graphql.query });
          }
        }
        return undefined;
      case 'x-www-form-urlencoded': {
        const params = new URLSearchParams();
        const enabledFields = (apiRequest.body.urlEncoded || []).filter(f => f.enabled && f.key);
        for (const field of enabledFields) {
          params.append(field.key, field.value);
        }
        return params.toString();
      }
      default:
        return undefined;
    }
  }

  private isBinaryContentType(contentType: string): boolean {
    return isBinaryContentType(contentType);
  }

  private flattenHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        result[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }
    return result;
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK', 201: 'Created', 204: 'No Content',
      301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
      400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
      404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout',
      409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
      500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
    };
    return statusTexts[status] || '';
  }
}
