import { type FormDataField } from '../../stores/requestStore';
import { VarInput } from '../../utils/varHighlight';
import { vscode } from '../../vscode';
import { memo, useCallback, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { Textarea, Button, Checkbox } from './ui';
import { useBulkEdit } from './useBulkEdit';

interface Props {
  items: FormDataField[];
  onChange: (items: FormDataField[]) => void;
  requestId: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** When provided, {{var}} tokens in key/value cells are highlighted. */
  knownVarNames?: Set<string>;
  /** When provided, tooltip on {{var}} shows resolved value. */
  varValues?: Map<string, string>;
}

export const FormDataEditor = memo(function FormDataEditor({ 
  items, 
  onChange, 
  requestId,
  keyPlaceholder = 'Key', 
  valuePlaceholder = 'Value', 
  knownVarNames,
  varValues
}: Props) {
  const t = useI18n();
  const toText = useCallback((items: FormDataField[]) => items.filter((i) => i.type === 'text'), []);
  const fromText = useCallback((parsed: FormDataField[], original: FormDataField[]) => {
    const fileItems = original.filter((i) => i.type === 'file');
    const merged = [...fileItems, ...parsed.map((kv) => ({ ...kv, type: 'text' as const }))];
    return merged.length > 0
      ? [...merged, { key: '', value: '', enabled: true, type: 'text' as const }]
      : [{ key: '', value: '', enabled: true, type: 'text' as const }];
  }, []);
  const { bulkMode, bulkText, setBulkText, enterBulk, exitBulk } = useBulkEdit({
    items: items as any,
    onChange: onChange as any,
    toText: toText as any,
    fromText: fromText as any,
  });
  
  // Listen for file picked messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'formDataFilePicked' && msg.requestId === requestId) {
        const { fieldKey, path, name } = msg.payload as { fieldKey: string; path: string; name: string };
        const newItems = items.map(item => 
          item.key === fieldKey && item.type === 'file'
            ? { ...item, filePath: path, fileName: name }
            : item
        );
        onChange(newItems);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [items, onChange, requestId]);

  const updateItem = (index: number, field: keyof FormDataField, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const toggleType = (index: number) => {
    const newItems = [...items];
    const currentType = newItems[index].type;
    newItems[index] = {
      ...newItems[index],
      type: currentType === 'text' ? 'file' : 'text',
      // Clear file-related fields when switching to text
      ...(currentType === 'file' ? { filePath: undefined, fileName: undefined, fileData: undefined } : {}),
    };
    onChange(newItems);
  };

  const selectFile = (index: number) => {
    const item = items[index];
    if (!item.key) {
      // Show warning if key is empty
      return;
    }
    vscode.postMessage({ 
      type: 'selectFormDataFile', 
      requestId,
      payload: { fieldKey: item.key },
    });
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const addItem = () => {
    onChange([...items, { key: '', value: '', enabled: true, type: 'text' as const }]);
  };

  if (bulkMode) {
    return (
      <div className="kv-editor">
        <Textarea
          code
          fullWidth
          className="fd-bulk-textarea"
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={t('bulkEditPlaceholder')}
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
          
          {/* Type selector */}
          <button
            onClick={() => toggleType(index)}
            className={`fd-type-toggle ${item.type === 'file' ? 'fd-type-toggle-file' : 'fd-type-toggle-text'}`}
            title={t('formDataToggleType')}
          >
            {item.type === 'file' ? '📎' : 'T'}
          </button>

          <VarInput
            className="kv-input"
            placeholder={keyPlaceholder}
            value={item.key}
            onChange={(v) => updateItem(index, 'key', v)}
            knownVarNames={knownVarNames}
            varValues={varValues}
            spellCheck={false}
          />
          
          {item.type === 'text' ? (
            <VarInput
              className="kv-input"
              placeholder={valuePlaceholder}
              value={item.value}
              onChange={(v) => updateItem(index, 'value', v)}
              knownVarNames={knownVarNames}
              varValues={varValues}
              spellCheck={false}
            />
          ) : (
            <div className="fd-file-section">
              <button
                onClick={() => selectFile(index)}
                disabled={!item.key}
                className="fd-choose-file-btn"
              >
                {t('chooseFile')}
              </button>
              {item.fileName && (
                <span className="fd-file-name">
                  ✓ {item.fileName}
                  <button
                    onClick={() => {
                      const newItems = [...items];
                      newItems[index] = { ...newItems[index], filePath: undefined, fileName: undefined, fileData: undefined };
                      onChange(newItems);
                    }}
                    className="fd-remove-file-btn"
                    title={t('removeItem')}
                  >
                    ×
                  </button>
                </span>
              )}
              {!item.fileName && item.key && (
                <span className="fd-no-file">
                  {t('noFileSelected')}
                </span>
              )}
            </div>
          )}

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
      <div className="fd-bottom-actions">
        <Button variant="secondary" btnSize="sm" onClick={addItem}>{t('addItem')}</Button>
        <Button variant="ghost" btnSize="sm" onClick={enterBulk}>{t('bulkEditBtn')}</Button>
      </div>
    </div>
  );
});
