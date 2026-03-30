import { useTabStore } from '../../stores/tabStore';
import type { AuthConfig } from '../../stores/requestStore';

export function AuthEditor() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return null;

  const auth = tab.auth;
  const setAuth = (newAuth: AuthConfig) => updateTab(tab.id, { auth: newAuth });

  const handleTypeChange = (type: string) => {
    switch (type) {
      case 'none':
        setAuth({ type: 'none' });
        break;
      case 'bearer':
        setAuth({ type: 'bearer', token: '' });
        break;
      case 'basic':
        setAuth({ type: 'basic', username: '', password: '' });
        break;
      case 'apikey':
        setAuth({ type: 'apikey', key: '', value: '', in: 'header' });
        break;
    }
  };

  return (
    <div className="auth-editor">
      <div className="auth-type-select">
        <select
          className="method-select"
          value={auth.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          style={{ width: '100%' }}
        >
          <option value="none">No Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
        </select>
      </div>

      {auth.type === 'bearer' && (
        <div className="auth-field">
          <label>Token</label>
          <input
            type="text"
            value={auth.token}
            onChange={(e) => setAuth({ ...auth, token: e.target.value })}
            placeholder="Enter bearer token"
            spellCheck={false}
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <>
          <div className="auth-field">
            <label>Username</label>
            <input
              type="text"
              value={auth.username}
              onChange={(e) => setAuth({ ...auth, username: e.target.value })}
              placeholder="Username"
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={auth.password}
              onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              placeholder="Password"
            />
          </div>
        </>
      )}

      {auth.type === 'apikey' && (
        <>
          <div className="auth-field">
            <label>Key</label>
            <input
              type="text"
              value={auth.key}
              onChange={(e) => setAuth({ ...auth, key: e.target.value })}
              placeholder="e.g. X-API-Key"
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>Value</label>
            <input
              type="text"
              value={auth.value}
              onChange={(e) => setAuth({ ...auth, value: e.target.value })}
              placeholder="API key value"
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>Add to</label>
            <select
              className="method-select"
              value={auth.in}
              onChange={(e) => setAuth({ ...auth, in: e.target.value as 'header' | 'query' })}
              style={{ width: '100%' }}
            >
              <option value="header">Header</option>
              <option value="query">Query Params</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}
