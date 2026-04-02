import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ViewMode } from './types';
import { SearchHighlightPre } from './SearchHighlightPre';
import { clearHighlights, applyHighlights, navigateToMatch } from './domHighlight';

interface Props {
  raw: string;
  mode: ViewMode;
  searchTerm?: string;
  currentMatchIdx?: number;
  onMatchCount?: (count: number) => void;
}

export function MarkdownViewer({
  raw,
  mode,
  searchTerm = '',
  currentMatchIdx = 0,
  onMatchCount,
}: Props) {
  const prettyRef = useRef<HTMLDivElement>(null);

  // DOM-level highlight for rendered Markdown in pretty mode
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
  }, [searchTerm, currentMatchIdx, raw]);

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

  // pretty — rendered Markdown (react-markdown strips raw HTML by default — XSS-safe)
  return (
    <div
      ref={prettyRef}
      style={{
        padding: '12px 16px',
        lineHeight: 1.6,
        overflowX: 'auto',
        fontFamily: 'var(--vscode-font-family, sans-serif)',
        fontSize: 'var(--vscode-font-size, 13px)',
      }}
    >
      <ReactMarkdown>{raw}</ReactMarkdown>
    </div>
  );
}

