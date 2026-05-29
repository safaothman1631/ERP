import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const SECURITY_SETTINGS_PATH = '/settings?s=security';

/**
 * 2FA is NEVER mandatory. This component:
 *
 *   1. Never blocks navigation or redirects.
 *   2. When `should_remind_2fa` is true (i.e. user has not enabled 2FA), shows
 *      a once-per-day dismissible banner with a CTA to Settings → Security.
 *   3. Tracks "last reminded" in localStorage so the banner appears at most
 *      every 24 hours per device.
 *
 * Listens for the `2fa-setup-complete` window event so the banner disappears
 * immediately after a user finishes setup.
 */

const REMINDER_STORAGE_KEY = '2fa.lastRemindedAt';
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

function shouldShowToday(): boolean {
  try {
    const raw = window.localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return Date.now() - last >= REMINDER_COOLDOWN_MS;
  } catch {
    // localStorage unavailable (private mode, etc.) — show by default.
    return true;
  }
}

function markRemindedNow(): void {
  try {
    window.localStorage.setItem(REMINDER_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore — fall back to in-memory dismiss for this session.
  }
}

export const TwoFactorSetupGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [shouldRemind, setShouldRemind] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/api/auth/me');
      setShouldRemind(Boolean(r.data?.should_remind_2fa));
    } catch {
      setShouldRemind(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onComplete = () => {
      setShouldRemind(false);
      void refresh();
    };
    window.addEventListener('2fa-setup-complete', onComplete);
    return () => window.removeEventListener('2fa-setup-complete', onComplete);
  }, [refresh]);

  const visible = useMemo(
    () => shouldRemind && !dismissed && shouldShowToday(),
    [shouldRemind, dismissed],
  );

  const handleDismiss = useCallback(() => {
    markRemindedNow();
    setDismissed(true);
  }, []);

  const handleSetup = useCallback(() => {
    markRemindedNow();
    setDismissed(true);
    navigate(SECURITY_SETTINGS_PATH);
  }, [navigate]);

  return (
    <>
      {visible && (
        <Alert
          type="info"
          showIcon
          closable
          onClose={handleDismiss}
          role="status"
          style={{ margin: '0 0 16px', borderRadius: 10 }}
          message={t(
            '2fa_reminder_title',
            'Two-factor authentication is off',
          )}
          description={t(
            '2fa_reminder_desc',
            'Adding 2FA keeps your account safe even if your password leaks. It is recommended, not required — you can enable it any time.',
          )}
          action={
            <Space size="small">
              <Button size="small" type="primary" onClick={handleSetup}>
                {t('2fa_reminder_cta_setup', 'Set up 2FA')}
              </Button>
              <Button size="small" onClick={handleDismiss}>
                {t('2fa_reminder_cta_later', 'Remind me tomorrow')}
              </Button>
            </Space>
          }
        />
      )}
      {children}
    </>
  );
};

export { SECURITY_SETTINGS_PATH };
