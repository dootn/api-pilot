import { useMemo, useRef, useEffect } from 'react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import { xml2js } from 'xml-js';
import { JsonView, collapseAllNested } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import type { ViewMode } from './types';
import { SearchHighlightPre } from './SearchHighlightPre';
import { clearHighlights, applyHighlights, navigateToMatch } from './domHighlight';
import { vscodeJsonStyle } from './jsonViewStyle';

hljs.registerLanguage('xml', xml);

const LARGE_XML_THRESHOLD = 200 * 1024; // 200 KB

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

interface Props {
  raw: string;
  mode: ViewMode;
  searchTerm?: string;
  currentMatchIdx?: number;
  onMatchCount?: (count: number) => void;
}

export function XmlViewer({
  raw,
  mode,
  searchTerm = '',
  currentMatchIdx = 0,
  onMatchCount,
}: Props) {
  // Parse XML to a compact JS object for tree view
  const parsedTree = useMemo(() => {
    if (mode !== 'pretty' || !raw) return null;
    try {
      return xml2js(raw, { compact: true, ignoreDeclaration: true, ignoreComment: true });
    } catch {
      return null;
    }
  }, [raw, mode]);

  // Fallback: syntax-highlighted source for when parsing fails
  const highlighted = useMemo(() => {
    if (mode !== 'pretty' || parsedTree !== null || !raw) return null;
    try {
      return hljs.highlight(raw, { language: 'xml' }).value;
    } catch {
      return null;
    }
  }, [raw, mode, parsedTree]);

  const treeRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLPreElement>(null);

  // DOM-level highlight for both tree view and highlighted fallback
  useEffect(() => {
    const el = treeRef.current ?? hlRef.current;
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
  }, [searchTerm, currentMatchIdx, parsedTree, highlighted]);

  const rawHighlight = (
    <SearchHighlightPre
      text={raw}
      term={searchTerm}
      emptyText="(empty)"
      currentMatchIdx={currentMatchIdx}
      onMatchCount={onMatchCount}
    />
  );

  if (mode === 'raw') {
    return rawHighlight;
  }

  // pretty — tree view if parse succeeded
  if (parsedTree !== null) {
    const isLarge = raw.length > LARGE_XML_THRESHOLD;
    return (
      <div
        ref={treeRef}
        style={{
          overflow: 'auto',
          padding: '8px 12px',
          fontFamily: 'var(--vscode-editor-font-family, monospace)',
          fontSize: 'var(--vscode-editor-font-size, 13px)',
        }}
      >
        <JsonView
          data={parsedTree as object}
          shouldExpandNode={isLarge ? collapseAllNested : (level) => level < 3}
          style={vscodeJsonStyle}
        />
      </div>
    );
  }

  // pretty — fallback to highlighted source if parse failed
  if (highlighted) {
    return (
      <pre
        ref={hlRef}
        className="hljs"
        style={preStyle}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  }

  return rawHighlight;
}



