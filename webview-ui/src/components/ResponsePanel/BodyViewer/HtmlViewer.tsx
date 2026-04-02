import { useMemo, useRef, useEffect } from 'react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import type { ViewMode } from './types';
import { SearchHighlightPre } from './SearchHighlightPre';
import { clearHighlights, applyHighlights, navigateToMatch } from './domHighlight';

hljs.registerLanguage('xml', xml);

interface Props {
  raw: string;
  mode: ViewMode;
  searchTerm?: string;
  currentMatchIdx?: number;
  onMatchCount?: (count: number) => void;
}

export function HtmlViewer({
  raw,
  mode,
  searchTerm = '',
  currentMatchIdx = 0,
  onMatchCount,
}: Props) {
  // Always call hooks unconditionally (rules of hooks)
  const highlighted = useMemo(() => {
    if (!raw || mode !== 'pretty') return null;
    try {
      return hljs.highlight(raw, { language: 'xml' }).value;
    } catch {
      return null;
    }
  }, [raw, mode]);

  const prettyRef = useRef<HTMLPreElement>(null);

  // DOM-level highlight for the hljs-rendered source in pretty mode
  useEffect(() => {
    const el = prettyRef.current;
    if (!el) return;
    clearHighlights(el);
    if (searchTerm.trim()) {
      const count = applyHighlights(el, searchTerm);
      onMatchCount?.(count);
      if (count > 0) navigateToMatch(el, currentMatchIdx);
    } else {
      onMatchCount?.(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, currentMatchIdx, highlighted]);

  // Iframe sandbox="" denies ALL permissions — no script execution, no forms, no same-origin access.
  if (mode === 'preview') {
    return (
      <iframe
        sandbox=""
        srcDoc={raw}
        style={{ width: '100%', minHeight: 400, border: 'none', display: 'block' }}
        title="HTML Preview"
      />
    );
  }

  const preStyle: React.CSSProperties = {
    margin: 0,
    padding: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: 'transparent',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 'var(--vscode-editor-font-size, 13px)',
    lineHeight: 1.55,
    overflowX: 'auto',
  };

  if (mode === 'raw') {
    return (
      <SearchHighlightPre
        text={raw}
        term={searchTerm}
        emptyText="(empty)"
        currentMatchIdx={currentMatchIdx}
        onMatchCount={onMatchCount}
      />
    );
  }

  // pretty — syntax highlighted source with DOM-level search highlight
  if (!highlighted) {
    return (
      <SearchHighlightPre
        text={raw}
        term={searchTerm}
        emptyText="(empty)"
        currentMatchIdx={currentMatchIdx}
        onMatchCount={onMatchCount}
      />
    );
  }

  return (
    <pre
      ref={prettyRef}
      className="hljs"
      style={preStyle}
      // highlight.js escapes all HTML entities — output is XSS-safe
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

