import { ApiRequest, KeyValuePair } from '../types';

/**
 * Parse a cURL command string into an ApiRequest object.
 */
export function parseCurl(curlCommand: string): ApiRequest {
  // Normalize: remove line continuations and extra whitespace
  let cmd = curlCommand
    .replace(/\\\n/g, ' ')
    .replace(/\\\r\n/g, ' ')
    .trim();

  // Remove leading "curl" word
  if (cmd.toLowerCase().startsWith('curl')) {
    cmd = cmd.slice(4).trim();
  }

  const result: ApiRequest = {
    id: '',
    name: '',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const tokens = tokenize(cmd);
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      i++;
      if (i < tokens.length) {
        result.method = tokens[i].toUpperCase() as ApiRequest['method'];
      }
    } else if (token === '-H' || token === '--header') {
      i++;
      if (i < tokens.length) {
        const header = parseHeader(tokens[i]);
        if (header) {
          result.headers.push(header);
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      i++;
      if (i < tokens.length) {
        const data = tokens[i];
        result.body = detectBodyType(data, result.headers);
        if (result.method === 'GET') {
          result.method = 'POST';
        }
      }
    } else if (token === '--data-urlencode') {
      i++;
      if (i < tokens.length) {
        result.body = { type: 'x-www-form-urlencoded', urlEncoded: [] };
        const parts = tokens[i].split('=');
        if (parts.length >= 2) {
          (result.body.urlEncoded as KeyValuePair[]).push({
            key: parts[0],
            value: parts.slice(1).join('='),
            enabled: true,
          });
        }
        if (result.method === 'GET') {
          result.method = 'POST';
        }
      }
    } else if (token === '-u' || token === '--user') {
      i++;
      if (i < tokens.length) {
        const [username, ...passwordParts] = tokens[i].split(':');
        result.auth = {
          type: 'basic',
          username,
          password: passwordParts.join(':'),
        };
      }
    } else if (token === '--compressed' || token === '-s' || token === '--silent' || token === '-k' || token === '--insecure' || token === '-L' || token === '--location' || token === '-v' || token === '--verbose') {
      // Skip common flags
    } else if (!token.startsWith('-')) {
      // Assume it's the URL
      let url = token;
      // Remove surrounding quotes
      if ((url.startsWith("'") && url.endsWith("'")) || (url.startsWith('"') && url.endsWith('"'))) {
        url = url.slice(1, -1);
      }
      result.url = url;
    }

    i++;
  }

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
  } catch {
    // URL might be partial, skip param extraction
  }

  result.name = `${result.method} ${result.url}`;

  return result;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function parseHeader(headerStr: string): KeyValuePair | null {
  const colonIndex = headerStr.indexOf(':');
  if (colonIndex < 0) return null;
  return {
    key: headerStr.slice(0, colonIndex).trim(),
    value: headerStr.slice(colonIndex + 1).trim(),
    enabled: true,
  };
}

function detectBodyType(data: string, headers: KeyValuePair[]): ApiRequest['body'] {
  const contentType = headers.find(
    (h) => h.key.toLowerCase() === 'content-type'
  )?.value?.toLowerCase();

  if (contentType?.includes('application/json') || isJsonLike(data)) {
    return { type: 'json', raw: data };
  }

  if (contentType?.includes('application/x-www-form-urlencoded')) {
    const pairs = data.split('&').map((pair) => {
      const [key, ...val] = pair.split('=');
      return {
        key: decodeURIComponent(key || ''),
        value: decodeURIComponent(val.join('=')),
        enabled: true,
      };
    });
    return { type: 'x-www-form-urlencoded', urlEncoded: pairs };
  }

  return { type: 'raw', raw: data };
}

function isJsonLike(str: string): boolean {
  const trimmed = str.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}
