import type { KeyValuePair } from '../../stores/requestStore';

/**
 * Convert key-value pairs to a bulk-edit text block.
 * Format: "key: value" per line. Disabled items are excluded.
 */
export function itemsToBulkText(items: KeyValuePair[]): string {
  return items
    .filter((item) => item.key || item.value)
    .map((item) => `${item.key}: ${item.value}`)
    .join('\n');
}

/**
 * Parse a bulk-edit text block into key-value pairs.
 * Supports "key: value" and "key=value" separators.
 * Lines starting with "#" or empty lines are skipped.
 */
export function parseBulkText(text: string): KeyValuePair[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      // Find first ":" or "=" to split key/value
      const colonIdx = line.indexOf(':');
      const eqIdx = line.indexOf('=');

      let sepIdx = -1;
      if (colonIdx > 0 && eqIdx > 0) {
        sepIdx = Math.min(colonIdx, eqIdx);
      } else if (colonIdx > 0) {
        sepIdx = colonIdx;
      } else if (eqIdx >= 0) {
        sepIdx = eqIdx;
      }

      if (sepIdx <= 0) {
        return { key: line, value: '', enabled: true };
      }
      const key = line.substring(0, sepIdx).trimEnd();
      const value = line.substring(sepIdx + 1).trimStart();
      return { key, value, enabled: true };
    });
}

/**
 * Merge parsed bulk items back with original items to restore descriptions.
 * For keys that match an existing item, the original description is kept.
 */
export function mergeDescriptions(parsed: KeyValuePair[], original: KeyValuePair[]): KeyValuePair[] {
  const descMap = new Map(
    original.filter((i) => i.key).map((i) => [i.key, i.description]),
  );
  return parsed.map((kv) => ({
    ...kv,
    description: descMap.get(kv.key) ?? kv.description,
  }));
}
