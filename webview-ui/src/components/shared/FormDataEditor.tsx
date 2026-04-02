import { type FormDataField } from '../../stores/requestStore';
import { VarInput } from '../../utils/varHighlight';
import { vscode } from '../../vscode';
import { useEffect } from 'react';
import { useI18n } from '../../i18n';

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

    // Auto-add empty row at the end
    const last = newItems[newItems.length - 1];
    if (last && (last.key || last.value || last.fileName)) {
      newItems.push({ key: '', value: '', enabled: true, type: 'text' });
    }

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
      fieldKey: item.key 
    });
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
                <span style={{ fontSize: 11, color: 'var(--success-fg)' }}>
                  ✓ {item.fileName}
                </span>
              )}
              {!item.fileName && item.key && (
                <span style={{ fontSize: 11, opacity: 0.5 }}>
                  {t('noFileSelected')}
                </span>
              )}
            </div>
          )}
          
          <button
            className="kv-delete-btn"
            onClick={() => removeItem(index)}
            title={t('removeItem')}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
