import type { BodyType } from './types';
import { formatBytes as formatSize } from '../../../utils/formatters';

interface Props {
  type: Extract<BodyType, 'image' | 'video' | 'audio' | 'pdf' | 'binary'>;
  data: unknown;         // base64 string for media types; empty for binary
  contentType?: string;
  bodySize?: number;
}

export function ImageViewer({ type, data, contentType, bodySize }: Props) {
  const base64 = typeof data === 'string' && data ? data : null;
  const dataUrl =
    base64 && contentType ? `data:${contentType};base64,${base64}` : undefined;

  if (type === 'image' && dataUrl) {
    return (
      <div style={{ padding: 12 }}>
        <img
          src={dataUrl}
          alt="response"
          style={{ maxWidth: '100%', display: 'block', borderRadius: 4 }}
        />
      </div>
    );
  }

  if (type === 'video' && dataUrl) {
    return (
      <div style={{ padding: 12 }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video controls style={{ maxWidth: '100%', display: 'block' }}>
          <source src={dataUrl} type={contentType} />
        </video>
      </div>
    );
  }

  if (type === 'audio' && dataUrl) {
    return (
      <div style={{ padding: 12 }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls style={{ width: '100%', display: 'block' }}>
          <source src={dataUrl} type={contentType} />
        </audio>
      </div>
    );
  }

  if (type === 'pdf' && dataUrl) {
    return (
      <div
        style={{
          padding: 12,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <embed
          src={dataUrl}
          type="application/pdf"
          style={{ flex: 1, minHeight: 400, width: '100%', border: 'none', borderRadius: 4 }}
        />
      </div>
    );
  }

  // Binary or unrenderable
  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 4, fontSize: 12, opacity: 0.7 }}>
        {contentType || 'Binary'}
        {bodySize != null ? ` · ${formatSize(bodySize)}` : ''}
      </div>
      <div style={{ fontSize: 12, opacity: 0.5 }}>
        Binary content received but could not be rendered.
      </div>
    </div>
  );
}
