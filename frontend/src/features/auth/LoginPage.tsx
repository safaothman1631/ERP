/**
 * LoginPage.tsx — Modern Login Page Redesign
 *
 * Implements Requirements 16.1–16.7:
 * 16.1 — 50/50 split-screen layout via AuthLayout; branding hidden on < 768px, form full-width
 * 16.2 — Particle/background effect on branding side (via MotionGate); Typewriter hero text
 * 16.3 — Glass Morphism card (backdrop-filter: blur(16px), glass.login tokens)
 * 16.4 — LanguageSwitcher in top corner, accessible before authentication
 * 16.5 — Dark Mode and Light Mode support
 * 16.6 — Login attempt tracking: error in selected language; lock for 15 min after 5 fails; countdown timer
 * 16.7 — Full keyboard navigation: Tab cycles fields, Enter submits, focus visually indicated
 *
 * Uses:
 * - AuthLayout (layouts/AuthLayout.tsx) for the 50/50 split-screen shell
 * - Particles (react-bits) via MotionGate for the branding background
 * - Typewriter (react-bits) via MotionGate for hero text
 * - LanguageSwitcher for pre-auth language switching
 * - glass.login tokens from theme/tokens.ts
 * - useAuthStore for login action
 * - useUiStore for theme (dark/light)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Form, Input, Button, Alert, Divider, ConfigProvider } from 'antd';
import { MailOutlined, LockOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { completeLoginSession } from '../../platform/utils/completeLoginSession';
import api from '../../api';
import AuthLayout from '../../layouts/AuthLayout';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { MotionGateChildren } from '../../components/MotionGate';
import Particles from '../../components/react-bits/Particles';
import Typewriter from '../../components/react-bits/Typewriter';
import { glass, palette } from '../../theme/tokens';
import { useUiStore } from '../../stores/uiStore';
import { isRTLLanguage } from '../../utils/language';
import { ResponsiveForm } from '../../components/responsive/ResponsiveForm';

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

// ─── BrandingParticles — Particles + Typewriter for the branding side ────────

/**
 * BrandingParticles renders the Particles background and Typewriter hero text
 * for the branding side of the login page.
 * Requirement 16.2: Particles background via MotionGate
 */
const BrandingParticles: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      {/* Particles background — gated on prefers-reduced-motion (Requirement 16.2) */}
      <MotionGateChildren fallback={null}>
        <Particles
          count={55}
          color="rgba(255,255,255,0.55)"
          minRadius={1}
          maxRadius={2.5}
          speed={0.4}
          connectParticles
          connectionDistance={110}
          style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        />
      </MotionGateChildren>

      {/* Typewriter hero text overlay — gated on prefers-reduced-motion (Requirement 16.2) */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          insetInlineStart: 36,
          insetInlineEnd: 36,
          zIndex: 1,
          color: '#fff',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.70)',
            letterSpacing: 0.5,
            marginBottom: 8,
            textTransform: 'uppercase',
          }}
        >
          {t('login_hero_tagline')}
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.4,
            color: '#fff',
            textShadow: '0 2px 12px rgba(0,0,0,0.25)',
            minHeight: 68,
          }}
          aria-live="polite"
        >
          <MotionGateChildren fallback={<span>{t('login_hero_title')}</span>}>
            <Typewriter
              text={t('login_hero_title')}
              speed={50}
              style={{ color: '#fff' }}
            />
          </MotionGateChildren>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.80)',
            marginTop: 6,
            lineHeight: 1.6,
          }}
        >
          {t('login_hero_subtitle')}
        </div>
      </div>
    </>
  );
};

// ─── LoginPage ────────────────────────────────────────────────────────────────

/**
 * LoginPage — redesigned login page using AuthLayout (50/50 split-screen).
 *
 * Requirements: 16.1–16.7
 */
const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthStore();

  // ── Theme detection (Requirement 16.5) ──
  // Read theme from authStore persisted state
  const isDark = useMemo(() => {
    try {
      const raw = localStorage.getItem('auth.store.v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.state?.theme === 'dark';
      }
    } catch {
      // noop
    }
    return false;
  }, []);

  // ── RTL detection ──
  const currentLang = (i18n.language || 'ku') as 'ku' | 'en' | 'ar';
  const isRTL = isRTLLanguage(currentLang === 'ku' || currentLang === 'ar' ? currentLang : 'ku');

  // ── Form state ──
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form] = Form.useForm();

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
  const remainingAttempts = MAX_ATTEMPTS - attemptState.count;

  // ── Login handler ──
  const handleLogin = useCallback(
    async (values: { email: string; password: string }) => {
      if (locked) return;

      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await api.post('/api/auth/login', values);

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
    [locked, attemptState, login, navigate, t]
  );

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
    [locked, login, navigate, t]
  );

  // ── Glass morphism tokens (Requirement 16.3) ──
  const glassTokens = isDark ? glass.login.dark : glass.login.light;

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Language Switcher — top corner, accessible before auth (Requirement 16.4) ── */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          insetInlineEnd: 20,
          zIndex: 2000,
        }}
      >
        <LanguageSwitcher size="small" type="default" />
      </div>

      {/* ── CSS: glass morphism + dark mode + focus ring + blink cursor ── */}
      <style>{`
        @keyframes login-cursor-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        /* Glass morphism on form panel (Requirement 16.3) */
        .login-glass-form-panel {
          background: ${glassTokens.bg};
          border-inline-start: 1px solid ${glassTokens.border};
        }
        @supports (backdrop-filter: blur(1px)) {
          .login-glass-form-panel {
            backdrop-filter: ${glassTokens.blur};
            -webkit-backdrop-filter: ${glassTokens.blur};
          }
        }
        @supports not (backdrop-filter: blur(1px)) {
          .login-glass-form-panel {
            background: ${isDark ? palette.darkSurface : palette.surface} !important;
          }
        }

        /* Focus ring on all inputs — clean single ring, no double border */
        .login-form .ant-input-affix-wrapper {
          border-radius: 10px !important;
          border: 1.5px solid rgba(15,23,42,0.15) !important;
          box-shadow: none !important;
          transition: border-color 0.18s, box-shadow 0.18s !important;
          display: flex !important;
          align-items: center !important;
          height: 46px !important;
          direction: ltr !important;
        }
        .login-form .ant-input-affix-wrapper .ant-input-prefix {
          display: flex !important;
          align-items: center !important;
          margin-inline-end: 8px !important;
          color: rgba(15,23,42,0.40) !important;
        }
        .login-form .ant-input-affix-wrapper .ant-input {
          line-height: 1.5 !important;
          padding-block: 0 !important;
          direction: ltr !important;
          text-align: left !important;
        }
        .login-form .ant-input-affix-wrapper .ant-input::placeholder {
          direction: ltr !important;
          text-align: left !important;
        }
        .login-form .ant-input-affix-wrapper:hover {
          border-color: rgba(31,111,235,0.40) !important;
          box-shadow: none !important;
        }
        .login-form .ant-input-affix-wrapper:focus,
        .login-form .ant-input-affix-wrapper-focused {
          border-color: ${palette.primary500} !important;
          box-shadow: 0 0 0 3px rgba(31,111,235,0.12) !important;
          outline: none !important;
        }
        .login-form .ant-input {
          background: transparent !important;
          box-shadow: none !important;
          direction: ltr !important;
          text-align: left !important;
        }
        .login-form .ant-input:focus {
          outline: none !important;
          box-shadow: none !important;
        }
        .login-form .ant-input::placeholder {
          direction: ltr !important;
          text-align: left !important;
        }

        /* Force LTR layout on auth inputs when document is RTL */
        .auth-form-ltr .ant-input-affix-wrapper,
        .auth-form-ltr .ant-input {
          direction: ltr !important;
          text-align: start !important;
        }
        .auth-form-ltr .ant-input::placeholder {
          text-align: start !important;
        }

        /* Dark mode overrides (Requirement 16.5) */
        ${isDark ? `
          .auth-layout-form-panel {
            background: rgba(17,26,46,0.96) !important;
          }
          .auth-layout-form-panel h1,
          .auth-layout-form-panel p {
            color: ${palette.darkInk} !important;
          }
          .auth-layout-form-panel .ant-form-item-label > label {
            color: ${palette.darkInkMuted} !important;
          }
          .auth-layout-form-panel .ant-input,
          .auth-layout-form-panel .ant-input-affix-wrapper {
            background: ${palette.darkElevated} !important;
            border-color: ${palette.darkBorder} !important;
            color: ${palette.darkInk} !important;
          }
          .auth-layout-form-panel .ant-input::placeholder {
            color: ${palette.darkInkMuted} !important;
          }
          .auth-layout-form-panel .ant-divider-inner-text {
            color: ${palette.darkInkMuted} !important;
          }
        ` : ''}
      `}</style>

      {/* ── AuthLayout provides the 50/50 split-screen shell (Requirement 16.1) ── */}
      {/* brandingExtra injects Particles + Typewriter into the branding side (Requirement 16.2) */}
      <AuthLayout
        title={t('login_title')}
        subtitle={t('login_subtitle')}
        brandingExtra={<BrandingParticles />}
      >
        {/* ── Locked state — countdown timer (Requirement 16.6) ── */}
        {locked && (
          <Alert
            icon={<ClockCircleOutlined />}
            message={t('account_locked')}
            description={
              <span>
                {t('account_locked_desc', { minutes: 15 })}
                {countdown && (
                  <span
                    style={{
                      display: 'block',
                      marginTop: 6,
                      fontWeight: 700,
                      fontSize: 20,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: 2,
                      color: palette.danger,
                    }}
                    aria-live="polite"
                    aria-atomic="true"
                    aria-label={`${t('countdown', {
                      minutes: countdown.split(':')[0],
                      seconds: countdown.split(':')[1],
                    })}`}
                  >
                    {countdown}
                  </span>
                )}
              </span>
            }
            type="error"
            showIcon
            style={{ marginBottom: 20, borderRadius: 10 }}
            role="alert"
          />
        )}

        {/* ── Error message in selected language (Requirement 16.6) ── */}
        {!locked && errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMsg(null)}
            style={{ marginBottom: 20, borderRadius: 10 }}
            role="alert"
            aria-live="assertive"
          />
        )}

        {/* ── Login Form (Requirements 16.3, 16.7) ── */}
        <ConfigProvider direction={isRTL ? 'rtl' : 'ltr'}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleLogin}
          className={`login-form${isRTL ? '' : ' auth-form-ltr'}`}
          validateTrigger={['onChange', 'onBlur']}
          aria-label={t('login')}
        >
          <ResponsiveForm layout="single">
          {/* Email field — Tab order 1 (Requirement 16.7) */}
          <Form.Item
            name="email"
            label={t('email')}
            style={{ marginBottom: 16 }}
            rules={[
              { required: true, message: t('validation_required', 'This field is required') },
              { type: 'email', message: t('validation_email', 'Please enter a valid email') },
            ]}
            validateTrigger={['onChange', 'onBlur']}
          >
            <Input
              size="large"
              placeholder={t('email_placeholder')}
              prefix={<MailOutlined aria-hidden="true" />}
              style={{ height: 46, lineHeight: '46px', display: 'flex', alignItems: 'center' }}
              autoComplete="email"
              disabled={locked || loading}
              aria-label={t('email')}
              aria-required="true"
              aria-invalid={!!errorMsg ? 'true' : 'false'}
              tabIndex={0}
            />
          </Form.Item>

          {/* Password field — Tab order 2; Enter submits (Requirement 16.7) */}
          <Form.Item
            name="password"
            label={t('password')}
            style={{ marginBottom: 8 }}
            rules={[{ required: true, message: t('validation_required', 'This field is required') }]}
            validateTrigger={['onChange', 'onBlur']}
          >
            <Input.Password
              size="large"
              placeholder={t('password_placeholder')}
              prefix={<LockOutlined aria-hidden="true" />}
              style={{ height: 46 }}
              autoComplete="current-password"
              disabled={locked || loading}
              aria-label={t('password')}
              aria-required="true"
              tabIndex={0}
              // Enter key submits the form (Requirement 16.7)
              onPressEnter={() => form.submit()}
            />
          </Form.Item>

          {/* Forgot password link — Tab order 3 */}
          <div style={{ textAlign: 'start', marginBottom: 16 }}>
            <Link
              to="/forgot-password"
              style={{ fontSize: 13, color: palette.primary500 }}
              tabIndex={0}
            >
              {t('forgot_password')}
            </Link>
          </div>

          {/* Submit button — Tab order 4; Enter key also triggers (Requirement 16.7) */}
          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              disabled={locked}
              style={{ borderRadius: 10, height: 46, fontWeight: 600 }}
              aria-label={locked ? t('account_locked') : t('login_button')}
              tabIndex={0}
            >
              {locked ? t('account_locked') : t('login_button')}
            </Button>
          </Form.Item>
          </ResponsiveForm>
        </Form>
        </ConfigProvider>

        <Divider style={{ margin: '8px 0', color: '#aaa', fontSize: 12 }}>
          {t('or_continue_with')}
        </Divider>

        <GoogleSignInButton
          text={t('google_login')}
          loading={loading}
          onSuccess={handleGoogleLogin}
          onError={(err: any) => {
            const code = err?.code || '';
            const msg = err?.message || String(err);
            if (code === 'auth/unauthorized-domain') {
              setErrorMsg(t('invalid_credentials'));
            } else if (code === 'auth/popup-blocked') {
              setErrorMsg(t('invalid_credentials'));
            } else if (code === 'auth/network-request-failed') {
              setErrorMsg(t('invalid_credentials'));
            } else {
              setErrorMsg(`${t('invalid_credentials')}: ${code || msg}`);
            }
          }}
        />

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#666' }}>
          {t('terms_agreement')}{' '}
          <Link
            to="/signup"
            style={{ color: palette.primary500, fontWeight: 600 }}
            tabIndex={0}
          >
            {t('register')}
          </Link>
        </div>
      </AuthLayout>
    </div>
  );
};

export default LoginPage;
