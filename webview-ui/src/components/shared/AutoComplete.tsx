import { useState, useRef, useEffect, useCallback } from 'react';

interface AutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: { label: string; description?: string }[];
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
}

export function AutoComplete({
  value,
  onChange,
  suggestions,
  placeholder,
  className = '',
  onFocus,
}: AutoCompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[activeIndex]) {
        (items[activeIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          setIsOpen(true);
          setActiveIndex(0);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case 'Tab':
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            e.preventDefault();
            onChange(suggestions[activeIndex].label);
            setIsOpen(false);
            setActiveIndex(-1);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, activeIndex, suggestions, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleSelect = (label: string) => {
    onChange(label);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className="autocomplete-container"
      style={{ position: 'relative', flex: 1 }}
    >
      <input
        ref={inputRef}
        className={`kv-input ${className}`}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
          onFocus?.();
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />

      {isOpen && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="autocomplete-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: 200,
            overflowY: 'auto',
            background: 'var(--vscode-editorSuggestWidget-background, var(--input-bg))',
            border: '1px solid var(--vscode-editorSuggestWidget-border, var(--border-color))',
            borderRadius: 3,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}
        >
          {suggestions.map((item, index) => (
            <div
              key={item.label}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item.label);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              style={{
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
                background:
                  index === activeIndex
                    ? 'var(--vscode-editorSuggestWidget-selectedBackground, rgba(255,255,255,0.1))'
                    : 'transparent',
                color:
                  index === activeIndex
                    ? 'var(--vscode-editorSuggestWidget-selectedForeground, var(--panel-fg))'
                    : 'var(--panel-fg)',
              }}
            >
              <span style={{ fontWeight: 500 }}>{item.label}</span>
              {item.description && (
                <span
                  style={{
                    fontSize: 11,
                    opacity: 0.6,
                    marginLeft: 8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '50%',
                  }}
                >
                  {item.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
