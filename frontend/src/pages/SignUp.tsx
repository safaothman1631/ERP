import React, { useState } from 'react';
import { Form, Input, Button, Alert, Divider, Modal } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, BankOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useOnboardingStore } from '../onboarding/store';
import api from '../api';
import AuthLayout from '../components/AuthLayout';
import GoogleSignInButton from '../components/GoogleSignInButton';

const SignUp: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const markFreshSignup = useOnboardingStore(s => s.markFreshSignup);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState('');

  const handleSignUp = async (values: any) => {
    if (values.password !== values.confirm_password) {
      setErrorMsg(t('auth_password_mismatch'));
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/api/auth/register', {
        org_name: values.org_name,
        user_name: values.user_name,
        email: values.email,
        password: values.password,
      });
      login(res.data.access_token, res.data.user_id, res.data.org_id, res.data.user_name);
      markFreshSignup();
      navigate('/');
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

  const handleGoogleSuccess = (idToken: string) => {
    setGoogleToken(idToken);
    setOrgModalOpen(true);
  };

  const handleGoogleRegister = async () => {
    if (!orgNameInput.trim() || !googleToken) return;
    setLoading(true);
    setErrorMsg(null);
    setOrgModalOpen(false);
    try {
      const res = await api.post('/api/auth/firebase-register', {
        id_token: googleToken,
        org_name: orgNameInput.trim(),
      });
      login(res.data.access_token, res.data.user_id, res.data.org_id, res.data.user_name);
      markFreshSignup();
      navigate('/');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'ئەم ئیمەیڵە پێشتر تۆمار کراوە') {
        setErrorMsg(t('auth_email_exists'));
      } else {
        setErrorMsg(detail || t('error'));
      }
    } finally {
      setLoading(false);
      setGoogleToken(null);
    }
  };

  return (
    <AuthLayout
      title={t('auth_get_started')}
      subtitle={t('auth_create_account')}
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

      <Form layout="vertical" onFinish={handleSignUp} style={{ direction: 'rtl' }}>
        <Form.Item
          name="org_name"
          style={{ marginBottom: 14 }}
          rules={[{ required: true, message: t('required_company') }]}
        >
          <Input
            className="auth-input"
            size="large"
            placeholder={t('placeholder_company')}
            prefix={<BankOutlined />}
            style={{ borderRadius: 10, height: 46 }}
          />
        </Form.Item>

        <Form.Item
          name="user_name"
          style={{ marginBottom: 14 }}
          rules={[{ required: true, message: t('required_name') }]}
        >
          <Input
            className="auth-input"
            size="large"
            placeholder={t('placeholder_name')}
            prefix={<UserOutlined />}
            style={{ borderRadius: 10, height: 46 }}
          />
        </Form.Item>

        <Form.Item
          name="email"
          style={{ marginBottom: 14 }}
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
          style={{ marginBottom: 14 }}
          rules={[
            { required: true, message: t('required_password') },
            { min: 6, message: t('password_too_short') },
          ]}
        >
          <Input.Password
            className="auth-input"
            size="large"
            placeholder={t('placeholder_password')}
            prefix={<LockOutlined />}
            style={{ borderRadius: 10, height: 46 }}
          />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          style={{ marginBottom: 16 }}
          rules={[{ required: true, message: t('required_password') }]}
        >
          <Input.Password
            className="auth-input"
            size="large"
            placeholder={t('placeholder_confirm_password')}
            prefix={<LockOutlined />}
            style={{ borderRadius: 10, height: 46 }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button
            className="auth-btn"
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
          >
            {t('auth_signup')}
          </Button>
        </Form.Item>
      </Form>

      <Divider style={{ margin: '8px 0', color: '#aaa', fontSize: 12 }}>
        {t('or') || 'یان'}
      </Divider>

      <GoogleSignInButton
        text={t('auth_google_signup')}
        loading={loading}
        onSuccess={handleGoogleSuccess}
        onError={() => setErrorMsg(t('error'))}
      />

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#666' }}>
        {t('auth_has_account')}{' '}
        <Link to="/login" style={{ color: '#667EEA', fontWeight: 600 }}>
          {t('auth_login')}
        </Link>
      </div>

      <Modal
        open={orgModalOpen}
        title={t('auth_org_name')}
        okText={t('auth_create_account')}
        cancelText={t('cancel')}
        onOk={handleGoogleRegister}
        onCancel={() => { setOrgModalOpen(false); setGoogleToken(null); }}
        confirmLoading={loading}
      >
        <p style={{ marginBottom: 12, color: '#666' }}>
          تکایە ناوی رێکخراوەکەت بنووسە
        </p>
        <Input
          size="large"
          placeholder={t('auth_org_name')}
          prefix={<BankOutlined />}
          value={orgNameInput}
          onChange={(e) => setOrgNameInput(e.target.value)}
          style={{ borderRadius: 10, height: 46 }}
        />
      </Modal>
    </AuthLayout>
  );
};

export default SignUp;
