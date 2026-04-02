import { useRef, useEffect } from 'react';

/**
 * Tokenize a string and wrap {{varName}} patterns in coloured <mark> spans.
 * - Known variables (exist in the active environment) → teal/success colour
 * - Unknown variables → amber/warning colour
 * Background is kept transparent so the input background shows through.
 *
 * When `varValues` is provided, hovering over a {{var}} mark shows a tooltip
 * with the resolved value.
 */
export function renderVarHighlight(
  text: string,
  knownVars: Set<string>,
  varValues?: Map<string, string>
): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const isKnown = knownVars.has(match[1]);
    const resolvedValue = varValues?.get(match[1].trim());
    const tooltip = isKnown
      ? `${match[1].trim()} = ${resolvedValue ?? ''}`
      : `${match[1].trim()} (undefined)`;
    parts.push(
      <mark
        key={key++}
        title={tooltip}
        style={{
          background: 'transparent',
          color: isKnown
            ? 'var(--success-fg, #4ec9b0)'
            : 'var(--warning-fg, #cca700)',
          fontWeight: 600,
          cursor: 'help',
        }}
      >
        {match[0]}
      </mark>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts}</>;
}

interface VarInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  spellCheck?: boolean;
  knownVarNames?: Set<string>;
  /** When provided, tooltip on {{var}} shows resolved value. Must accompany knownVarNames. */
  varValues?: Map<string, string>;
  /** Padding of the backing highlight div — must match the actual input's padding exactly */
  bgPadding?: string;
  /** Font-size of the backing highlight div — must match the actual input's font-size */
  bgFontSize?: string;
}

/**
 * An input that shows coloured {{var}} highlights via a transparent-text overlay technique.
 *
 * When `knownVarNames` is not provided the component renders a plain <input> with zero overhead.
 * When provided, a backing <div> (same padding/font as the input) renders the highlighted text
 * and the <input> text-color is set to `transparent` so the backing layer shows through.
 * A scroll-event listener keeps the two layers in sync for long values.
 */
export function VarInput({
  value,
  onChange,
  onKeyDown,
  onBlur,
  onFocus,
  className,
  placeholder,
  spellCheck = false,
  knownVarNames,
  varValues,
  bgPadding = '4px 8px',
  bgFontSize = '12px',
}: VarInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  // Sync horizontal scroll offset on each render (covers arrow-key navigation too)
  useEffect(() => {
    const input = inputRef.current;
    const bg = bgRef.current;
    if (!input || !bg) return;
    const onScroll = () => { bg.scrollLeft = input.scrollLeft; };
    input.addEventListener('scroll', onScroll);
    return () => input.removeEventListener('scroll', onScroll);
  });

  // No highlighting requested → plain input, zero overhead
  if (!knownVarNames) {
    return (
      <input
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        spellCheck={spellCheck}
      />
    );
  }

  const hasVars = value.includes('{{');

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {hasVars && (
        <div
          ref={bgRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            padding: bgPadding,
            fontSize: bgFontSize,
            lineHeight: '1.4',
            whiteSpace: 'pre',
            overflow: 'hidden',
            pointerEvents: 'none',
            background: 'var(--input-bg, #3c3c3c)',
            border: '1px solid transparent',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            zIndex: 0,
            color: 'var(--input-fg, #cccccc)',
          }}
        >
          {renderVarHighlight(value, knownVarNames, varValues)}
        </div>
      )}
      <input
        ref={inputRef}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        spellCheck={spellCheck}
        style={{
          width: '100%',
          ...(hasVars
            ? {
                position: 'relative',
                zIndex: 1,
                color: 'transparent',
                caretColor: 'var(--input-fg, #cccccc)',
                background: 'transparent',
              }
            : {}),
        }}
      />
    </div>
  );
}
