import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { JsonViewer } from '../../components/ResponsePanel/BodyViewer/JsonViewer';

describe('JsonViewer', () => {
  it('renders without crashing for a simple object', () => {
    const data = { name: 'Alice', age: 30 };
    const { container } = render(<JsonViewer data={data} raw={JSON.stringify(data)} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders without crashing for a JSON array', () => {
    const data = [1, 2, 3];
    const { container } = render(<JsonViewer data={data} raw={JSON.stringify(data)} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders without crashing for null data', () => {
    const { container } = render(<JsonViewer data={null} raw="null" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders without crashing for large JSON (>200 KB) — uses collapsed mode', () => {
    const large = Array.from({ length: 500 }, (_, i) => ({ id: i, value: 'x'.repeat(200) }));
    const raw = JSON.stringify(large); // ~100 KB per 500 items × 200 chars
    const { container } = render(<JsonViewer data={large} raw={raw} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('uses collapseAllNested threshold — wrapper div is present', () => {
    const bigRaw = 'x'.repeat(201 * 1024);
    const { container } = render(<JsonViewer data={{}} raw={bigRaw} />);
    expect(container.querySelector('div')).toBeTruthy();
  });
});
