import { type FormDataField } from '../../stores/requestStore';
import { VarInput } from '../../utils/varHighlight';
import { vscode } from '../../vscode';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { parseBulkText, itemsToBulkText, mergeDescriptions } from './bulkEditUtils';

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

export function FormDataEditor({ 
  items, 
  onChange, 
  requestId,
  keyPlaceholder = 'Key', 
  valuePlaceholder = 'Value', 
  knownVarNames,
  varValues
}: Props) {
  const t = useI18n();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
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

  const enterBulk = () => {
    // Only export text fields to bulk edit
    setBulkText(itemsToBulkText(items.filter((i) => i.type === 'text')));
    setBulkMode(true);
  };

  const exitBulk = () => {
    const fileItems = items.filter((i) => i.type === 'file');
    const textItems = items
      .filter((i) => i.type === 'text')
      .map(({ key, value, enabled, description }) => ({ key, value, enabled, description }));
    const parsed = mergeDescriptions(parseBulkText(bulkText), textItems)
      .map((kv) => ({ ...kv, type: 'text' as const }));
    const merged = [...fileItems, ...parsed];
    onChange(merged.length > 0
      ? [...merged, { key: '', value: '', enabled: true, type: 'text' as const }]
      : [{ key: '', value: '', enabled: true, type: 'text' as const }]);
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
          
          {/* Type selector */}
          <button
            onClick={() => toggleType(index)}
            style={{
              padding: '2px 6px',
              fontSize: 10,
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              cursor: 'pointer',
              background: item.type === 'file' ? 'var(--button-bg)' : 'transparent',
              color: item.type === 'file' ? 'var(--button-fg)' : 'var(--panel-fg)',
              minWidth: 38,
              fontWeight: item.type === 'file' ? 600 : 400,
            }}
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
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              padding: '0 4px',
            }}>
              <button
                onClick={() => selectFile(index)}
                disabled={!item.key}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  cursor: item.key ? 'pointer' : 'not-allowed',
                  background: 'transparent',
                  color: 'var(--panel-fg)',
                  opacity: item.key ? 1 : 0.5,
                }}
              >
                {t('chooseFile')}
              </button>
              {item.fileName && (
                <span style={{ fontSize: 11, color: 'var(--success-fg)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ✓ {item.fileName}
                  <button
                    onClick={() => {
                      const newItems = [...items];
                      newItems[index] = { ...newItems[index], filePath: undefined, fileName: undefined, fileData: undefined };
                      onChange(newItems);
                    }}
                    style={{
                      padding: '0 4px',
                      fontSize: 11,
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                      background: 'transparent',
                      color: 'var(--error-fg)',
                      lineHeight: 1,
                    }}
                    title={t('removeItem')}
                  >
                    ×
                  </button>
                </span>
              )}
              {!item.fileName && item.key && (
                <span style={{ fontSize: 11, opacity: 0.5 }}>
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
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="kv-add-btn" onClick={addItem}>{t('addItem')}</button>
        <button className="kv-add-btn" style={{ opacity: 0.65 }} onClick={enterBulk}>{t('bulkEditBtn')}</button>
      </div>
    </div>
  );
}
