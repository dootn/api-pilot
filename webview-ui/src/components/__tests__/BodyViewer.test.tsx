import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BodyViewer } from '../../components/ResponsePanel/BodyViewer';

describe('BodyViewer – type auto-detection & rendering', () => {
  it('renders JSON body with Pretty/Raw toolbar', () => {
    render(<BodyViewer body='{"name":"test"}' contentType="application/json" />);
    expect(screen.getByText('Pretty')).toBeTruthy();
    expect(screen.getByText('Raw')).toBeTruthy();
  });

  it('renders HTML body with Pretty/Raw/Preview toolbar', () => {
    render(<BodyViewer body="<p>hello</p>" contentType="text/html" />);
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('renders plain text body', () => {
    render(<BodyViewer body="plain text" contentType="text/plain" />);
    expect(screen.getByText('plain text')).toBeTruthy();
  });

  it('auto-detects JSON with no content-type', () => {
    render(<BodyViewer body='{"auto":true}' />);
    expect(screen.getByText('Pretty')).toBeTruthy();
  });

  it('auto-detects HTML with no content-type', () => {
    render(<BodyViewer body="<!DOCTYPE html><html></html>" />);
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('renders image type (no text toolbar)', () => {
    const { container } = render(
      <BodyViewer body="" contentType="image/png" bodyBase64="abc123" />,
    );
    expect(container.querySelector('img')).toBeTruthy();
  });

  it('handles invalid JSON gracefully (falls back to text)', () => {
    render(<BodyViewer body="{bad json}" contentType="application/json" />);
    expect(screen.getByText('{bad json}')).toBeTruthy();
  });

  it('handles empty body', () => {
    const { container } = render(<BodyViewer body="" contentType="text/plain" />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe('BodyViewer – mode switching', () => {
  it('switches from Pretty to Raw for JSON', () => {
    render(<BodyViewer body='{"a":1}' contentType="application/json" />);
    fireEvent.click(screen.getByText('Raw'));
    expect(screen.queryByText('Raw')).toBeTruthy();
  });

  it('switches to Preview mode for HTML', () => {
    const { container } = render(
      <BodyViewer body="<p>test</p>" contentType="text/html" />,
    );
    fireEvent.click(screen.getByText('Preview'));
    expect(container.querySelector('iframe')).toBeTruthy();
  });

  it('resets mode when content-type changes', () => {
    const { rerender } = render(
      <BodyViewer body="<p>html</p>" contentType="text/html" />,
    );
    expect(screen.getByText('Preview')).toBeTruthy();

    rerender(<BodyViewer body='{"a":1}' contentType="application/json" />);
    expect(screen.getByText('Pretty')).toBeTruthy();
    expect(screen.queryByText('Preview')).toBeNull();
  });
});

describe('BodyViewer – search', () => {
  it('shows the search toggle button for text types', () => {
    render(<BodyViewer body="hello world" contentType="text/plain" />);
    expect(screen.getByTitle('Search')).toBeTruthy();
  });

  it('shows search input after clicking the search toggle', () => {
    render(<BodyViewer body="hello world" contentType="text/plain" />);
    fireEvent.click(screen.getByTitle('Search'));
    expect(screen.getByPlaceholderText('Search…')).toBeTruthy();
  });

  it('highlights matching text in TextViewer after searching', () => {
    const { container } = render(<BodyViewer body="hello world" contentType="text/plain" />);
    fireEvent.click(screen.getByTitle('Search'));
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'world' } });
    expect(container.querySelector('mark')?.textContent).toBe('world');
  });

  it('highlights text in JSON raw mode after searching', () => {
    const { container } = render(
      <BodyViewer body='{"name":"Alice"}' contentType="application/json" />,
    );
    // Switch to Raw first so we're in SearchHighlightPre territory
    fireEvent.click(screen.getByText('Raw'));
    fireEvent.click(screen.getByTitle('Search'));
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'Alice' } });
    expect(container.querySelector('mark')?.textContent).toBe('Alice');
  });

  it('does not show search toggle for binary/image types', () => {
    render(<BodyViewer body="" contentType="image/png" bodyBase64="abc" />);
    expect(screen.queryByTitle('Search')).toBeNull();
  });
});

describe('BodyViewer – security', () => {
  it('HTML Preview uses iframe sandbox="" (no XSS)', () => {
    const { container } = render(
      <BodyViewer body="<script>window.__x=1</script>" contentType="text/html" />,
    );
    fireEvent.click(screen.getByText('Preview'));
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('sandbox')).toBe('');
  });

  it('Markdown does not render <script> tags', () => {
    const { container } = render(
      <BodyViewer body="<script>window.__x=1</script>" contentType="text/markdown" />,
    );
    expect(container.querySelector('script')).toBeNull();
  });
});
