/**
 * LoginPage.tsx
 *
 * پەرەی چوونەژوورەوە
 *
 * Requirements 2.1, 2.5:
 * - Email + password login with real-time validation
 * - "Forgot password?" link
 * - MFA flow: if backend returns mfa_required, redirect to /mfa with session token
 * - Google SSO
 * - JWT storage: access token in memory (Zustand), refresh token in httpOnly cookie
 */
import React, { useState } from 'react';
import { Form, Input, Button, Alert, Divider } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store';
import api from '../../api';
import AuthLayout from '../../components/AuthLayout';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { getPostLoginPath } from '../../personas/resolveRoleUx';

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loginSecure } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/api/v1/auth/login', {
        email: values.email,
        password: values.password,
      });

      // MFA required — backend returns mfa_required flag with a session token
      if (res.data.mfa_required) {
        // Store the MFA session token temporarily in sessionStorage (not localStorage)
        // so it's cleared when the tab closes.
        sessionStorage.setItem('mfa_session_token', res.data.mfa_session_token || '');
        sessionStorage.setItem('mfa_user_id', res.data.user_id || '');
        navigate('/mfa');
        return;
      }

      // Normal login — access token stored in memory (Zustand), refresh token
      // is set as httpOnly cookie by the backend.
      loginSecure(
        res.data.access_token,
        res.data.user_id,
        res.data.org_id,
        res.data.user_name,
        res.data.role,
      );
      navigate(getPostLoginPath(res.data.role ?? null, res.data.permissions ?? []));
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;

      if (status === 423) {
        // Account locked (Requirement 2.6: locked after 5 failed attempts for 15 min)
        setErrorMsg(t('auth_account_locked'));
      } else if (detail === 'تکایە بە Google بچۆرە ژوورەوە') {
        setErrorMsg(t('auth_use_google'));
      } else {
        setErrorMsg(detail || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (idToken: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/api/v1/auth/firebase-login', { id_token: idToken });

      // MFA check for Google SSO as well
      if (res.data.mfa_required) {
        sessionStorage.setItem('mfa_session_token', res.data.mfa_session_token || '');
        sessionStorage.setItem('mfa_user_id', res.data.user_id || '');
        navigate('/mfa');
        return;
      }

      loginSecure(
        res.data.access_token,
        res.data.user_id,
        res.data.org_id,
        res.data.user_name,
        res.data.role,
      );
      navigate(getPostLoginPath(res.data.role ?? null, res.data.permissions ?? []));
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 404) {
        setErrorMsg(t('auth_not_registered'));
      } else {
        setErrorMsg(detail || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth_welcome_back')}
      subtitle={t('auth_login')}
    >
      {errorMsg && (
        <Alert
          title={errorMsg}
          type="error"
          showIcon
          closable
          onClose={() => setErrorMsg(null)}
          style={{ marginBottom: 20, borderRadius: 10, direction: 'rtl', textAlign: 'end' }}
        />
      )}

      <Form
        layout="vertical"
        onFinish={handleLogin}
        style={{ direction: 'rtl' }}
        validateTrigger={['onChange', 'onBlur']}
      >
        {/* Email */}
        <Form.Item
          name="email"
          style={{ marginBottom: 16 }}
          rules={[
            { required: true, message: t('required_email') },
            { type: 'email', message: t('invalid_email') },
          ]}
          validateTrigger={['onChange', 'onBlur']}
        >
          <Input
            className="auth-input"
            size="large"
            placeholder={t('placeholder_email')}
            prefix={<MailOutlined />}
            style={{ borderRadius: 10, height: 46 }}
            autoComplete="email"
          />
        </Form.Item>

        {/* Password */}
        <Form.Item
          name="password"
          style={{ marginBottom: 8 }}
          rules={[{ required: true, message: t('required_password') }]}
          validateTrigger={['onChange', 'onBlur']}
        >
          <Input.Password
            className="auth-input"
            size="large"
            placeholder={t('placeholder_password')}
            prefix={<LockOutlined />}
            style={{ borderRadius: 10, height: 46 }}
            autoComplete="current-password"
          />
        </Form.Item>

        {/* Forgot password link — Requirement 2.5 */}
        <div style={{ textAlign: 'start', marginBottom: 16 }}>
          <Link to="/forgot-password" style={{ fontSize: 13, color: '#1F6FEB' }}>
            {t('auth_forgot_password')}
          </Link>
        </div>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button
            className="auth-btn"
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
          >
            {t('auth_login')}
          </Button>
        </Form.Item>
</Form>

      <Divider style={{ margin: '8px 0', color: '#aaa', fontSize: 12 }}>
        {t('or') || 'یان'}
      </Divider>

      <GoogleSignInButton
        text={t('auth_google_signin')}
        loading={loading}
        onSuccess={handleGoogleLogin}
        onError={(err: any) => {
          const code = err?.code || '';
          const msg = err?.message || String(err);
          if (code === 'auth/unauthorized-domain') {
            setErrorMsg('Domain ـی ئەم سایتە لە Firebase Authorized Domains زیاد نەکراوە. Firebase Console → Authentication → Settings → Authorized domains ـدا erpiq.systems زیاد بکە.');
          } else if (code === 'auth/popup-blocked') {
            setErrorMsg('Browser ـت popup ـی Google ـی بلۆک کرد. تکایە popup blocker لە لاپەڕەکە بکە.');
          } else if (code === 'auth/network-request-failed') {
            setErrorMsg('کێشەی ئینتەرنێت — تکایە ئینتەرنێتەکەت چێک بکە.');
          } else {
            setErrorMsg(`${t('error')}: ${code || msg}`);
          }
          console.error('[GoogleSignIn]', code, msg, err);
        }}
      />

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#666' }}>
        {t('auth_no_account')}{' '}
        <Link to="/signup" style={{ color: '#667EEA', fontWeight: 600 }}>
          {t('auth_signup')}
        </Link>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
