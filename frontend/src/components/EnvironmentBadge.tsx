/**
 * EnvironmentBadge — staging / development environment indicator
 * (launch-readiness § R3.7 — Staging banner).
 *
 * Renders:
 *   - production  → null
 *   - staging     → full-width amber banner along the top of the viewport with
 *                    a brief warning that the data is synthetic. Dismissible
 *                    via an X button; the choice is stored in localStorage
 *                    under ``env_badge_dismissed_at`` and the banner re-appears
 *                    24h after dismissal so reset-cycles aren't masked.
 *   - development → small grey "DEV" pill in the top-right corner.
 *
 * Reads from ``import.meta.env.VITE_ENV`` first and falls back to
 * ``import.meta.env.MODE``. RTL-aware: in RTL languages the dismiss button
 * sits on the left rather than the right.
 *
 * NOTE: a smaller variant lives at ``frontend/src/design-system/EnvironmentBadge.tsx``
 * — that one is a compact inline ``<Tag>`` for embedding inside the chrome
 * (e.g. the top bar). This component is the **page-level chrome** version
 * intended to wrap the whole application shell.
 */
import React, { useEffect, useMemo, useState } from 'react';

type Env = 'production' | 'staging' | 'development' | 'test';

const DISMISS_STORAGE_KEY = 'env_badge_dismissed_at';
const DISMISS_TTL_HOURS = 24;

function resolveEnv(): Env {
  // VITE_ENV takes precedence (explicitly set per deploy target), then MODE.
  const raw = (import.meta.env.VITE_ENV ?? import.meta.env.MODE ?? 'production').toString();
  if (raw === 'staging' || raw === 'production' || raw === 'development' || raw === 'test') {
    return raw;
  }
  return 'production';
}

function readDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
    return ageHours < DISMISS_TTL_HOURS;
  } catch {
    return false;
  }
}

function isRTL(): boolean {
  if (typeof document === 'undefined') return false;
  return document?.documentElement?.dir === 'rtl';
}

export interface EnvironmentBadgeProps {
  /** Override auto-detection — primarily for tests / Storybook. */
  env?: Env;
}

export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({ env }) => {
  const resolved = useMemo<Env>(() => env ?? resolveEnv(), [env]);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [rtl, setRtl] = useState<boolean>(false);

  useEffect(() => {
    setDismissed(readDismissed());
    setRtl(isRTL());
    // Re-evaluate RTL on language change — the app updates documentElement.dir
    // synchronously, so a microtask is enough.
    const onLang = () => setRtl(isRTL());
    window.addEventListener('languagechange', onLang);
    return () => window.removeEventListener('languagechange', onLang);
  }, []);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // localStorage may be blocked (private mode); fall through silently.
    }
    setDismissed(true);
  };

  if (resolved === 'production' || resolved === 'test') {
    return null;
  }

  if (resolved === 'development') {
    const corner: React.CSSProperties = rtl
      ? { position: 'fixed', top: 6, left: 6, zIndex: 9999 }
      : { position: 'fixed', top: 6, right: 6, zIndex: 9999 };
    return (
      <div
        role="status"
        aria-label="Development environment"
        style={{
          ...corner,
          background: '#4b5563',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          pointerEvents: 'none',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        DEV
      </div>
    );
  }

  // resolved === 'staging'
  if (dismissed) {
    return null;
  }

  const dismissButton: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [rtl ? 'left' : 'right']: 12,
    background: 'transparent',
    border: '1px solid rgba(0,0,0,0.35)',
    borderRadius: 4,
    color: '#1f2937',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    padding: '2px 8px',
  } as React.CSSProperties;

  return (
    <div
      role="alert"
      aria-live="polite"
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10000,
        width: '100%',
        background: '#fbbf24', // amber-400 — readable on either bg
        color: '#1f2937',
        padding: '8px 48px',
        fontWeight: 600,
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      }}
    >
      <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>
        🟡
      </span>
      STAGING ENVIRONMENT — Test data only
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss staging banner"
        style={dismissButton}
      >
        ×
      </button>
    </div>
  );
};

export default EnvironmentBadge;
