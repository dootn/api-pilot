import { memo } from 'react';
import { type KeyValuePair } from '../../stores/requestStore';
import { VarInput } from '../../utils/varHighlight';
import { useI18n } from '../../i18n';
import { Textarea, Button, Checkbox } from './ui';
import { useBulkEdit } from './useBulkEdit';

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

export const KeyValueEditor = memo(function KeyValueEditor({ items, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value', knownVarNames, varValues }: Props) {
  const t = useI18n();
  const { bulkMode, bulkText, setBulkText, enterBulk, exitBulk } = useBulkEdit({ items, onChange });

  const updateItem = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
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

  if (bulkMode) {
    return (
      <div className="kv-editor">
        <Textarea
          code
          fullWidth
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={t('bulkEditPlaceholder')}
          style={{ minHeight: 120 }}
        />
        <Button variant="secondary" btnSize="sm" onClick={exitBulk}>{t('tableViewBtn')}</Button>
      </div>
    );
  }

  return (
    <div className="kv-editor">
      {items.map((item, index) => (
        <div key={index} className="kv-row">
          <Checkbox
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
      <div className="flex-row gap-4">
        <Button variant="secondary" btnSize="sm" onClick={addItem}>{t('addItem')}</Button>
        <Button variant="ghost" btnSize="sm" onClick={enterBulk}>{t('bulkEditBtn')}</Button>
      </div>
    </div>
  );
});
