import type { RequestTab } from '../stores/tabStore';
import type { AuthConfig, KeyValuePair, RequestBody } from '../stores/requestStore';

// ─── helpers ────────────────────────────────────────────────────────────────

function escapeShell(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function buildUrl(tab: Pick<RequestTab, 'url' | 'params' | 'auth'>): string {
  let url = tab.url.trim();
  const enabledParams = tab.params.filter((p) => p.enabled && p.key);
  if (tab.auth.type === 'apikey' && tab.auth.in === 'query' && tab.auth.key) {
    enabledParams.push({ key: tab.auth.key, value: tab.auth.value ?? '', enabled: true });
  }
  if (enabledParams.length > 0) {
    const qs = enabledParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}${qs}`;
  }
  return url;
}

function getEnabledHeaders(tab: Pick<RequestTab, 'headers'>): KeyValuePair[] {
  return tab.headers.filter((h) => h.enabled && h.key);
}

function getAuthHeaders(auth: AuthConfig): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  if (auth.type === 'bearer' && auth.token) {
    out.push({ key: 'Authorization', value: `Bearer ${auth.token}` });
  } else if (auth.type === 'apikey' && auth.in === 'header' && auth.key) {
    out.push({ key: auth.key, value: auth.value ?? '' });
  }
  return out;
}

function getBodyContent(body: RequestBody): { contentType: string | null; content: string | null } {
  switch (body.type) {
    case 'json':
      return { contentType: 'application/json', content: body.raw ?? '' };
    case 'raw':
      return { contentType: body.rawContentType ?? 'text/plain', content: body.raw ?? '' };
    case 'x-www-form-urlencoded': {
      const pairs = (body.urlEncoded ?? []).filter((p) => p.enabled && p.key);
      const content = pairs
        .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
        .join('&');
      return { contentType: 'application/x-www-form-urlencoded', content };
    }
    case 'graphql': {
      let vars: unknown = {};
      try { vars = JSON.parse(body.graphql?.variables ?? '{}'); } catch { /* ignore */ }
      return {
        contentType: 'application/json',
        content: JSON.stringify({ query: body.graphql?.query ?? '', variables: vars }),
      };
    }
    default:
      return { contentType: null, content: null };
  }
}

// ─── cURL ───────────────────────────────────────────────────────────────────

export function generateCurl(tab: RequestTab): string {
  const parts: string[] = ['curl'];
  if (tab.method !== 'GET') parts.push(`-X ${tab.method}`);
  parts.push(escapeShell(buildUrl(tab)));

  const enabledHeaders = getEnabledHeaders(tab);
  for (const h of enabledHeaders) {
    parts.push(`-H ${escapeShell(`${h.key}: ${h.value}`)}`);
  }
  for (const h of getAuthHeaders(tab.auth)) {
    parts.push(`-H ${escapeShell(`${h.key}: ${h.value}`)}`);
  }
  if (tab.auth.type === 'basic' && tab.auth.username) {
    parts.push(`-u ${escapeShell(`${tab.auth.username}:${tab.auth.password ?? ''}`)}`);
  }

  const { contentType, content } = getBodyContent(tab.body);
  if (contentType && content !== null) {
    const hasContentType = enabledHeaders.some((h) => h.key.toLowerCase() === 'content-type');
    if (!hasContentType) parts.push(`-H ${escapeShell(`Content-Type: ${contentType}`)}`);
    parts.push(`-d ${escapeShell(content)}`);
  }

  if (tab.body.type === 'form-data' && tab.body.formData) {
    for (const f of tab.body.formData.filter((f) => f.enabled && f.key)) {
      if (f.type === 'file' && f.filePath) {
        parts.push(`-F ${escapeShell(`${f.key}=@${f.filePath}`)}`);
      } else {
        parts.push(`-F ${escapeShell(`${f.key}=${f.value}`)}`);
      }
    }
  }

  return parts.join(' \\\n  ');
}

// ─── JavaScript – fetch ──────────────────────────────────────────────────────

export function generateJsFetch(tab: RequestTab): string {
  const url = buildUrl(tab);
  const headers: Record<string, string> = {};
  for (const h of getEnabledHeaders(tab)) headers[h.key] = h.value;
  for (const h of getAuthHeaders(tab.auth)) headers[h.key] = h.value;

  const { contentType, content } = getBodyContent(tab.body);
  const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
  if (contentType && content !== null && !hasContentType) headers['Content-Type'] = contentType;

  const headersStr =
    Object.keys(headers).length > 0
      ? `\n  headers: ${JSON.stringify(headers, null, 2).replace(/^/gm, '  ').trimStart()},`
      : '';

  let bodyStr = '';
  if (tab.body.type === 'form-data' && tab.body.formData) {
    const fields = tab.body.formData.filter((f) => f.enabled && f.key);
    const appends = fields
      .map((f) =>
        f.type === 'file'
          ? `  fd.append(${JSON.stringify(f.key)}, /* File: ${f.filePath} */);`
          : `  fd.append(${JSON.stringify(f.key)}, ${JSON.stringify(f.value)});`
      )
      .join('\n');
    bodyStr = `\nconst fd = new FormData();\n${appends}\n`;
    bodyStr += `\nconst response = await fetch(${JSON.stringify(url)}, {\n  method: ${JSON.stringify(tab.method)},${headersStr}\n  body: fd,\n});\n`;
  } else {
    const bodyArg = content !== null ? `\n  body: ${JSON.stringify(content)},` : '';
    bodyStr = `\nconst response = await fetch(${JSON.stringify(url)}, {\n  method: ${JSON.stringify(tab.method)},${headersStr}${bodyArg}\n});\n`;
  }

  let basicNote = '';
  if (tab.auth.type === 'basic' && tab.auth.username) {
    const encoded = btoa(`${tab.auth.username}:${tab.auth.password ?? ''}`);
    basicNote = `// Basic Auth: Authorization: Basic ${encoded}\n`;
  }

  return `${basicNote}${bodyStr}\nconst data = await response.json();\nconsole.log(data);`;
}

// ─── JavaScript – axios ──────────────────────────────────────────────────────

export function generateJsAxios(tab: RequestTab): string {
  const url = buildUrl(tab);
  const headers: Record<string, string> = {};
  for (const h of getEnabledHeaders(tab)) headers[h.key] = h.value;
  for (const h of getAuthHeaders(tab.auth)) headers[h.key] = h.value;

  const { contentType, content } = getBodyContent(tab.body);
  const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
  if (contentType && content !== null && !hasContentType) headers['Content-Type'] = contentType;

  const parts: string[] = [];
  parts.push(`  method: ${JSON.stringify(tab.method.toLowerCase())}`);
  parts.push(`  url: ${JSON.stringify(url)}`);

  if (Object.keys(headers).length > 0) {
    parts.push(`  headers: ${JSON.stringify(headers, null, 2).replace(/^/gm, '  ').trimStart()}`);
  }

  if (tab.auth.type === 'basic' && tab.auth.username) {
    parts.push(`  auth: { username: ${JSON.stringify(tab.auth.username)}, password: ${JSON.stringify(tab.auth.password ?? '')} }`);
  }

  if (tab.body.type === 'form-data' && tab.body.formData) {
    const fields = tab.body.formData.filter((f) => f.enabled && f.key);
    const appends = fields
      .map((f) =>
        f.type === 'file'
          ? `  fd.append(${JSON.stringify(f.key)}, /* File: ${f.filePath} */);`
          : `  fd.append(${JSON.stringify(f.key)}, ${JSON.stringify(f.value)});`
      )
      .join('\n');
    return `const fd = new FormData();\n${appends}\n\nconst response = await axios({\n${parts.join(',\n')},\n  data: fd,\n});\nconsole.log(response.data);`;
  }

  if (content !== null) {
    parts.push(`  data: ${JSON.stringify(content)}`);
  }

  return `const response = await axios({\n${parts.join(',\n')},\n});\nconsole.log(response.data);`;
}

// ─── Python – requests ───────────────────────────────────────────────────────

function toPy(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '')}"`;
}

function toPyDict(obj: Record<string, string>, indent = 4): string {
  const pad = ' '.repeat(indent);
  const entries = Object.entries(obj)
    .map(([k, v]) => `${pad}${toPy(k)}: ${toPy(v)}`)
    .join(',\n');
  return `{\n${entries},\n}`;
}

export function generatePython(tab: RequestTab): string {
  const url = buildUrl(tab);
  const headers: Record<string, string> = {};
  for (const h of getEnabledHeaders(tab)) headers[h.key] = h.value;
  for (const h of getAuthHeaders(tab.auth)) headers[h.key] = h.value;

  const { contentType, content } = getBodyContent(tab.body);
  const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
  if (contentType && content !== null && !hasContentType) headers['Content-Type'] = contentType;

  const lines: string[] = ['import requests', ''];

  const kwArgs: string[] = [`    ${toPy(url)}`];

  if (Object.keys(headers).length > 0) {
    lines.push(`headers = ${toPyDict(headers)}`);
    lines.push('');
    kwArgs.push('    headers=headers');
  }

  if (tab.auth.type === 'basic' && tab.auth.username) {
    kwArgs.push(`    auth=(${toPy(tab.auth.username)}, ${toPy(tab.auth.password ?? '')})`);
  }

  if (tab.body.type === 'form-data' && tab.body.formData) {
    const textFields = tab.body.formData.filter((f) => f.enabled && f.key && f.type !== 'file');
    const fileFields = tab.body.formData.filter((f) => f.enabled && f.key && f.type === 'file');
    if (textFields.length > 0) {
      lines.push(`data = ${toPyDict(Object.fromEntries(textFields.map((f) => [f.key, f.value])))}`);
      lines.push('');
      kwArgs.push('    data=data');
    }
    if (fileFields.length > 0) {
      const entries = fileFields
        .map((f) => `    ${toPy(f.key)}: open(${toPy(f.filePath ?? '')}, "rb")`)
        .join(',\n');
      lines.push(`files = {\n${entries},\n}`);
      lines.push('');
      kwArgs.push('    files=files');
    }
  } else if (tab.body.type === 'x-www-form-urlencoded' && tab.body.urlEncoded) {
    const fields = tab.body.urlEncoded.filter((f) => f.enabled && f.key);
    lines.push(`data = ${toPyDict(Object.fromEntries(fields.map((f) => [f.key, f.value])))}`);
    lines.push('');
    kwArgs.push('    data=data');
  } else if (tab.body.type === 'json' && content !== null) {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const entries = Object.entries(parsed)
        .map(([k, v]) => `    ${toPy(k)}: ${typeof v === 'string' ? toPy(v) : JSON.stringify(v)}`)
        .join(',\n');
      lines.push(`json_data = {\n${entries},\n}`);
    } catch {
      lines.push(`json_data = ${toPy(content)}`);
    }
    lines.push('');
    kwArgs.push('    json=json_data');
  } else if (content !== null) {
    lines.push(`data = ${toPy(content)}`);
    lines.push('');
    kwArgs.push('    data=data');
  }

  const method = tab.method.toLowerCase();
  lines.push(`response = requests.${method}(\n${kwArgs.join(',\n')},\n)`);
  lines.push('');
  lines.push('print(response.status_code)');
  lines.push('print(response.json())');

  return lines.join('\n');
}
