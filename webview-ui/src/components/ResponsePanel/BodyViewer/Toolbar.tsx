import { useState, useCallback, useRef, useEffect } from 'react';
import type { BodyType, ViewMode } from './types';

const MODE_LABELS: Record<ViewMode, string> = {
  pretty: 'Pretty',
  raw: 'Raw',
  preview: 'Preview',
};

const TEXT_BASED_TYPES = new Set<BodyType>(['json', 'html', 'xml', 'markdown', 'text']);

interface Props {
  type: BodyType;
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  raw: string;
  availableModes: ViewMode[];
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  matchCount?: number;
  currentMatchIdx?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export function Toolbar({
  type,
  mode,
  setMode,
  raw,
  availableModes,
  searchTerm = '',
  onSearchChange,
  matchCount = 0,
  currentMatchIdx = 0,
  onPrev,
  onNext,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const canCopy = TEXT_BASED_TYPES.has(type);
  const canSearch =
    TEXT_BASED_TYPES.has(type) &&
    onSearchChange !== undefined &&
    (!availableModes.includes('pretty') || mode === 'pretty');

  // Close search panel automatically when mode leaves pretty
  useEffect(() => {
    if (!canSearch) {
      setShowSearch(false);
      onSearchChange?.('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSearch]);

  // Focus the search input when it becomes visible
  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [raw]);

  const handleToggleSearch = useCallback(() => {
    if (showSearch) {
      onSearchChange?.('');
    }
    setShowSearch((v) => !v);
  }, [showSearch, onSearchChange]);

  const modeButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '2px 10px',
    fontSize: 11,
    cursor: 'pointer',
    background: active ? 'var(--badge-bg, rgba(255,255,255,0.12))' : 'transparent',
    color: active ? 'var(--vscode-button-foreground, #ffffff)' : 'var(--panel-fg)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    outline: 'none',
    fontWeight: active ? 600 : 400,
    opacity: active ? 1 : 0.65,
  });

  const iconButtonStyle: React.CSSProperties = {
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--panel-fg)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    outline: 'none',
    opacity: 0.7,
  };

  if (availableModes.length <= 1 && !canCopy && !canSearch) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 12px',
        borderBottom: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        flexShrink: 0,
      }}
    >
      {/* Mode buttons */}
      {availableModes.length > 1 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {availableModes.map((m) => (
            <button key={m} style={modeButtonStyle(mode === m)} onClick={() => setMode(m)}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      )}

      {/* Search input + match count + navigation (inline, expands when open) */}
      {canSearch && showSearch && (
        <>
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange!(e.target.value)}
            placeholder="Search…"
            style={{
              flex: 1,
              minWidth: 120,
              maxWidth: 260,
              padding: '2px 8px',
              fontSize: 11,
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              background: 'var(--input-bg, var(--panel-bg))',
              color: 'var(--panel-fg)',
              outline: 'none',
            }}
          />
          {searchTerm.trim() && (
            <span style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap' }}>
              {matchCount === 0
                ? 'No matches'
                : `${currentMatchIdx + 1} / ${matchCount}`}
            </span>
          )}
          {matchCount > 0 && (
            <>
              <button style={iconButtonStyle} title="Previous match" onClick={onPrev}>↑</button>
              <button style={iconButtonStyle} title="Next match" onClick={onNext}>↓</button>
            </>
          )}
        </>
      )}

      {/* Right-side action buttons */}
      <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
        {canSearch && (
          <button
            style={{
              ...iconButtonStyle,
              opacity: showSearch ? 1 : 0.7,
              background: showSearch ? 'var(--badge-bg, rgba(255,255,255,0.1))' : 'transparent',
            }}
            title={showSearch ? 'Close search' : 'Search'}
            onClick={handleToggleSearch}
          >
            🔍
          </button>
        )}
        {canCopy && (
          <button style={iconButtonStyle} onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

