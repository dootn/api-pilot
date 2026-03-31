import { ApiRequest } from '../types';

/**
 * Export an ApiRequest as a cURL command string.
 */
export function exportCurl(request: ApiRequest): string {
  const parts: string[] = ['curl'];

  // Method (skip for GET as it's the default)
  if (request.method !== 'GET') {
    parts.push(`-X ${request.method}`);
  }

  // URL with query params
  let url = request.url;
  const enabledParams = request.params.filter((p) => p.enabled && p.key);
  if (request.auth.type === 'apikey' && request.auth.in === 'query' && request.auth.key) {
    enabledParams.push({ key: request.auth.key, value: request.auth.value, enabled: true });
  }
  if (enabledParams.length > 0) {
    const qs = enabledParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}${qs}`;
  }
  parts.push(escapeShell(url));

  // Headers
  const enabledHeaders = request.headers.filter((h) => h.enabled && h.key);
  for (const header of enabledHeaders) {
    parts.push(`-H ${escapeShell(`${header.key}: ${header.value}`)}`);
  }

  const hasContentType = enabledHeaders.some((h) => h.key.toLowerCase() === 'content-type');

  // Auth
  switch (request.auth.type) {
    case 'bearer':
      parts.push(`-H ${escapeShell(`Authorization: Bearer ${request.auth.token}`)}`);
      break;
    case 'basic':
      parts.push(`-u ${escapeShell(`${request.auth.username}:${request.auth.password}`)}`);
      break;
    case 'apikey':
      if (request.auth.in === 'header') {
        parts.push(`-H ${escapeShell(`${request.auth.key}: ${request.auth.value}`)}`);
      }
      break;
  }

  // Body
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    switch (request.body.type) {
      case 'json':
        if (!enabledHeaders.some((h) => h.key.toLowerCase() === 'content-type')) {
          parts.push(`-H ${escapeShell('Content-Type: application/json')}`);
        }
        if (request.body.raw) {
          parts.push(`-d ${escapeShell(request.body.raw)}`);
        }
        break;
      case 'raw':
        if (!hasContentType && request.body.rawContentType) {
          parts.push(`-H ${escapeShell(`Content-Type: ${request.body.rawContentType}`)}`);
        }
        if (request.body.raw) {
          parts.push(`-d ${escapeShell(request.body.raw)}`);
        }
        break;
      case 'x-www-form-urlencoded': {
        const fields = (request.body.urlEncoded || []).filter((f) => f.enabled && f.key);
        if (fields.length > 0) {
          if (!hasContentType) {
            parts.push(`-H ${escapeShell('Content-Type: application/x-www-form-urlencoded')}`);
          }
          const data = fields
            .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
            .join('&');
          parts.push(`-d ${escapeShell(data)}`);
        }
        break;
      }
      case 'form-data': {
        const fields = (request.body.formData || []).filter((f) => f.enabled && f.key);
        for (const field of fields) {
          if (field.type === 'file' && field.filePath) {
            parts.push(`-F ${escapeShell(`${field.key}=@${field.filePath}`)}`);
          } else {
            parts.push(`-F ${escapeShell(`${field.key}=${field.value}`)}`);
          }
        }
        break;
      }
      case 'binary':
        if (request.body.binaryPath) {
          parts.push(`--data-binary ${escapeShell(`@${request.body.binaryPath}`)}`);
        }
        break;
      case 'graphql': {
        if (!hasContentType) {
          parts.push(`-H ${escapeShell('Content-Type: application/json')}`);
        }
        if (request.body.graphql) {
          const payload = request.body.graphql.variables
            ? { query: request.body.graphql.query, variables: safeParseJson(request.body.graphql.variables) }
            : { query: request.body.graphql.query };
          parts.push(`-d ${escapeShell(JSON.stringify(payload))}`);
        }
        break;
      }
    }
  }

  return parts.join(' \\\n  ');
}

function escapeShell(str: string): string {
  // Use single quotes, escaping existing single quotes
  if (!str.includes("'")) {
    return `'${str}'`;
  }
  // Replace ' with '\'' (end single quote, escaped single quote, start single quote)
  return `'${str.replace(/'/g, "'\\''")}'`;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
