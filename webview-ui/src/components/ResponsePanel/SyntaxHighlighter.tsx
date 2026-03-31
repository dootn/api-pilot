import { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';  // covers HTML & SVG too

hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);

export type HighlightLang = 'json' | 'xml' | 'text';

/**
 * Detect the best highlight language from response Content-Type and/or body content.
 * Falls back to 'text' when the content is not recognisable.
 */
export function detectHighlightLang(contentType?: string, body?: string): HighlightLang {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml') || ct.includes('html') || ct.includes('svg')) return 'xml';

  // Content sniffing
  const trimmed = (body ?? '').trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<')) return 'xml';

  return 'text';
}

/**
 * Return a short human-readable label for the detected language.
 * Returns null for plain text (no badge needed).
 */
export function langLabel(lang: HighlightLang, contentType?: string): string | null {
  if (lang === 'json') return 'JSON';
  if (lang === 'xml') {
    const ct = (contentType ?? '').toLowerCase();
    if (ct.includes('html')) return 'HTML';
    if (ct.includes('svg')) return 'SVG';
    return 'XML';
  }
  return null;
}

interface Props {
  code: string;
  lang: HighlightLang;
}

export function SyntaxHighlighter({ code, lang }: Props) {
  const highlighted = useMemo(() => {
    if (lang === 'text' || !code) return null;
    try {
      return hljs.highlight(code, { language: lang }).value;
    } catch {
      return null;
    }
  }, [code, lang]);

  const preStyle: React.CSSProperties = {
    margin: 0,
    padding: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: 'transparent',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 'var(--vscode-editor-font-size, 13px)',
    lineHeight: 1.55,
  };

  if (!highlighted) {
    return <pre style={preStyle}>{code || '(empty response)'}</pre>;
  }

  return (
    <pre
      className="hljs"
      style={preStyle}
      // highlight.js escapes all HTML entities — output is XSS-safe
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}
