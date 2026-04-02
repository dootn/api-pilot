import { useMemo, useRef, useEffect } from 'react';
import { JsonView, collapseAllNested, allExpanded } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { clearHighlights, applyHighlights, navigateToMatch } from './domHighlight';
import { vscodeJsonStyle } from './jsonViewStyle';

const LARGE_JSON_THRESHOLD = 200 * 1024; // 200 KB

interface Props {
  data: unknown;
  raw: string;
  searchTerm?: string;
  currentMatchIdx?: number;
  onMatchCount?: (count: number) => void;
}

export function JsonViewer({
  data,
  raw,
  searchTerm = '',
  currentMatchIdx = 0,
  onMatchCount,
}: Props) {
  const isLarge = raw.length > LARGE_JSON_THRESHOLD;

  // Expand all nodes when searching so every match is reachable in the DOM
  const isSearching = searchTerm.trim().length > 0;
  const expandNode = useMemo(
    () => {
      if (isSearching) return allExpanded;
      return isLarge ? collapseAllNested : (level: number) => level < 2;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLarge, isSearching],
  );
  // Changing the key forces a remount so shouldExpandNode is re-evaluated for every node
  const viewKey = isSearching ? 'searching' : 'browsing';

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
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
  }, [searchTerm, currentMatchIdx]);

  return (
    <div
      ref={containerRef}
      style={{
        overflow: 'auto',
        padding: '8px 12px',
        fontFamily: 'var(--vscode-editor-font-family, monospace)',
        fontSize: 'var(--vscode-editor-font-size, 13px)',
      }}
    >
      <JsonView
        key={viewKey}
        data={data as object}
        shouldExpandNode={expandNode}
        style={vscodeJsonStyle}
      />
    </div>
  );
}

