import { useMemo } from 'react';
import { type KeyValuePair } from '../../stores/requestStore';
import { AutoComplete } from '../shared/AutoComplete';
import { searchHeaders, getHeaderValues } from '../../data/httpHeaders';

interface Props {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
}

export function HeadersEditor({ items, onChange }: Props) {
  const updateItem = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-add empty row at the end
    const last = newItems[newItems.length - 1];
    if (last && (last.key || last.value)) {
      newItems.push({ key: '', value: '', enabled: true });
    }

    onChange(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  return (
    <div className="kv-editor">
      {items.map((item, index) => (
        <HeaderRow
          key={index}
          item={item}
          onUpdate={(field, value) => updateItem(index, field, value)}
          onRemove={() => removeItem(index)}
          canRemove={items.length > 1}
        />
      ))}
    </div>
  );
}

interface RowProps {
  item: KeyValuePair;
  onUpdate: (field: keyof KeyValuePair, value: string | boolean) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function HeaderRow({ item, onUpdate, onRemove, canRemove }: RowProps) {
  const keySuggestions = useMemo(
    () =>
      searchHeaders(item.key).map((h) => ({
        label: h.name,
        description: h.description,
      })),
    [item.key]
  );

  const valueSuggestions = useMemo(() => {
    if (!item.key) return [];
    return getHeaderValues(item.key).map((v) => ({ label: v }));
  }, [item.key]);

  return (
    <div className="kv-row">
      <input
        type="checkbox"
        className="kv-checkbox"
        checked={item.enabled}
        onChange={(e) => onUpdate('enabled', e.target.checked)}
      />
      <AutoComplete
        value={item.key}
        onChange={(val) => onUpdate('key', val)}
        suggestions={keySuggestions}
        placeholder="Header name"
      />
      <AutoComplete
        value={item.value}
        onChange={(val) => onUpdate('value', val)}
        suggestions={valueSuggestions}
        placeholder="Value"
      />
      <button
        className="kv-delete-btn"
        onClick={onRemove}
        title="Remove"
        disabled={!canRemove}
      >
        ×
      </button>
    </div>
  );
}
