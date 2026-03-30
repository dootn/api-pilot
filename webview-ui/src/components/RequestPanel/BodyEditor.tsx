import { useTabStore } from '../../stores/tabStore';
import type { RequestBody, KeyValuePair } from '../../stores/requestStore';
import { KeyValueEditor } from '../shared/KeyValueEditor';

export function BodyEditor() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return null;

  const body = tab.body;
  const setBody = (newBody: RequestBody) => updateTab(tab.id, { body: newBody });

  const handleTypeChange = (type: RequestBody['type']) => {
    const newBody: RequestBody = { type };
    switch (type) {
      case 'json':
        newBody.raw = body.raw || '{\n  \n}';
        break;
      case 'raw':
        newBody.raw = body.raw || '';
        break;
      case 'x-www-form-urlencoded':
        newBody.urlEncoded = body.urlEncoded || [{ key: '', value: '', enabled: true }];
        break;
      case 'form-data':
        newBody.formData = body.formData || [{ key: '', value: '', enabled: true }];
        break;
    }
    setBody(newBody);
  };

  return (
    <div>
      <div className="body-type-select">
        <select
          className="method-select"
          value={body.type}
          onChange={(e) => handleTypeChange(e.target.value as RequestBody['type'])}
          style={{ width: '100%' }}
        >
          <option value="none">none</option>
          <option value="json">JSON</option>
          <option value="form-data">form-data</option>
          <option value="x-www-form-urlencoded">x-www-form-urlencoded</option>
          <option value="raw">raw</option>
        </select>
      </div>

      {body.type === 'none' && (
        <div className="empty-state" style={{ padding: '20px' }}>
          <span style={{ opacity: 0.6 }}>This request does not have a body</span>
        </div>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <textarea
          className="body-textarea"
          value={body.raw || ''}
          onChange={(e) => setBody({ ...body, raw: e.target.value })}
          placeholder={body.type === 'json' ? '{\n  "key": "value"\n}' : 'Enter raw body'}
          spellCheck={false}
        />
      )}

      {body.type === 'x-www-form-urlencoded' && (
        <KeyValueEditor
          items={body.urlEncoded || [{ key: '', value: '', enabled: true }]}
          onChange={(items) => setBody({ ...body, urlEncoded: items })}
        />
      )}

      {body.type === 'form-data' && (
        <KeyValueEditor
          items={body.formData || [{ key: '', value: '', enabled: true }]}
          onChange={(items) => setBody({ ...body, formData: items })}
        />
      )}
    </div>
  );
}
