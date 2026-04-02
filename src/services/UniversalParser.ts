import { ApiRequest, KeyValuePair, RequestBody } from '../types';
import { parseCurl } from './CurlParser';

type ParsedFormat = 'curl' | 'fetch' | 'unknown';

/**
 * Auto-detect and parse any supported request format into an ApiRequest.
 * Supported: curl (bash), fetch (Chrome/Node.js).
 */
export function parseRequest(input: string): ApiRequest {
  const trimmed = input.trim();
  const format = detectFormat(trimmed);

  switch (format) {
    case 'curl':
      return parseCurl(trimmed);
    case 'fetch':
      return parseFetch(trimmed);
    default:
      // Last-ditch: try curl parser (handles bare URLs too)
      return parseCurl(trimmed);
  }
}

function detectFormat(input: string): ParsedFormat {
  const lower = input.toLowerCase();

  // fetch (JS or Node.js)
  if (lower.includes('fetch(') || lower.includes('fetch (')) {
    return 'fetch';
  }

  // curl (bash, or bare url)
  if (lower.startsWith('curl') || !lower.startsWith('import') && !lower.startsWith('const') && !lower.startsWith('let') && !lower.startsWith('var')) {
    return 'curl';
  }

  return 'unknown';
}

// ─── fetch parser ────────────────────────────────────────────────────────────

function parseFetch(input: string): ApiRequest {
  // Normalize multi-line and remove leading assignment (const response = await ...)
  const normalized = input.replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ');

  const urlMatch = normalized.match(/fetch\s*\(\s*["'`]([^"'`\n]+)["'`]/);
  if (!urlMatch) {
    throw new Error('Could not parse fetch URL');
  }
  const url = urlMatch[1];

  const result = emptyRequest(url);

  // Extract options object
  const afterUrl = normalized.slice(normalized.indexOf(urlMatch[0]) + urlMatch[0].length);
  const optionsStr = extractOutermostObject(afterUrl);
  if (optionsStr) {
    try {
      const options = JSON.parse(optionsStr) as Record<string, unknown>;
      if (typeof options.method === 'string') {
        result.method = options.method.toUpperCase() as ApiRequest['method'];
      }
      if (options.headers && typeof options.headers === 'object') {
        result.headers = objectToKvPairs(options.headers as Record<string, string>);
      }
      if (typeof options.body === 'string' && options.body) {
        result.body = detectBodyType(options.body, result.headers);
        if (result.method === 'GET') result.method = 'POST';
      }
    } catch {
      // JSON parse failed — try a best-effort regex extract
      const methodMatch = optionsStr.match(/"method"\s*:\s*"([A-Z]+)"/i);
      if (methodMatch) result.method = methodMatch[1].toUpperCase() as ApiRequest['method'];
    }
  }

  finalize(result);
  return result;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function emptyRequest(url: string): ApiRequest {
  return {
    id: '',
    name: '',
    method: 'GET',
    url,
    params: [],
    headers: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function finalize(result: ApiRequest): void {
  // Extract query params from URL
  try {
    const urlObj = new URL(result.url);
    const params: KeyValuePair[] = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({ key, value, enabled: true });
    });
    if (params.length > 0) {
      result.params = params;
      result.url = urlObj.origin + urlObj.pathname;
    }
  } catch { /* ok */ }

  result.name = `${result.method} ${result.url}`;
}

function objectToKvPairs(obj: Record<string, string>): KeyValuePair[] {
  return Object.entries(obj).map(([key, value]) => ({ key, value, enabled: true }));
}

export function detectBodyType(data: string, headers: KeyValuePair[]): RequestBody {
  const ct = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value?.toLowerCase() || '';
  if (ct.includes('application/json') || (data.trimStart().startsWith('{') || data.trimStart().startsWith('['))) {
    return { type: 'json', raw: data };
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    return { type: 'x-www-form-urlencoded', urlEncoded: parseUrlEncoded(data) };
  }
  return { type: 'raw', raw: data };
}

function parseUrlEncoded(data: string): KeyValuePair[] {
  return data.split('&').map((pair) => {
    const [k, ...rest] = pair.split('=');
    return {
      key: decodeURIComponent(k || ''),
      value: decodeURIComponent(rest.join('=') || ''),
      enabled: true,
    };
  });
}

function extractOutermostObject(input: string): string | null {
  const start = input.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let strChar = '';
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === strChar) inStr = false;
    } else if (ch === '"' || ch === "'") {
      inStr = true; strChar = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}
