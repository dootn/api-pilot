import { useTabStore, useActiveTab } from '../../stores/tabStore';
import type { AuthConfig } from '../../stores/requestStore';
import { useI18n } from '../../i18n';
import { Select, ToggleGroup, Input, Option } from '../shared/ui';
import { EmptyState } from '../shared/EmptyState';

const AUTH_OPTIONS: { value: AuthConfig['type']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer' },
  { value: 'basic', label: 'Basic' },
  { value: 'apikey', label: 'API Key' },
];

export function AuthEditor() {
  const updateTab = useTabStore((s) => s.updateTab);
  const tab = useActiveTab();
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
      <div style={{ padding: '6px 8px 4px' }}>
        <ToggleGroup
          options={AUTH_OPTIONS}
          value={auth.type}
          onChange={handleTypeChange}
        />
      </div>

      {auth.type === 'none' && (
        <EmptyState padding={20}>{t('noAuth')}</EmptyState>
      )}

      {auth.type === 'bearer' && (
        <div className="auth-field">
          <label>{t('authToken')}</label>
          <Input
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
            <Input
              type="text"
              value={auth.username ?? ''}
              onChange={(e) => setAuth({ ...auth, username: e.target.value })}
              placeholder={t('authUsernamePlaceholder')}
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>{t('authPassword')}</label>
            <Input
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
            <Input
              type="text"
              value={auth.key ?? ''}
              onChange={(e) => setAuth({ ...auth, key: e.target.value })}
              placeholder={t('authKeyPlaceholder')}
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>{t('authValue')}</label>
            <Input
              type="text"
              value={auth.value ?? ''}
              onChange={(e) => setAuth({ ...auth, value: e.target.value })}
              placeholder={t('authValuePlaceholder')}
              spellCheck={false}
            />
          </div>
          <div className="auth-field">
            <label>{t('authAddTo')}</label>
            <Select
              value={auth.in ?? 'header'}
              onChange={(e) => setAuth({ ...auth, in: e.target.value as 'header' | 'query' })}
              style={{ width: '100%' }}
            >
              <Option value="header">{t('authHeaderOption')}</Option>
              <Option value="query">{t('authQueryOption')}</Option>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
