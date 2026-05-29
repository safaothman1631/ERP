/**
 * TrialBanner — global in-app banner shown while the tenant is on trial.
 *
 * Behavior:
 *   - Fetches /api/saas-billing/state once on mount.
 *   - Renders only when status === 'trialing' and days_left >= 0.
 *   - Severity ramps from info → amber (≤14d) → red (≤3d).
 *   - Dismiss button hides for 24h via localStorage key `billing.trial.dismissed_at`.
 *   - Re-fetches every 5 minutes so a plan-upgrade in another tab makes the banner disappear.
 *
 * Mount this near the top of the authenticated layout (above the side nav).
 * Spec: launch-readiness § R5.8.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../../api';

const DISMISS_KEY = 'billing.trial.dismissed_at';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const POLL_MS = 5 * 60 * 1000;               // 5 min

interface BillingState {
  status: string;
  trial_ends_at: string | null;
  days_left_in_trial: number | null;
}

function isDismissed(now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (Number.isNaN(at)) return false;
    return now - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function setDismissed(now: number = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    // best-effort
  }
}

export default function TrialBanner(): React.ReactElement | null {
  const { t } = useTranslation();
  const [state, setState] = useState<BillingState | null>(null);
  const [dismissed, setLocalDismissed] = useState(() => isDismissed());

  const load = useCallback(async () => {
    try {
      const res = await api.get<BillingState>('/api/saas-billing/state');
      setState(res.data);
    } catch {
      // silent — don't break the app if billing is offline
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!state) return null;
  if (state.status !== 'trialing') return null;
  if (dismissed) return null;
  const days = state.days_left_in_trial;
  if (days === null || days < 0) return null;

  const severity: 'info' | 'warning' | 'error' =
    days <= 3 ? 'error' : days <= 14 ? 'warning' : 'info';

  return (
    <Alert
      type={severity}
      showIcon
      banner
      closable
      onClose={() => {
        setDismissed();
        setLocalDismissed(true);
      }}
      message={t('billing.trial.banner', {
        days,
        defaultValue: '{{days}} days left in your trial — upgrade to keep your data',
      })}
      action={
        <Button
          size="small"
          type="primary"
          href="/settings/billing"
        >
          {t('billing.upgrade', 'Upgrade')}
        </Button>
      }
    />
  );
}
