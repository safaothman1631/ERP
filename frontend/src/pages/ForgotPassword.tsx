/**
 * ForgotPassword.tsx — Request a password reset link (Vertex kit design).
 *
 * Renders VertexAuthShell (mode="forgot"); on submit posts the email to
 * /api/auth/forgot-password and shows the kit's "Check your email" screen.
 */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import VertexAuthShell, { type AuthSubmitValues } from '../features/auth/VertexAuthShell';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const lastEmail = useRef('');

  const sendReset = async (email: string) => {
    if (!email) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.post('/api/auth/forgot-password', { email });
      lastEmail.current = email;
      setSent(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setErrorMsg(detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <VertexAuthShell
      mode="forgot"
      loading={loading}
      error={errorMsg}
      done={sent ? 'sent' : undefined}
      onSubmit={({ email }: AuthSubmitValues) => sendReset(email)}
      onResend={() => sendReset(lastEmail.current)}
    />
  );
};

export default ForgotPassword;
