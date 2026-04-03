import { useState } from 'react';
import { type KeyValuePair } from '../../stores/requestStore';
import { VarInput } from '../../utils/varHighlight';
import { useI18n } from '../../i18n';
import { parseBulkText, itemsToBulkText, mergeDescriptions } from './bulkEditUtils';

interface Props {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** When provided, {{var}} tokens in key/value cells are highlighted. */
  knownVarNames?: Set<string>;
  /** When provided, tooltip on {{var}} shows resolved value. */
  varValues?: Map<string, string>;
}

export function KeyValueEditor({ items, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value', knownVarNames, varValues }: Props) {
  const t = useI18n();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

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

  const addItem = () => {
    onChange([...items, { key: '', value: '', enabled: true }]);
  };

  const enterBulk = () => {
    setBulkText(itemsToBulkText(items));
    setBulkMode(true);
  };

  const exitBulk = () => {
    const parsed = mergeDescriptions(parseBulkText(bulkText), items);
    onChange(parsed.length > 0
      ? [...parsed, { key: '', value: '', enabled: true }]
      : [{ key: '', value: '', enabled: true }]);
    setBulkMode(false);
  };

  if (bulkMode) {
    return (
      <div className="kv-editor">
        <textarea
          className="body-textarea"
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={t('bulkEditPlaceholder')}
          spellCheck={false}
          style={{ minHeight: 120, fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 12 }}
        />
        <button className="kv-add-btn" onClick={exitBulk}>{t('tableViewBtn')}</button>
      </div>
    );
  }

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
            varValues={varValues}
            spellCheck={false}
          />
          <VarInput
            className="kv-input"
            placeholder={valuePlaceholder}
            value={item.value}
            onChange={(v) => updateItem(index, 'value', v)}
            knownVarNames={knownVarNames}
            varValues={varValues}
            spellCheck={false}
          />
          <VarInput
            className="kv-input kv-input-desc"
            placeholder="Description"
            value={item.description ?? ''}
            onChange={(v) => updateItem(index, 'description', v)}
            spellCheck={false}
          />
          <button
            className="kv-delete-btn"
            onClick={() => removeItem(index)}
            title={t('removeItem')}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="kv-add-btn" onClick={addItem}>{t('addItem')}</button>
        <button className="kv-add-btn" style={{ opacity: 0.65 }} onClick={enterBulk}>{t('bulkEditBtn')}</button>
      </div>
    </div>
  );
}
