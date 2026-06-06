/**
 * RegisterPage.tsx — Create account (Vertex kit design)
 *
 * Renders the Vertex split-screen auth screen (VertexAuthShell, mode="signup")
 * and wires it to the real registration logic:
 *  - business name + email + password → POST /api/v1/auth/register
 *  - Google popup (with business name) → POST /api/v1/auth/firebase-register
 *  - on success: loginSecure() (access token in memory, refresh in httpOnly
 *    cookie), markFreshSignup(), navigate to /onboarding.
 *
 * The kit's sign-up form collects Business name + Email + Password; the backend
 * also needs a user_name, which we derive from the email local-part (the user
 * can edit it later in settings). The presentational layer lives in
 * VertexAuthShell.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import api from '../../api';
import { useOnboardingStore } from '../../onboarding/store';
import VertexAuthShell, { type AuthSubmitValues } from '../../features/auth/VertexAuthShell';

interface AuthSession {
  access_token: string;
  user_id: string;
  org_id: string;
  user_name: string;
  role: string;
}

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loginSecure } = useAuthStore();
  const markFreshSignup = useOnboardingStore((s) => s.markFreshSignup);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');

  // On success we establish the session (the fixed `loginSecure` now writes the
  // access token to localStorage, so authenticated requests work) and then show
  // an explicit "account created" confirmation screen — instead of silently
  // redirecting (which, combined with the missing token, used to bounce the user
  // straight back to /login as if nothing happened).
  const applySession = (data: AuthSession, email: string) => {
    loginSecure(data.access_token, data.user_id, data.org_id, data.user_name, data.role);
    setCreatedEmail(email);
    setRegistered(true);
  };

  // "Continue to setup" on the confirmation screen → onboarding (authenticated).
  const handleContinue = () => {
    markFreshSignup();
    navigate('/onboarding');
  };

  // ── Email + password registration ──
  const handleRegister = async ({ businessName, fullName, email, password }: AuthSubmitValues) => {
    // Normalize the email (trim + lowercase) so register and a later login look
    // the email up identically — no "user not found" from a stray capital letter.
    const cleanEmail = email.trim().toLowerCase();
    // Business name is optional: an individual registering for themselves can
    // leave it empty, and we name their workspace after them (full name, then
    // email local-part as a last resort). Only the person's name is required.
    const orgName = businessName.trim() || fullName.trim() || cleanEmail.split('@')[0];
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/api/v1/auth/register', {
        org_name: orgName,
        user_name: fullName.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        password,
      });
      applySession(res.data, cleanEmail);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'ئەم ئیمەیڵە پێشتر تۆمار کراوە') {
        setErrorMsg(t('auth_email_exists'));
      } else {
        setErrorMsg(detail || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google registration (business name optional) ──
  const handleGoogleRegister = async (idToken: string, values: AuthSubmitValues) => {
    // Optional business name: fall back to the typed full name; if both are
    // empty the backend names the workspace after the Google account holder.
    const orgName = values.businessName.trim() || values.fullName.trim();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/api/v1/auth/firebase-register', {
        id_token: idToken,
        org_name: orgName,
      });
      applySession(res.data, (values.email || '').trim().toLowerCase());
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'ئەم ئیمەیڵە پێشتر تۆمارکراوە' || detail === 'ئەم ئیمەیڵە پێشتر تۆمار کراوە') {
        setErrorMsg(t('auth_email_exists'));
      } else if (err?.response?.status === 405) {
        setErrorMsg(t('auth_api_unavailable', 'Registration service unavailable. Please try again.'));
      } else {
        setErrorMsg(detail || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <VertexAuthShell
      mode="signup"
      loading={loading}
      error={errorMsg}
      done={registered ? 'created' : undefined}
      createdEmail={createdEmail}
      onContinue={handleContinue}
      onSubmit={handleRegister}
      onGoogleToken={handleGoogleRegister}
      onGoogleError={(err) => {
        const code = (err as { code?: string })?.code || '';
        setErrorMsg(code ? `${t('error')}: ${code}` : t('error'));
      }}
    />
  );
};

export default RegisterPage;
