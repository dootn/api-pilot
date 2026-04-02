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
    label: '条件设置变量',
    code: `// Set variable based on condition
const timestamp = new Date().toISOString();
pm.environment.set("requestTime", timestamp);

// Use it in your request as {{requestTime}}`,
  },
  {
    label: '修改请求头',
    code: `// Modify request headers
pm.request.headers["Authorization"] = "Bearer " + pm.environment.get("token");
pm.request.headers["X-Custom-Header"] = "CustomValue";
pm.request.headers["X-Timestamp"] = new Date().getTime();`,
  },
  {
    label: '修改请求参数',
    code: `// Modify query parameters
pm.request.url.addQueryParams([
  { key: "timestamp", value: new Date().getTime() },
  { key: "version", value: "1.0" }
]);`,
  },
  {
    label: '修改请求体',
    code: `// Modify request body
const body = JSON.parse(pm.request.body.raw);
body.timestamp = new Date().getTime();
body.userId = pm.environment.get("userId");
pm.request.body.raw = JSON.stringify(body);`,
  },
  {
    label: '生成动态数据',
    code: `// Generate random data
const randomId = Math.random().toString(36).substring(2, 15);
const randomEmail = "user_" + randomId + "@example.com";

pm.environment.set("randomId", randomId);
pm.environment.set("randomEmail", randomEmail);

// Log for debugging
console.log("Generated ID:", randomId);
console.log("Generated Email:", randomEmail);`,
  },
  {
    label: '控制台调试',
    code: `// Console log for debugging
console.log("Request URL:", pm.request.url);
console.log("Request Method:", pm.request.method);
console.log("Request Headers:", pm.request.headers);
console.log("Environment variable:", pm.environment.get("token"));`,
  },
];

const POST_SCRIPT_EXAMPLES = [
  {
    label: '状态码断言',
    code: `// Assert response status code
pm.test("Status code is 200", function () {
  pm.expect(pm.response.code).to.equal(200);
});

pm.test("Status code is 2xx", function () {
  pm.expect(pm.response.code).to.be.within(200, 299);
});

pm.test("Status code is not 404", function () {
  pm.expect(pm.response.code).to.not.equal(404);
});`,
  },
  {
    label: '响应数据断言',
    code: `// Assert response body
pm.test("Response contains required field", function () {
  const data = pm.response.json();
  pm.expect(data).to.have.property("id");
  pm.expect(data).to.have.property("name");
});

pm.test("Response field has correct type", function () {
  const data = pm.response.json();
  pm.expect(data.id).to.be.a("number");
  pm.expect(data.name).to.be.a("string");
});

pm.test("Response field has correct value", function () {
  const data = pm.response.json();
  pm.expect(data.status).to.equal("active");
  pm.expect(data.age).to.be.above(18);
});`,
  },
  {
    label: '响应头断言',
    code: `// Assert response headers
pm.test("Response has content-type", function () {
  pm.expect(pm.response.headers.get("content-type")).to.include("application/json");
});

pm.test("Response has authorization header", function () {
  pm.expect(pm.response.headers.has("x-auth-token")).to.be.true;
});`,
  },
  {
    label: '解析JSON响应',
    code: `// Parse JSON response and extract data
const jsonData = pm.response.json();
console.log("Full response:", jsonData);
console.log("User ID:", jsonData.id);
console.log("User name:", jsonData.name);

// Extract nested data
const user = jsonData.data.user;
console.log("User email:", user.email);
console.log("User created at:", user.createdAt);`,
  },
  {
    label: '提取数据保存环境',
    code: `// Extract data from response and save to environment
const data = pm.response.json();

// Save simple values
pm.environment.set("userId", data.id);
pm.environment.set("token", data.accessToken);
pm.environment.set("refreshToken", data.refreshToken);

// Save nested values
pm.environment.set("userEmail", data.user.email);
pm.environment.set("userRole", data.user.role);

console.log("Saved userId:", pm.environment.get("userId"));`,
  },
  {
    label: '条件断言',
    code: `// Conditional assertions
pm.test("Check response based on status", function () {
  const data = pm.response.json();
  
  if (data.status === "success") {
    pm.expect(data.data).to.exist;
    pm.expect(data.data.id).to.be.a("number");
  } else if (data.status === "error") {
    pm.expect(data.message).to.exist;
    pm.expect(data.errorCode).to.be.a("number");
  }
});

pm.test("Validate array elements", function () {
  const data = pm.response.json();
  const items = data.items;
  
  pm.expect(items).to.be.an("array");
  items.forEach(item => {
    pm.expect(item).to.have.property("id");
    pm.expect(item.id).to.be.a("number");
  });
});`,
  },
  {
    label: '响应时间断言',
    code: `// Assert response time
pm.test("Response time is less than 1 second", function () {
  pm.expect(pm.response.responseTime).to.be.below(1000);
});

pm.test("Response time is acceptable", function () {
  pm.expect(pm.response.responseTime).to.be.within(100, 2000);
});`,
  },
  {
    label: '数据变换和计算',
    code: `// Transform and calculate response data
const data = pm.response.json();

// Calculate averages
const users = data.users;
const totalAge = users.reduce((sum, user) => sum + user.age, 0);
const averageAge = totalAge / users.length;

pm.environment.set("averageAge", averageAge);
console.log("Average age:", averageAge);

// Filter data
const activeUsers = users.filter(u => u.status === "active");
console.log("Active users count:", activeUsers.length);

// Map to new format
const userNames = users.map(u => u.name).join(", ");
console.log("All user names:", userNames);`,
  },
  {
    label: '循环数据保存',
    code: `// Loop through response array and save values
const data = pm.response.json();

const users = data.users;
users.forEach((user, index) => {
  // Save each user ID with index
  pm.environment.set("userId_" + index, user.id);
  
  if (index === 0) {
    // Save first user as default
    pm.environment.set("defaultUserId", user.id);
  }
});

console.log("Saved " + users.length + " user IDs");`,
  },
  {
    label: '获取响应数据',
    code: `// Parse JSON response
const jsonData = pm.response.json();
console.log("Response:", jsonData);`,
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
