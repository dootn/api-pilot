import { useState, useRef } from 'react';
import { useTabStore } from '../../stores/tabStore';
import { useI18n } from '../../i18n';

const PRE_SCRIPT_EXAMPLES = [
  {
    label: '设置环境变量',
    code: `// Set environment variable
pm.environment.set("variableName", "value");`,
  },
  {
    label: '控制台输出',
    code: `// Console log
console.log("Debug message:", pm.request.url);`,
  },
  {
    label: '修改请求参数',
    code: `// Modify request
pm.request.headers["X-Custom-Header"] = "value";`,
  },
];

const POST_SCRIPT_EXAMPLES = [
  {
    label: '获取响应数据',
    code: `// Parse JSON response
const jsonData = pm.response.json();
console.log("Response:", jsonData);`,
  },
  {
    label: '断言测试',
    code: `// Test assertions
pm.test("Status code is 200", function () {
  pm.expect(pm.response.code).to.equal(200);
});

pm.test("Response has data", function () {
  const data = pm.response.json();
  pm.expect(data).to.have.property("id");
});`,
  },
  {
    label: '设置环境变量',
    code: `// Save response data to environment
const jsonData = pm.response.json();
pm.environment.set("token", jsonData.token);`,
  },
  {
    label: '发送额外请求',
    code: `// Send additional request
pm.sendRequest({
  url: "https://api.example.com/endpoint",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: "value" })
}, function (err, response) {
  if (err) {
    console.error(err);
  } else {
    console.log("Response:", response.json());
  }
});`,
  },
  {
    label: '控制台输出',
    code: `// Console log
console.log("Status:", pm.response.code);
console.log("Body:", pm.response.text());`,
  },
];

export function ScriptEditor() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const t = useI18n();
  const tab = tabs.find((tb) => tb.id === activeTabId);
  const [showPreExamples, setShowPreExamples] = useState(false);
  const [showPostExamples, setShowPostExamples] = useState(false);
  const preExamplesRef = useRef<HTMLDivElement>(null);
  const postExamplesRef = useRef<HTMLDivElement>(null);
  const preTextareaRef = useRef<HTMLTextAreaElement>(null);
  const postTextareaRef = useRef<HTMLTextAreaElement>(null);

  if (!tab) return null;

  const insertExample = (code: string, isPreScript: boolean) => {
    const textarea = isPreScript ? preTextareaRef.current : postTextareaRef.current;
    if (!textarea) return;

    const currentValue = isPreScript ? (tab.preScript || '') : (tab.postScript || '');
    const cursorPos = textarea.selectionStart || currentValue.length;
    
    // Insert at cursor position
    const newValue = 
      currentValue.substring(0, cursorPos) +
      (currentValue && !currentValue.endsWith('\n') && cursorPos === currentValue.length ? '\n\n' : '') +
      code +
      '\n' +
      currentValue.substring(cursorPos);

    updateTab(tab.id, isPreScript ? { preScript: newValue } : { postScript: newValue });
    
    // Close dropdown
    if (isPreScript) setShowPreExamples(false);
    else setShowPostExamples(false);

    // Focus textarea
    setTimeout(() => textarea.focus(), 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 12px', overflowY: 'auto' }}>
      {/* Pre-request script */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{t('preScriptLabel')}</span>
            {tab.preScript?.trim() && (
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: 'var(--badge-bg)', color: 'var(--badge-fg)' }}>●</span>
            )}
          </div>
          <div style={{ position: 'relative' }} ref={preExamplesRef}>
            <button
              className="save-btn"
              onClick={() => setShowPreExamples(!showPreExamples)}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              📝 插入示例
            </button>
            {showPreExamples && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  zIndex: 1000,
                  background: 'var(--vscode-menu-background, #252526)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  minWidth: 200,
                  maxWidth: 300,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {PRE_SCRIPT_EXAMPLES.map((example, idx) => (
                  <div
                    key={idx}
                    onClick={() => insertExample(example.code, true)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      borderBottom: idx < PRE_SCRIPT_EXAMPLES.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {example.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 6 }}>{t('preScriptHelp')}</div>
        <textarea
          ref={preTextareaRef}
          className="body-textarea"
          value={tab.preScript || ''}
          onChange={(e) => updateTab(tab.id, { preScript: e.target.value })}
          placeholder={t('preScriptPlaceholder')}
          spellCheck={false}
          style={{ minHeight: 110, fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 12 }}
          onClick={() => setShowPreExamples(false)}
        />
        {tab.preScript?.trim() && (
          <button
            className="save-btn"
            onClick={() => updateTab(tab.id, { preScript: '' })}
            style={{ marginTop: 4, fontSize: 11, padding: '2px 8px', opacity: 0.6 }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)' }} />

      {/* Post-response script */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{t('postScriptLabel')}</span>
            {tab.postScript?.trim() && (
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: 'var(--badge-bg)', color: 'var(--badge-fg)' }}>●</span>
            )}
          </div>
          <div style={{ position: 'relative' }} ref={postExamplesRef}>
            <button
              className="save-btn"
              onClick={() => setShowPostExamples(!showPostExamples)}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              📝 插入示例
            </button>
            {showPostExamples && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  zIndex: 1000,
                  background: 'var(--vscode-menu-background, #252526)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  minWidth: 200,
                  maxWidth: 300,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {POST_SCRIPT_EXAMPLES.map((example, idx) => (
                  <div
                    key={idx}
                    onClick={() => insertExample(example.code, false)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      borderBottom: idx < POST_SCRIPT_EXAMPLES.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {example.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 6 }}>{t('postScriptHelp')}</div>
        <textarea
          ref={postTextareaRef}
          className="body-textarea"
          value={tab.postScript || ''}
          onChange={(e) => updateTab(tab.id, { postScript: e.target.value })}
          placeholder={t('postScriptPlaceholder')}
          spellCheck={false}
          style={{ minHeight: 110, fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 12 }}
          onClick={() => setShowPostExamples(false)}
        />
        {tab.postScript?.trim() && (
          <button
            className="save-btn"
            onClick={() => updateTab(tab.id, { postScript: '' })}
            style={{ marginTop: 4, fontSize: 11, padding: '2px 8px', opacity: 0.6 }}
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
}
