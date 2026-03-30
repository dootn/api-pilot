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
  if (request.params.length > 0) {
    const enabledParams = request.params.filter((p) => p.enabled && p.key);
    if (enabledParams.length > 0) {
      const qs = enabledParams
        .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
        .join('&');
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${qs}`;
    }
  }
  parts.push(escapeShell(url));

  // Headers
  const enabledHeaders = request.headers.filter((h) => h.enabled && h.key);
  for (const header of enabledHeaders) {
    parts.push(`-H ${escapeShell(`${header.key}: ${header.value}`)}`);
  }

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
        if (request.body.raw) {
          parts.push(`-d ${escapeShell(request.body.raw)}`);
        }
        break;
      case 'x-www-form-urlencoded': {
        const fields = (request.body.urlEncoded || []).filter((f) => f.enabled && f.key);
        if (fields.length > 0) {
          const data = fields
            .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
            .join('&');
          parts.push(`-d ${escapeShell(data)}`);
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
