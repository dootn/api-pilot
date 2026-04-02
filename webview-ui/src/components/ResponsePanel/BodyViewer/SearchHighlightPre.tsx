import { useMemo, useEffect, useRef } from 'react';

const STYLE: React.CSSProperties = {
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Props {
  text: string;
  term: string;
  emptyText?: string;
  currentMatchIdx?: number;
  onMatchCount?: (count: number) => void;
}

/**
 * Renders <pre> text with React-level search highlighting.
 * Odd-indexed split parts are the regex captures (= matches).
 * Reports match count via onMatchCount; scrolls current match into view.
 */
export function SearchHighlightPre({
  text,
  term,
  emptyText = '(empty response)',
  currentMatchIdx = 0,
  onMatchCount,
}: Props) {
  const currentRef = useRef<HTMLElement | null>(null);

  const parts = useMemo(() => {
    if (!term.trim() || !text) return null;
    try {
      return text.split(new RegExp(`(${escapeRegex(term)})`, 'gi'));
    } catch {
      return null;
    }
  }, [text, term]);

  const totalMatches = parts ? Math.floor(parts.length / 2) : 0;

  // Report match count to parent whenever it changes
  useEffect(() => {
    onMatchCount?.(totalMatches);
  // onMatchCount is a setState setter — always stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMatches]);

  // Scroll current match into view whenever index changes
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentMatchIdx]);

  if (!text) return <pre style={STYLE}>{emptyText}</pre>;
  if (!parts) return <pre style={STYLE}>{text}</pre>;

  let matchIdx = 0;
  return (
    <pre style={STYLE}>
      {parts.map((part, i) => {
        if (i % 2 !== 1) return part; // non-match segment
        const myIdx = matchIdx++;
        const isCurrent = myIdx === currentMatchIdx;
        return (
          <mark
            key={i}
            ref={isCurrent ? (el) => { currentRef.current = el; } : undefined}
            style={{
              background: isCurrent ? '#e07700' : '#f9d300',
              color: '#1a1a1a',
              borderRadius: 2,
            }}
          >
            {part}
          </mark>
        );
      })}
    </pre>
  );
}

