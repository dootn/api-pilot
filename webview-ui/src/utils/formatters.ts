/** Format a timestamp as HH:MM:SS (24-hour). */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

/** Format an elapsed duration starting from `startMs` (Date.now()-based). */
export function formatDuration(startMs: number): string {
  const secs = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format a millisecond duration as a compact string (e.g. "150ms", "3s", "2m 15s"). */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Format a byte count as a compact string. */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
