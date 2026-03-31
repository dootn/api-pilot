import { type KeyValuePair } from '../../stores/requestStore';
import { VarInput } from '../../utils/varHighlight';

interface Props {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** When provided, {{var}} tokens in key/value cells are highlighted. */
  knownVarNames?: Set<string>;
}

export function KeyValueEditor({ items, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value', knownVarNames }: Props) {
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
          <VarInput
            className="kv-input"
            placeholder={keyPlaceholder}
            value={item.key}
            onChange={(v) => updateItem(index, 'key', v)}
            knownVarNames={knownVarNames}
            spellCheck={false}
          />
          <VarInput
            className="kv-input"
            placeholder={valuePlaceholder}
            value={item.value}
            onChange={(v) => updateItem(index, 'value', v)}
            knownVarNames={knownVarNames}
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
