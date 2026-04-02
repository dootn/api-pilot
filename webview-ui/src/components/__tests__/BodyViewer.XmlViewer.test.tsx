import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { XmlViewer } from '../../components/ResponsePanel/BodyViewer/XmlViewer';

describe('XmlViewer – pretty mode (tree view)', () => {
  it('renders a tree view for valid XML', () => {
    const { container } = render(<XmlViewer raw="<root><child/></root>" mode="pretty" />);
    // xml-js parses to an object → JsonView renders a div tree
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('shows fallback <pre> when XML is empty', () => {
    render(<XmlViewer raw="" mode="pretty" />);
    expect(screen.getByText('(empty)')).toBeTruthy();
  });

  it('falls back to highlighted source when XML is unparseable', () => {
    // xml-js will fail on garbage input — should fall back gracefully
    const { container } = render(<XmlViewer raw="not xml at all %%%" mode="pretty" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders tree with nested elements', () => {
    const xml = '<books><book id="1"><title>Foo</title></book></books>';
    const { container } = render(<XmlViewer raw={xml} mode="pretty" />);
    expect(container.querySelector('div')).toBeTruthy();
  });
});

describe('XmlViewer – raw mode', () => {
  it('renders raw XML as plain text in a <pre>', () => {
    render(<XmlViewer raw="<root/>" mode="raw" />);
    expect(screen.getByText('<root/>')).toBeTruthy();
  });

  it('shows placeholder for empty xml in raw mode', () => {
    render(<XmlViewer raw="" mode="raw" />);
    expect(screen.getByText('(empty)')).toBeTruthy();
  });
});
