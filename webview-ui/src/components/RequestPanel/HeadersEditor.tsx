import { useMemo, memo } from 'react';
import { type KeyValuePair } from '../../stores/requestStore';
import { AutoComplete } from '../shared/AutoComplete';
import { searchHeaders, getHeaderValues } from '../../data/httpHeaders';
import { useI18n } from '../../i18n';
import { Textarea, Button, Input, Checkbox } from '../shared/ui';
import { useBulkEdit } from '../shared/useBulkEdit';

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
      <div className="flex-row gap-4">
        <Button variant="secondary" btnSize="sm" onClick={addItem}>{t('addItem')}</Button>
        <Button variant="ghost" btnSize="sm" onClick={enterBulk}>{t('bulkEditBtn')}</Button>
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

const HeaderRow = memo(function HeaderRow({ item, onUpdate, onRemove, canRemove, knownVarNames, varValues }: RowProps) {
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
      <Checkbox
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
      <Input
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
});
