import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HtmlViewer } from '../../components/ResponsePanel/BodyViewer/HtmlViewer';

describe('HtmlViewer – preview mode', () => {
  it('renders an iframe element', () => {
    const { container } = render(<HtmlViewer raw="<p>hello</p>" mode="preview" />);
    expect(container.querySelector('iframe')).toBeTruthy();
  });

  it('iframe has sandbox="" (most restrictive)', () => {
    const { container } = render(<HtmlViewer raw="<p>hello</p>" mode="preview" />);
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('');
  });

  it('sets srcDoc to the raw HTML', () => {
    const { container } = render(<HtmlViewer raw="<b>bold</b>" mode="preview" />);
    expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toBe('<b>bold</b>');
  });

  it('does NOT execute scripts — sandbox prevents it (structural test)', () => {
    const { container } = render(
      <HtmlViewer raw="<script>window.__xss=1</script>" mode="preview" />,
    );
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('sandbox')).toBe('');
  });
});

describe('HtmlViewer – raw mode', () => {
  it('renders a <pre> with the raw text', () => {
    render(<HtmlViewer raw="<p>hello</p>" mode="raw" />);
    const pre = screen.getByText('<p>hello</p>');
    expect(pre.tagName).toBe('PRE');
  });

  it('shows placeholder for empty content', () => {
    render(<HtmlViewer raw="" mode="raw" />);
    expect(screen.getByText('(empty)')).toBeTruthy();
  });
});

describe('HtmlViewer – pretty mode', () => {
  it('renders a <pre> element', () => {
    const { container } = render(<HtmlViewer raw="<div>test</div>" mode="pretty" />);
    expect(container.querySelector('pre')).toBeTruthy();
  });

  it('shows placeholder for empty content in pretty mode', () => {
    render(<HtmlViewer raw="" mode="pretty" />);
    expect(screen.getByText('(empty)')).toBeTruthy();
  });
});
