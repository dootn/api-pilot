import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownViewer } from '../../components/ResponsePanel/BodyViewer/MarkdownViewer';

describe('MarkdownViewer – pretty mode', () => {
  it('renders the Markdown container div', () => {
    const { container } = render(<MarkdownViewer raw="# Hello" mode="pretty" />);
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('renders heading text', () => {
    render(<MarkdownViewer raw="# Title" mode="pretty" />);
    expect(screen.getByText('Title')).toBeTruthy();
  });

  it('renders paragraph text', () => {
    render(<MarkdownViewer raw="Hello world" mode="pretty" />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('does not render raw HTML script tags (XSS-safe defaults)', () => {
    const { container } = render(
      <MarkdownViewer raw={'<script>window.__xss=1</script>'} mode="pretty" />,
    );
    expect(container.querySelector('script')).toBeNull();
  });
});

describe('MarkdownViewer – raw mode', () => {
  it('shows markdown source inside a <pre>', () => {
    render(<MarkdownViewer raw="# Hello" mode="raw" />);
    const pre = screen.getByText('# Hello');
    expect(pre.tagName).toBe('PRE');
  });
});
