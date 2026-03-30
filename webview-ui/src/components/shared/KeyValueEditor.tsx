import { type KeyValuePair } from '../../stores/requestStore';

interface Props {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({ items, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }: Props) {
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
        <div key={index} className="kv-row">
          <input
            type="checkbox"
            className="kv-checkbox"
            checked={item.enabled}
            onChange={(e) => updateItem(index, 'enabled', e.target.checked)}
          />
          <input
            className="kv-input"
            placeholder={keyPlaceholder}
            value={item.key}
            onChange={(e) => updateItem(index, 'key', e.target.value)}
            spellCheck={false}
          />
          <input
            className="kv-input"
            placeholder={valuePlaceholder}
            value={item.value}
            onChange={(e) => updateItem(index, 'value', e.target.value)}
            spellCheck={false}
          />
          <button
            className="kv-delete-btn"
            onClick={() => removeItem(index)}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
