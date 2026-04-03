import { useMemo, useState } from 'react';
import { type KeyValuePair } from '../../stores/requestStore';
import { AutoComplete } from '../shared/AutoComplete';
import { searchHeaders, getHeaderValues } from '../../data/httpHeaders';
import { useI18n } from '../../i18n';
import { parseBulkText, itemsToBulkText, mergeDescriptions } from '../shared/bulkEditUtils';

interface Props {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  /** When provided, {{var}} tokens in value cells are highlighted. */
  knownVarNames?: Set<string>;
  /** When provided, tooltip on {{var}} shows resolved value. */
  varValues?: Map<string, string>;
}

export function HeadersEditor({ items, onChange, knownVarNames, varValues }: Props) {
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
        <HeaderRow
          key={index}
          item={item}
          onUpdate={(field, value) => updateItem(index, field, value)}
          onRemove={() => removeItem(index)}
          canRemove={items.length > 1}
          knownVarNames={knownVarNames}
          varValues={varValues}
        />
      ))}
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="kv-add-btn" onClick={addItem}>{t('addItem')}</button>
        <button className="kv-add-btn" style={{ opacity: 0.65 }} onClick={enterBulk}>{t('bulkEditBtn')}</button>
      </div>
    </div>
  );
}

interface RowProps {
  item: KeyValuePair;
  onUpdate: (field: keyof KeyValuePair, value: string | boolean) => void;
  onRemove: () => void;
  canRemove: boolean;
  knownVarNames?: Set<string>;
  varValues?: Map<string, string>;
}

function HeaderRow({ item, onUpdate, onRemove, canRemove, knownVarNames, varValues }: RowProps) {
  const t = useI18n();
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
        knownVarNames={knownVarNames}
        varValues={varValues}
      />
      <input
        className="kv-input kv-input-desc"
        placeholder="Description"
        value={item.description ?? ''}
        onChange={(e) => onUpdate('description', e.target.value)}
        spellCheck={false}
      />
      <button
        className="kv-delete-btn"
        onClick={onRemove}
        title={t('removeItem')}
        disabled={!canRemove}
      >
        ×
      </button>
    </div>
  );
}
