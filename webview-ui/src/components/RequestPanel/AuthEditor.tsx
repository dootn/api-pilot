import { useTabStore } from '../../stores/tabStore';
import type { AuthConfig } from '../../stores/requestStore';
import { useI18n } from '../../i18n';

const AUTH_TYPES: { value: AuthConfig['type']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer' },
  { value: 'basic', label: 'Basic' },
  { value: 'apikey', label: 'API Key' },
];

export function AuthEditor() {
  const { activeTabId, tabs, updateTab } = useTabStore();
  const tab = tabs.find((t) => t.id === activeTabId);
  const t = useI18n();
  if (!tab) return null;

  const auth = tab.auth;
  const setAuth = (newAuth: AuthConfig) => updateTab(tab.id, { auth: newAuth });

  const handleTypeChange = (type: AuthConfig['type']) => {
    // Preserve all existing field values — only change the active type
    setAuth({ ...auth, type });
  };

  return (
    <div className="auth-editor">
      {/* Horizontal radio-style type selector */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 8px 4px', flexWrap: 'wrap' }}>
        {AUTH_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleTypeChange(value)}
            style={{
              padding: '3px 10px',
              fontSize: 12,
              border: '1px solid',
              borderRadius: 3,
              cursor: 'pointer',
              borderColor: auth.type === value ? 'var(--button-bg)' : 'var(--border-color)',
              background: auth.type === value ? 'var(--button-bg)' : 'transparent',
              color: auth.type === value ? 'var(--button-fg)' : 'var(--panel-fg)',
              fontWeight: auth.type === value ? 600 : 400,
              opacity: auth.type === value ? 1 : 0.75,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {auth.type === 'none' && (
        <div className="empty-state" style={{ padding: '20px' }}>
          <span style={{ opacity: 0.6 }}>{t('noAuth')}</span>
        </div>
      )}

      {auth.type === 'bearer' && (
        <div className="auth-field">
          <label>{t('authToken')}</label>
          <input
            type="text"
            value={auth.token ?? ''}
            onChange={(e) => setAuth({ ...auth, token: e.target.value })}
            placeholder={t('authTokenPlaceholder')}
            spellCheck={false}
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <>
          <div className="auth-field">
            <label>{t('authUsername')}</label>
            <input
              type="text"
              value={auth.username ?? ''}
              onChange={(e) => setAuth({ ...auth, username: e.target.value })}
              placeholder={t('authUsernamePlaceholder')}
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>{t('authPassword')}</label>
            <input
              type="password"
              value={auth.password ?? ''}
              onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              placeholder={t('authPasswordPlaceholder')}
            />
          </div>
        </>
      )}

      {auth.type === 'apikey' && (
        <>
          <div className="auth-field">
            <label>{t('authKey')}</label>
            <input
              type="text"
              value={auth.key ?? ''}
              onChange={(e) => setAuth({ ...auth, key: e.target.value })}
              placeholder={t('authKeyPlaceholder')}
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>{t('authValue')}</label>
            <input
              type="text"
              value={auth.value ?? ''}
              onChange={(e) => setAuth({ ...auth, value: e.target.value })}
              placeholder={t('authValuePlaceholder')}
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>{t('authAddTo')}</label>
            <select
              className="method-select"
              value={auth.in ?? 'header'}
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
