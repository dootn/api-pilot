import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from '../../components/ResponsePanel/BodyViewer/Toolbar';

describe('Toolbar – mode buttons', () => {
  it('renders Pretty and Raw buttons for JSON', () => {
    render(
      <Toolbar
        type="json"
        mode="pretty"
        setMode={vi.fn()}
        raw='{"a":1}'
        availableModes={['pretty', 'raw']}
      />,
    );
    expect(screen.getByText('Pretty')).toBeTruthy();
    expect(screen.getByText('Raw')).toBeTruthy();
  });

  it('renders Pretty, Raw, Preview buttons for HTML', () => {
    render(
      <Toolbar
        type="html"
        mode="pretty"
        setMode={vi.fn()}
        raw="<p/>"
        availableModes={['pretty', 'raw', 'preview']}
      />,
    );
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('calls setMode with the correct value on click', () => {
    const setMode = vi.fn();
    render(
      <Toolbar
        type="json"
        mode="pretty"
        setMode={setMode}
        raw='{"a":1}'
        availableModes={['pretty', 'raw']}
      />,
    );
    fireEvent.click(screen.getByText('Raw'));
    expect(setMode).toHaveBeenCalledWith('raw');
  });

  it('does not render mode buttons when only one mode', () => {
    render(
      <Toolbar
        type="text"
        mode="raw"
        setMode={vi.fn()}
        raw="hello"
        availableModes={[]}
      />,
    );
    expect(screen.queryByText('Pretty')).toBeNull();
    expect(screen.queryByText('Raw')).toBeNull();
  });
});

describe('Toolbar – copy button', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('shows Copy button for text-based types', () => {
    render(
      <Toolbar type="json" mode="pretty" setMode={vi.fn()} raw='{}' availableModes={['pretty', 'raw']} />,
    );
    expect(screen.getByText('Copy')).toBeTruthy();
  });

  it('does not show Copy button for binary types', () => {
    render(
      <Toolbar type="image" mode="raw" setMode={vi.fn()} raw="" availableModes={[]} />,
    );
    expect(screen.queryByText('Copy')).toBeNull();
  });

  it('shows "✓ Copied" feedback after clicking Copy', async () => {
    render(
      <Toolbar type="text" mode="raw" setMode={vi.fn()} raw="hello" availableModes={[]} />,
    );
    fireEvent.click(screen.getByText('Copy'));
    expect(await screen.findByText('✓ Copied')).toBeTruthy();
  });

  it('calls navigator.clipboard.writeText with the raw string', () => {
    render(
      <Toolbar type="text" mode="raw" setMode={vi.fn()} raw="test-value" availableModes={[]} />,
    );
    fireEvent.click(screen.getByText('Copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-value');
  });
});

describe('Toolbar – search', () => {
  it('shows 🔍 button for text-based types when onSearchChange is provided', () => {
    render(
      <Toolbar
        type="json"
        mode="pretty"
        setMode={vi.fn()}
        raw='{"a":1}'
        availableModes={['pretty', 'raw']}
        searchTerm=""
        onSearchChange={vi.fn()}
      />,
    );
    expect(screen.getByTitle('Search')).toBeTruthy();
  });

  it('does not show 🔍 button when onSearchChange is not provided', () => {
    render(
      <Toolbar type="json" mode="pretty" setMode={vi.fn()} raw='{}' availableModes={['pretty', 'raw']} />,
    );
    expect(screen.queryByTitle('Search')).toBeNull();
  });

  it('shows search input after clicking the search toggle', () => {
    render(
      <Toolbar
        type="text"
        mode="raw"
        setMode={vi.fn()}
        raw="hello"
        availableModes={[]}
        searchTerm=""
        onSearchChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Search'));
    expect(screen.getByPlaceholderText('Search…')).toBeTruthy();
  });

  it('calls onSearchChange when typing into the search input', () => {
    const onSearchChange = vi.fn();
    render(
      <Toolbar
        type="text"
        mode="raw"
        setMode={vi.fn()}
        raw="hello"
        availableModes={[]}
        searchTerm=""
        onSearchChange={onSearchChange}
      />,
    );
    fireEvent.click(screen.getByTitle('Search'));
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'he' } });
    expect(onSearchChange).toHaveBeenCalledWith('he');
  });

  it('hides search input and resets term when toggled off', () => {
    const onSearchChange = vi.fn();
    render(
      <Toolbar
        type="text"
        mode="raw"
        setMode={vi.fn()}
        raw="hello"
        availableModes={[]}
        searchTerm="he"
        onSearchChange={onSearchChange}
      />,
    );
    fireEvent.click(screen.getByTitle('Search'));   // open
    fireEvent.click(screen.getByTitle('Close search')); // close
    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(screen.queryByPlaceholderText('Search…')).toBeNull();
  });
});

describe('Toolbar – match count & navigation', () => {
  it('shows "N / M" counter when there are matches', () => {
    render(
      <Toolbar
        type="text"
        mode="raw"
        setMode={vi.fn()}
        raw="hello"
        availableModes={[]}
        searchTerm="l"
        onSearchChange={vi.fn()}
        matchCount={3}
        currentMatchIdx={1}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    // Must show search input first (toggle it)
    fireEvent.click(screen.getByTitle('Search'));
    expect(screen.getByText('2 / 3')).toBeTruthy(); // currentMatchIdx 1 → display 2
  });

  it('shows "No matches" when matchCount is 0', () => {
    render(
      <Toolbar
        type="text"
        mode="raw"
        setMode={vi.fn()}
        raw="hello"
        availableModes={[]}
        searchTerm="xyz"
        onSearchChange={vi.fn()}
        matchCount={0}
        currentMatchIdx={0}
      />,
    );
    fireEvent.click(screen.getByTitle('Search'));
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('renders prev/next buttons when matchCount > 1', () => {
    render(
      <Toolbar
        type="text"
        mode="raw"
        setMode={vi.fn()}
        raw="hello"
        availableModes={[]}
        searchTerm="l"
        onSearchChange={vi.fn()}
        matchCount={3}
        currentMatchIdx={0}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Search'));
    expect(screen.getByTitle('Previous match')).toBeTruthy();
    expect(screen.getByTitle('Next match')).toBeTruthy();
  });

  it('calls onPrev when ↑ is clicked', () => {
    const onPrev = vi.fn();
    render(
      <Toolbar
        type="text"
        mode="raw"
        setMode={vi.fn()}
        raw="hello"
        availableModes={[]}
        searchTerm="l"
        onSearchChange={vi.fn()}
        matchCount={3}
        currentMatchIdx={1}
        onPrev={onPrev}
        onNext={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTitle('Search'));
    fireEvent.click(screen.getByTitle('Previous match'));
    expect(onPrev).toHaveBeenCalled();
  });

  it('calls onNext when ↓ is clicked', () => {
    const onNext = vi.fn();
    render(
      <Toolbar
        type="text"
        mode="raw"
        setMode={vi.fn()}
        raw="hello"
        availableModes={[]}
        searchTerm="l"
        onSearchChange={vi.fn()}
        matchCount={3}
        currentMatchIdx={0}
        onPrev={vi.fn()}
        onNext={onNext}
      />,
    );
    fireEvent.click(screen.getByTitle('Search'));
    fireEvent.click(screen.getByTitle('Next match'));
    expect(onNext).toHaveBeenCalled();
  });
});

describe('Toolbar – hidden when no actions', () => {
  it('returns null for binary type with no available modes', () => {
    const { container } = render(
      <Toolbar type="binary" mode="raw" setMode={vi.fn()} raw="" availableModes={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
