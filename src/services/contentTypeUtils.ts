const BINARY_TYPES = new Set([
  'application/pdf',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
  'application/gzip',
]);

export function isBinaryContentType(contentType: string): boolean {
  return (
    contentType.startsWith('image/') ||
    contentType.startsWith('video/') ||
    contentType.startsWith('audio/') ||
    BINARY_TYPES.has(contentType)
  );
}
