/**
 * LoginPage.tsx — Sign in (Vertex kit design)
 *
 * Renders the Vertex split-screen auth screen (VertexAuthShell, mode="signin")
 * and wires it to the real authentication logic:
 *  - email/password → POST /api/auth/login → completeLoginSession → navigate
 *  - Google popup   → POST /api/auth/firebase-login
 *  - login attempt tracking: lock for 15 min after 5 failed attempts, with a
 *    live countdown (Requirement 16.6). Error messages localized via t().
 *
 * The presentational layer (brand rail, fields, social buttons, demo accounts,
 * language switch, dark theme) lives in VertexAuthShell.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { completeLoginSession } from '../../platform/utils/completeLoginSession';
import api from '../../api';
import VertexAuthShell, { type AuthSubmitValues } from './VertexAuthShell';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum failed attempts before lockout (Requirement 16.6) */
const MAX_ATTEMPTS = 5;
/** Lockout duration in milliseconds: 15 minutes (Requirement 16.6) */
const LOCK_DURATION_MS = 15 * 60 * 1000;
/** localStorage key for persisting login attempt state */
const ATTEMPT_STORAGE_KEY = 'login.attempts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LoginAttemptState {
  count: number;
  /** Unix timestamp (ms) when the lock expires; null if not locked */
  lockedUntil: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadAttemptState(): LoginAttemptState {
  try {
    const raw = localStorage.getItem(ATTEMPT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LoginAttemptState;
      // If lock has expired, reset
      if (parsed.lockedUntil !== null && Date.now() >= parsed.lockedUntil) {
        return { count: 0, lockedUntil: null };
      }
      return parsed;
    }
  } catch {
    // localStorage unavailable or corrupt — start fresh
  }
  return { count: 0, lockedUntil: null };
}

function saveAttemptState(state: LoginAttemptState): void {
  try {
    localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — in-memory only
  }
}

function clearAttemptState(): void {
  try {
    localStorage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // noop
  }
}

export function isLocked(state: LoginAttemptState): boolean {
  if (state.lockedUntil === null) return false;
  return Date.now() < state.lockedUntil;
}

export function recordFailedAttempt(state: LoginAttemptState): LoginAttemptState {
  const newCount = state.count + 1;
  if (newCount >= MAX_ATTEMPTS) {
    return { count: newCount, lockedUntil: Date.now() + LOCK_DURATION_MS };
  }
  return { count: newCount, lockedUntil: null };
}

/** Format remaining milliseconds as MM:SS */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ── Form state ──
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Login attempt tracking (Requirement 16.6) ──
  const [attemptState, setAttemptState] = useState<LoginAttemptState>(loadAttemptState);
  const [countdown, setCountdown] = useState<string>('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync attempt state to localStorage whenever it changes
  useEffect(() => {
    saveAttemptState(attemptState);
  }, [attemptState]);

  // Countdown timer while locked (Requirement 16.6)
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (isLocked(attemptState) && attemptState.lockedUntil !== null) {
      const lockedUntil = attemptState.lockedUntil;
      const tick = () => {
        const remaining = lockedUntil - Date.now();
        if (remaining <= 0) {
          // Lock expired — reset
          const reset: LoginAttemptState = { count: 0, lockedUntil: null };
          setAttemptState(reset);
          saveAttemptState(reset);
          setCountdown('');
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        } else {
          setCountdown(formatCountdown(remaining));
        }
      };
      tick(); // immediate first tick
      countdownRef.current = setInterval(tick, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [attemptState]);

  const locked = isLocked(attemptState);

  // ── Login handler (email/password) ──
  const handleLogin = useCallback(
    async (values: AuthSubmitValues) => {
      if (locked) return;

      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await api.post('/api/auth/login', { email: values.email.trim().toLowerCase(), password: values.password });

        // Success — clear attempt state
        clearAttemptState();
        setAttemptState({ count: 0, lockedUntil: null });

        const path = completeLoginSession(res.data);
        navigate(path);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        const status = err?.response?.status;

        // Record failed attempt (Requirement 16.6)
        const newState = recordFailedAttempt(attemptState);
        setAttemptState(newState);

        if (isLocked(newState)) {
          // Just got locked — show lockout message in selected language
          setErrorMsg(t('account_locked_desc', { minutes: 15 }));
        } else if (status === 423) {
          // Backend-side lock
          setErrorMsg(t('account_locked_desc', { minutes: 15 }));
        } else if (detail === 'تکایە بە Google بچۆرە ژوورەوە') {
          setErrorMsg(t('google_login'));
        } else {
          // Show remaining attempts warning in selected language (Requirement 16.6)
          const attemptsLeft = MAX_ATTEMPTS - newState.count;
          if (attemptsLeft > 0) {
            setErrorMsg(
              `${detail || t('invalid_credentials')} — ${t('too_many_attempts_desc', {
                remaining: attemptsLeft,
              })}`
            );
          } else {
            setErrorMsg(detail || t('invalid_credentials'));
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [locked, attemptState, navigate, t]
  );

  // ── Google sign-in handler ──
  const handleGoogleLogin = useCallback(
    async (idToken: string) => {
      if (locked) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await api.post('/api/auth/firebase-login', { id_token: idToken });
        clearAttemptState();
        setAttemptState({ count: 0, lockedUntil: null });
        const path = completeLoginSession(res.data);
        navigate(path);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        if (err?.response?.status === 404) {
          setErrorMsg(t('invalid_credentials'));
        } else {
          setErrorMsg(detail || t('invalid_credentials'));
        }
      } finally {
        setLoading(false);
      }
    },
    [locked, navigate, t]
  );

  // ── Error / lockout banner content (localized) ──
  const errorNode: React.ReactNode = locked ? (
    <span>
      {t('account_locked_desc', { minutes: 15 })}
      {countdown && (
        <>
          {' '}
          <b style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }} aria-live="polite">{countdown}</b>
        </>
      )}
    </span>
  ) : (
    errorMsg
  );

  return (
    <VertexAuthShell
      mode="signin"
      loading={loading}
      disabled={locked}
      error={errorNode}
      submitLabel={locked ? t('account_locked') : undefined}
      onSubmit={handleLogin}
      onGoogleToken={(idToken) => handleGoogleLogin(idToken)}
      onGoogleError={(err) => {
        const code = (err as { code?: string })?.code || '';
        setErrorMsg(code ? `${t('invalid_credentials')}: ${code}` : t('invalid_credentials'));
      }}
    />
  );
};

export default LoginPage;
