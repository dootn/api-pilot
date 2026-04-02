import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchHighlightPre } from '../../components/ResponsePanel/BodyViewer/SearchHighlightPre';

describe('SearchHighlightPre', () => {
  it('renders text without marks when term is empty', () => {
    const { container } = render(<SearchHighlightPre text="hello world" term="" />);
    expect(container.querySelector('mark')).toBeNull();
    expect(screen.getByText('hello world')).toBeTruthy();
  });

  it('wraps matching text in <mark>', () => {
    const { container } = render(<SearchHighlightPre text="hello world" term="world" />);
    expect(container.querySelector('mark')?.textContent).toBe('world');
  });

  it('is case-insensitive', () => {
    const { container } = render(<SearchHighlightPre text="Hello World" term="hello" />);
    expect(container.querySelector('mark')?.textContent).toBe('Hello');
  });

  it('highlights multiple occurrences', () => {
    const { container } = render(<SearchHighlightPre text="foo bar foo" term="foo" />);
    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(2);
  });

  it('renders empty text placeholder', () => {
    render(<SearchHighlightPre text="" term="foo" />);
    expect(screen.getByText('(empty response)')).toBeTruthy();
  });

  it('renders custom emptyText', () => {
    render(<SearchHighlightPre text="" term="" emptyText="(empty)" />);
    expect(screen.getByText('(empty)')).toBeTruthy();
  });

  it('handles regex special characters in term safely', () => {
    const { container } = render(<SearchHighlightPre text="1+1=2" term="1+1" />);
    expect(container.querySelector('mark')?.textContent).toBe('1+1');
  });

  it('renders plain text when term has only whitespace', () => {
    const { container } = render(<SearchHighlightPre text="hello" term="   " />);
    expect(container.querySelector('mark')).toBeNull();
  });

  it('calls onMatchCount with the total number of matches', () => {
    const onMatchCount = vi.fn();
    render(<SearchHighlightPre text="foo bar foo baz foo" term="foo" onMatchCount={onMatchCount} />);
    expect(onMatchCount).toHaveBeenCalledWith(3);
  });

  it('calls onMatchCount(0) when term is empty', () => {
    const onMatchCount = vi.fn();
    render(<SearchHighlightPre text="hello" term="" onMatchCount={onMatchCount} />);
    expect(onMatchCount).toHaveBeenCalledWith(0);
  });

  it('applies highlight background to the current match', () => {
    const { container } = render(
      <SearchHighlightPre text="aa bb aa" term="aa" currentMatchIdx={1} />,
    );
    const marks = Array.from(container.querySelectorAll<HTMLElement>('mark'));
    expect(marks[0].style.background).not.toContain('#e57700');
    expect(marks[1].style.background).toContain('#e57700');
  });
});
