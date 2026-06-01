/**
 * ResetPassword.tsx — Set a new password from an emailed reset link (Vertex kit design).
 *
 * Renders VertexAuthShell (mode="reset"); reads the reset token from the URL,
 * and on submit posts { token, new_password } to /api/auth/reset-password, then
 * shows the kit's success screen. Password match is validated by the shell.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import VertexAuthShell, { type AuthSubmitValues } from '../features/auth/VertexAuthShell';

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async ({ password }: AuthSubmitValues) => {
    if (!token) {
      setErrorMsg(t('auth_token_expired'));
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.post('/api/auth/reset-password', { token, new_password: password });
      setSuccess(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'لینکی گۆڕینەوە بەسەرچووە' || err?.response?.status === 400) {
        setErrorMsg(t('auth_token_expired'));
      } else {
        setErrorMsg(detail || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <VertexAuthShell
      mode="reset"
      loading={loading}
      disabled={!token}
      error={errorMsg || (!token ? t('auth_token_expired') : undefined)}
      done={success ? 'success' : undefined}
      onSubmit={handleSubmit}
    />
  );
};

export default ResetPassword;
