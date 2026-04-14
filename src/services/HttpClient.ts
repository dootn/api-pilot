import { request, Agent, Dispatcher } from 'undici';
import * as tls from 'tls';
import { AsyncLocalStorage } from 'node:async_hooks';
import diagnosticsChannel from 'node:diagnostics_channel';
import { ApiRequest, ApiResponse, KeyValuePair, SSLInfo, SSLCertificate, TimingBreakdown } from '../types';
import { VariableResolver } from './VariableResolver';
import { isBinaryContentType } from './contentTypeUtils';

interface TimingStore {
  sendHeadersTime?: number;
  responseHeadersTime?: number;
}

const requestTimingMap = new WeakMap<object, TimingStore>();
const timingStorage = new AsyncLocalStorage<TimingStore>();

// Capture the undici Request object while still in the caller's sync context
diagnosticsChannel.subscribe('undici:request:create', (msg: any) => {
  const store = timingStorage.getStore();
  if (store && msg?.request) {
    requestTimingMap.set(msg.request, store);
  }
});

// These fire in undici's I/O context — correlate via WeakMap
diagnosticsChannel.subscribe('undici:client:sendHeaders', (msg: any) => {
  if (msg?.request) {
    const timing = requestTimingMap.get(msg.request);
    if (timing && timing.sendHeadersTime === undefined) {
      timing.sendHeadersTime = Date.now();
    }
  }
});

diagnosticsChannel.subscribe('undici:request:headers', (msg: any) => {
  if (msg?.request) {
    const timing = requestTimingMap.get(msg.request);
    if (timing && timing.responseHeadersTime === undefined) {
      timing.responseHeadersTime = Date.now();
    }
  }
});

export class HttpClient {
  private abortControllers = new Map<string, AbortController>();
  private variableResolver = new VariableResolver();

  async send(apiRequest: ApiRequest, requestId: string, envVariables?: KeyValuePair[], timeoutMs?: number): Promise<ApiResponse> {
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

      // When SSL verification is explicitly disabled, use a custom Agent
      const sslVerify = resolvedRequest.sslVerify ?? true;
      const dispatcher = sslVerify ? undefined : new Agent({ connect: { rejectUnauthorized: false } });

      const effectiveTimeout = timeoutMs ?? 30000;
      const timingStore: TimingStore = {};
      const response = await timingStorage.run(timingStore, () => request(url, {
        method: resolvedRequest.method as Dispatcher.HttpMethod,
        headers,
        body,
        signal: controller.signal,
        headersTimeout: effectiveTimeout,
        bodyTimeout: effectiveTimeout,
        ...(dispatcher ? { dispatcher } : {}),
      }));

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

      // Collect SSL information for HTTPS requests
      let sslInfo: SSLInfo | undefined;
      if (url.startsWith('https://')) {
        try {
          sslInfo = await this.collectSSLInfo(url);
        } catch (error) {
          console.error('Failed to collect SSL info:', error);
        }
      }

      const timingBreakdown: TimingBreakdown | undefined =
        timingStore.sendHeadersTime !== undefined && timingStore.responseHeadersTime !== undefined
          ? {
              connect: timingStore.sendHeadersTime - startTime,
              ttfb: timingStore.responseHeadersTime - timingStore.sendHeadersTime,
              download: endTime - timingStore.responseHeadersTime,
            }
          : undefined;

      return {
        status: response.statusCode,
        statusText: this.getStatusText(response.statusCode),
        headers: flatHeaders,
        body: responseBody,
        bodySize,
        time: endTime - startTime,
        contentType: contentType || undefined,
        bodyBase64,
        sslInfo,
        timingBreakdown,
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

    // Add API Key as query param if configured
    const auth = apiRequest.auth as any;
    if (auth.type === 'apikey' && auth.in === 'query' && auth.key && auth.value) {
      urlObj.searchParams.append(auth.key, auth.value);
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

    // Add content-type if not set (case-insensitive check preserves any user-supplied header)
    const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
    if (!hasContentType) {
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
        if (auth.in === 'header' && auth.key) {
          headers[auth.key] = auth.value ?? '';
        }
        break;
    }
  }

  private buildBody(apiRequest: ApiRequest): string | Uint8Array | FormData | undefined {
    // Note: RFC allows body with any method, even GET/HEAD/OPTIONS.
    // Some APIs may accept body with GET requests, so we don't enforce restrictions.

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
      case 'form-data': {
        const formData = new FormData();
        const enabledFields = (apiRequest.body.formData || []).filter(f => f.enabled && f.key);
        for (const field of enabledFields) {
          if (field.type === 'file' && field.fileData && field.fileName) {
            // Convert base64 to Blob and attach as file
            const buffer = Buffer.from(field.fileData, 'base64');
            const blob = new Blob([buffer]);
            formData.append(field.key, blob, field.fileName);
          } else {
            // Regular text field
            formData.append(field.key, field.value);
          }
        }
        return formData;
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
      100: 'Continue', 101: 'Switching Protocols', 102: 'Processing', 103: 'Early Hints',
      200: 'OK', 201: 'Created', 202: 'Accepted', 203: 'Non-Authoritative Information',
      204: 'No Content', 205: 'Reset Content', 206: 'Partial Content', 207: 'Multi-Status',
      208: 'Already Reported', 226: 'IM Used',
      300: 'Multiple Choices', 301: 'Moved Permanently', 302: 'Found',
      303: 'See Other', 304: 'Not Modified', 305: 'Use Proxy',
      307: 'Temporary Redirect', 308: 'Permanent Redirect',
      400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required',
      403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
      406: 'Not Acceptable', 407: 'Proxy Authentication Required', 408: 'Request Timeout',
      409: 'Conflict', 410: 'Gone', 411: 'Length Required',
      412: 'Precondition Failed', 413: 'Content Too Large', 414: 'URI Too Long',
      415: 'Unsupported Media Type', 416: 'Range Not Satisfiable', 417: 'Expectation Failed',
      418: "I'm a Teapot", 421: 'Misdirected Request', 422: 'Unprocessable Content',
      423: 'Locked', 424: 'Failed Dependency', 425: 'Too Early',
      426: 'Upgrade Required', 428: 'Precondition Required', 429: 'Too Many Requests',
      431: 'Request Header Fields Too Large', 451: 'Unavailable For Legal Reasons',
      500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
      503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported',
      506: 'Variant Also Negotiates', 507: 'Insufficient Storage', 508: 'Loop Detected',
      510: 'Not Extended', 511: 'Network Authentication Required',
    };
    return statusTexts[status] || '';
  }

  public async collectSSLInfo(url: string): Promise<SSLInfo> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      let settled = false;

      // Use an absolute setTimeout so the Promise always settles,
      // regardless of DNS hang or socket assignment state.
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(new Error('SSL info collection timeout'));
        }
      }, 5000);

      // Use tls.connect directly — no HTTP request needed.
      // A pure TLS handshake is enough to get certificate / cipher info.
      const socket = tls.connect({
        host: urlObj.hostname,
        port: Number(urlObj.port) || 443,
        rejectUnauthorized: false,
        servername: urlObj.hostname, // SNI support
      });

      socket.on('secureConnect', () => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;

        const peerCert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol();

        const sslInfo: SSLInfo = {
          authorized: socket.authorized,
          authorizationError: socket.authorizationError?.message,
          protocol: protocol || 'unknown',
          cipher: {
            name: cipher?.name || 'unknown',
            version: cipher?.version || 'unknown',
          },
        };

        if (peerCert && Object.keys(peerCert).length > 0) {
          sslInfo.certificate = this.parseCertificate(peerCert);
          sslInfo.certificateChain = this.parseCertificateChain(peerCert);
        }

        socket.destroy();
        resolve(sslInfo);
      });

      socket.on('error', (err) => {
        if (!settled) {
          clearTimeout(timer);
          settled = true;
          reject(err);
        }
      });
    });
  }

  private parseCertificate(cert: any): SSLCertificate {
    return {
      subject: cert.subject || {},
      issuer: cert.issuer || {},
      validFrom: cert.valid_from || '',
      validTo: cert.valid_to || '',
      serialNumber: cert.serialNumber || '',
      fingerprint: cert.fingerprint || cert.fingerprint256 || '',
      signatureAlgorithm: cert.sigalg || '',
      subjectAltNames: cert.subjectaltname?.split(', ') || [],
    };
  }

  private parseCertificateChain(cert: any): SSLCertificate[] {
    const chain: SSLCertificate[] = [];
    const seen = new Set<string>();
    let current = cert;

    while (current) {
      const fp = current.fingerprint256 || current.fingerprint;
      if (fp && seen.has(fp)) {
        break;
      }
      if (fp) seen.add(fp);

      chain.push(this.parseCertificate(current));

      // Stop at self-signed root (issuer === subject)
      if (current.issuerCertificate &&
          JSON.stringify(current.issuerCertificate.subject) === JSON.stringify(current.issuerCertificate.issuer)) {
        chain.push(this.parseCertificate(current.issuerCertificate));
        break;
      }

      current = current.issuerCertificate;
    }

    return chain;
  }
}
