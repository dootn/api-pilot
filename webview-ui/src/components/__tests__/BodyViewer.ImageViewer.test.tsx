import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImageViewer } from '../../components/ResponsePanel/BodyViewer/ImageViewer';

describe('ImageViewer – image', () => {
  it('renders an <img> when base64 data and contentType are provided', () => {
    const { container } = render(
      <ImageViewer type="image" data="abc123" contentType="image/png" />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,abc123');
  });

  it('falls back to binary message when no data', () => {
    render(<ImageViewer type="image" data="" contentType="image/png" />);
    expect(screen.getByText(/Binary content received/)).toBeTruthy();
  });
});

describe('ImageViewer – video', () => {
  it('renders a <video> element', () => {
    const { container } = render(
      <ImageViewer type="video" data="vidbase64" contentType="video/mp4" />,
    );
    expect(container.querySelector('video')).toBeTruthy();
  });
});

describe('ImageViewer – audio', () => {
  it('renders an <audio> element', () => {
    const { container } = render(
      <ImageViewer type="audio" data="audbase64" contentType="audio/mpeg" />,
    );
    expect(container.querySelector('audio')).toBeTruthy();
  });
});

describe('ImageViewer – pdf', () => {
  it('renders an <embed> element', () => {
    const { container } = render(
      <ImageViewer type="pdf" data="pdfbase64" contentType="application/pdf" />,
    );
    expect(container.querySelector('embed')).toBeTruthy();
  });
});

describe('ImageViewer – binary', () => {
  it('renders a fallback message', () => {
    render(<ImageViewer type="binary" data="" contentType="application/octet-stream" bodySize={1024} />);
    expect(screen.getByText(/Binary content received/)).toBeTruthy();
  });

  it('shows content-type in fallback', () => {
    render(<ImageViewer type="binary" data="" contentType="application/zip" />);
    expect(screen.getByText(/application\/zip/)).toBeTruthy();
  });

  it('shows formatted size when bodySize is provided', () => {
    render(<ImageViewer type="binary" data="" contentType="application/zip" bodySize={2048} />);
    expect(screen.getByText(/2\.0 KB/)).toBeTruthy();
  });
});
