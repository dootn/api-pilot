import { useState } from 'react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

const TRUNCATE_LEN = 500;

export function TruncatedText({ text }: { text: string }) {
  const needsTruncate = text.length > TRUNCATE_LEN;
  const [expanded, setExpanded] = useState(false);
  const { copied, copy } = useCopyToClipboard(1500);

  const shownText = needsTruncate && !expanded ? text.slice(0, TRUNCATE_LEN) : text;

  return (
    <>
      <span className="conv-content">
        {shownText}
        {needsTruncate && !expanded && (
          <span onClick={() => setExpanded(true)} className="conv-link">…more</span>
        )}
        {needsTruncate && expanded && (
          <span onClick={() => setExpanded(false)} className="conv-link">{' '}collapse</span>
        )}
      </span>
      <button
        onClick={() => copy(text)}
        title="Copy"
        className={`conv-copy-btn${copied ? ' copied' : ''}`}
      >
        {copied ? '✓' : 'copy'}
      </button>
    </>
  );
}
