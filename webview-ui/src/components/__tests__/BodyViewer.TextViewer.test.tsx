import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextViewer } from '../../components/ResponsePanel/BodyViewer/TextViewer';

describe('TextViewer', () => {
  it('renders the text content inside a <pre>', () => {
    render(<TextViewer raw="Hello World" />);
    const pre = screen.getByText('Hello World');
    expect(pre.tagName).toBe('PRE');
  });

  it('shows placeholder for empty string', () => {
    render(<TextViewer raw="" />);
    expect(screen.getByText('(empty response)')).toBeTruthy();
  });

  it('renders special characters without escaping issues', () => {
    render(<TextViewer raw={'<tag> & "quoted"'} />);
    expect(screen.getByText('<tag> & "quoted"')).toBeTruthy();
  });

  it('renders multi-line text', () => {
    render(<TextViewer raw={'line1\nline2\nline3'} />);
    expect(screen.getByText(/line1/)).toBeTruthy();
  });

  it('renders large text without crashing', () => {
    const bigText = 'x'.repeat(500_000);
    const { container } = render(<TextViewer raw={bigText} />);
    expect(container.querySelector('pre')).toBeTruthy();
  });

  it('highlights search term with <mark>', () => {
    const { container } = render(<TextViewer raw="hello world" searchTerm="world" />);
    expect(container.querySelector('mark')).toBeTruthy();
    expect(container.querySelector('mark')?.textContent).toBe('world');
  });

  it('highlights are case-insensitive', () => {
    const { container } = render(<TextViewer raw="Hello World" searchTerm="hello" />);
    expect(container.querySelector('mark')?.textContent).toBe('Hello');
  });

  it('shows no marks when searchTerm is empty', () => {
    const { container } = render(<TextViewer raw="hello" searchTerm="" />);
    expect(container.querySelector('mark')).toBeNull();
  });
});
