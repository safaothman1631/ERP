import React, { useState } from 'react';
import { Form, Input, Button, Alert, Divider } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store';
import api from '../api';
import AuthLayout from '../components/AuthLayout';
import GoogleSignInButton from '../components/GoogleSignInButton';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (values: any) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/api/auth/login', values);
      login(res.data.access_token, res.data.user_id, res.data.org_id, res.data.user_name);
      navigate('/');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'تکایە بە Google بچۆرە ژوورەوە') {
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
      const res = await api.post('/api/auth/firebase-login', { id_token: idToken });
      login(res.data.access_token, res.data.user_id, res.data.org_id, res.data.user_name);
      navigate('/');
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
      subtitle={t('login')}
    >
      {errorMsg && (
        <Alert
          message={errorMsg}
          type="error"
          showIcon
          closable
          onClose={() => setErrorMsg(null)}
          style={{ marginBottom: 20, borderRadius: 10, direction: 'rtl', textAlign: 'end' }}
        />
      )}

      <Form layout="vertical" onFinish={handleLogin} style={{ direction: 'rtl' }}>
        <Form.Item
          name="email"
          style={{ marginBottom: 16 }}
          rules={[
            { required: true, message: t('required_email') },
            { type: 'email', message: t('invalid_email') },
          ]}
        >
          <Input
            className="auth-input"
            size="large"
            placeholder={t('placeholder_email')}
            prefix={<MailOutlined />}
            style={{ borderRadius: 10, height: 46 }}
          />
        </Form.Item>

        <Form.Item
          name="password"
          style={{ marginBottom: 8 }}
          rules={[{ required: true, message: t('required_password') }]}
        >
          <Input.Password
            className="auth-input"
            size="large"
            placeholder={t('placeholder_password')}
            prefix={<LockOutlined />}
            style={{ borderRadius: 10, height: 46 }}
          />
        </Form.Item>

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
        onError={() => setErrorMsg(t('error'))}
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

export default Login;
