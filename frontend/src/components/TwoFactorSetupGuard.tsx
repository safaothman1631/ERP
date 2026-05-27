import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import api from '../api';

const SECURITY_SETTINGS_PATH = '/settings?s=security';

function isSecuritySettingsPath(pathname: string, search: string): boolean {
  if (pathname !== '/settings') return false;
  return new URLSearchParams(search).get('s') === 'security';
}

/**
 * After login, privileged users who must enable 2FA are confined to
 * Settings → Security until setup is complete.
 */
export const TwoFactorSetupGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [required, setRequired] = useState(false);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/api/auth/me');
      setRequired(Boolean(r.data?.requires_2fa_setup));
    } catch {
      setRequired(false);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, location.pathname, location.search]);

  useEffect(() => {
    const onComplete = () => { void refresh(); };
    window.addEventListener('2fa-setup-complete', onComplete);
    return () => window.removeEventListener('2fa-setup-complete', onComplete);
  }, [refresh]);

  if (!checked) return <>{children}</>;

  const onSecurityPage = isSecuritySettingsPath(location.pathname, location.search);
  if (required && !onSecurityPage) {
    return <Navigate to={SECURITY_SETTINGS_PATH} replace />;
  }

  return (
    <>
      {required && onSecurityPage && (
        <Alert
          type="warning"
          showIcon
          title={t('2fa_setup_required_title', 'Two-factor authentication required')}
          description={t(
            '2fa_setup_required_desc',
            'Your role requires 2FA. Set it up below before using the rest of the app.',
          )}
          style={{ margin: '0 0 16px', borderRadius: 10 }}
          role="alert"
        />
      )}
      {children}
    </>
  );
};

export { SECURITY_SETTINGS_PATH };
