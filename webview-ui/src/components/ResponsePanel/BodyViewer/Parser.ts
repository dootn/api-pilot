import type { ParsedBody } from './types';

const BINARY_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
  'application/gzip',
]);

/**
 * Parse a response body + content-type into a unified ParsedBody structure.
 *
 * @param body       - Raw response body string (may be empty for binary types).
 * @param contentType - HTTP Content-Type header value.
 * @param bodyBase64  - Base64-encoded body, used for image / video / audio / PDF types.
 */
export function parseBody(
  body: string,
  contentType?: string,
  bodyBase64?: string,
): ParsedBody {
  const ct = (contentType ?? '').toLowerCase().split(';')[0].trim();

  // ── Binary media types ──────────────────────────────────────────────────
  // SVG is XML — check before the generic image/* guard
  if (ct === 'image/svg+xml') {
    return { type: 'xml', data: body, raw: body };
  }
  if (ct.startsWith('image/')) {
    return { type: 'image', data: bodyBase64 ?? body, raw: body };
  }
  if (ct.startsWith('video/')) {
    return { type: 'video', data: bodyBase64 ?? body, raw: body };
  }
  if (ct.startsWith('audio/')) {
    return { type: 'audio', data: bodyBase64 ?? body, raw: body };
  }
  if (ct === 'application/pdf') {
    return { type: 'pdf', data: bodyBase64 ?? body, raw: body };
  }
  if (BINARY_CONTENT_TYPES.has(ct)) {
    return { type: 'binary', data: body, raw: body };
  }

  const trimmed = body.trimStart();

  // ── JSON ────────────────────────────────────────────────────────────────
  if (ct.includes('json')) {
    try {
      const data = JSON.parse(body);
      return { type: 'json', data, raw: body };
    } catch {
      return { type: 'text', data: body, raw: body };
    }
  }

  // ── HTML ────────────────────────────────────────────────────────────────
  if (ct.includes('html')) {
    return { type: 'html', data: body, raw: body };
  }

  // ── XML / SVG ───────────────────────────────────────────────────────────
  if (ct.includes('xml') || ct.includes('svg')) {
    return { type: 'xml', data: body, raw: body };
  }

  // ── Markdown ────────────────────────────────────────────────────────────
  if (ct.includes('markdown') || ct.includes('x-markdown')) {
    return { type: 'markdown', data: body, raw: body };
  }

  // ── Content sniffing (no / ambiguous content-type) ──────────────────────
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(body);
      return { type: 'json', data, raw: body };
    } catch {
      // not JSON — fall through
    }
  }

  if (trimmed.startsWith('<')) {
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('<!doctype html') || lower.startsWith('<html')) {
      return { type: 'html', data: body, raw: body };
    }
    return { type: 'xml', data: body, raw: body };
  }

  return { type: 'text', data: body, raw: body };
}
