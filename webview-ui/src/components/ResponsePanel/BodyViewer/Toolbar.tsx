import { useState, useCallback, useRef, useEffect } from 'react';
import type { BodyType, ViewMode } from './types';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { ToggleGroup, Button, Input } from '../../shared/ui';

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
  const { copied, copy } = useCopyToClipboard();
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
      copy(raw);
    } catch {
      // Clipboard API not available
    }
  }, [raw, copy]);

  const handleToggleSearch = useCallback(() => {
    if (showSearch) {
      onSearchChange?.('');
    }
    setShowSearch((v) => !v);
  }, [showSearch, onSearchChange]);

  const modeOptions = availableModes.map((m) => ({ value: m, label: MODE_LABELS[m] }));

  if (availableModes.length <= 1 && !canCopy && !canSearch) return null;

  return (
    <div
      className="border-b"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 12px',
        flexWrap: 'wrap',
        flexShrink: 0,
      }}
    >
      {/* Mode buttons */}
      {availableModes.length > 1 && (
        <ToggleGroup options={modeOptions} value={mode} onChange={setMode} />
      )}

      {/* Search input + match count + navigation (inline, expands when open) */}
      {canSearch && showSearch && (
        <>
          <Input
            ref={searchInputRef}
            inputSize="sm"
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange!(e.target.value)}
            placeholder="Search…"
            style={{ flex: 1, minWidth: 120, maxWidth: 260 }}
          />
          {searchTerm.trim() && (
            <span className="text-secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              {matchCount === 0
                ? 'No matches'
                : `${currentMatchIdx + 1} / ${matchCount}`}
            </span>
          )}
          {matchCount > 0 && (
            <>
              <Button variant="ghost" btnSize="sm" title="Previous match" onClick={onPrev}>↑</Button>
              <Button variant="ghost" btnSize="sm" title="Next match" onClick={onNext}>↓</Button>
            </>
          )}
        </>
      )}

      {/* Right-side action buttons */}
      <div className="flex-row ml-auto gap-4">
        {canSearch && (
          <Button
            variant="ghost"
            style={showSearch ? { opacity: 1, background: 'var(--badge-bg, rgba(255,255,255,0.1))' } : {}}
            title={showSearch ? 'Close search' : 'Search'}
            onClick={handleToggleSearch}
          >
            🔍
          </Button>
        )}
        {canCopy && (
          <Button variant="ghost" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </Button>
        )}
      </div>
    </div>
  );
}

