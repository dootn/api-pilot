import { useState, useCallback } from 'react';
import type { KeyValuePair } from '../../stores/requestStore';
import { parseBulkText, itemsToBulkText, mergeDescriptions } from './bulkEditUtils';

interface UseBulkEditOptions {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  /** Transform items before converting to bulk text (e.g. filter file items). */
  toText?: (items: KeyValuePair[]) => KeyValuePair[];
  /** Custom merge on exit, returns the final items array. */
  fromText?: (parsed: KeyValuePair[], original: KeyValuePair[]) => KeyValuePair[];
}

const DEFAULT_EMPTY: KeyValuePair = { key: '', value: '', enabled: true };

export function useBulkEdit({ items, onChange, toText, fromText }: UseBulkEditOptions) {
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const enterBulk = useCallback(() => {
    const source = toText ? toText(items) : items;
    setBulkText(itemsToBulkText(source));
    setBulkMode(true);
  }, [items, toText]);

  const exitBulk = useCallback(() => {
    const parsed = mergeDescriptions(parseBulkText(bulkText), items);
    let result: KeyValuePair[];
    if (fromText) {
      result = fromText(parsed, items);
    } else {
      result = parsed.length > 0
        ? [...parsed, DEFAULT_EMPTY]
        : [DEFAULT_EMPTY];
    }
    onChange(result);
    setBulkMode(false);
  }, [bulkText, items, onChange, fromText]);

  return { bulkMode, bulkText, setBulkText, enterBulk, exitBulk };
}
