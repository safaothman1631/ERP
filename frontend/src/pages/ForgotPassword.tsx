import React, { useState } from 'react';
import { Form, Input, Button, Alert, Result } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../api';
import AuthLayout from '../components/AuthLayout';
import { ResponsiveForm } from '../components/responsive/ResponsiveForm';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.post('/api/auth/forgot-password', { email: values.email });
      setSent(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setErrorMsg(detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth_forgot_password')}
      subtitle={t('auth_enter_email_reset')}
    >
      {sent ? (
        <Result
          status="success"
          title={t('auth_reset_sent')}
          subTitle={t('auth_reset_check_email')}
          extra={
            <Link to="/login">
              <Button type="primary" className="auth-btn" style={{ borderRadius: 10 }}>
                {t('auth_back_to_login')}
              </Button>
            </Link>
          }
        />
      ) : (
        <>
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

          <Form layout="vertical" onFinish={handleSubmit} style={{ direction: 'rtl' }}>
            <ResponsiveForm layout="single">
            <Form.Item
              name="email"
              style={{ marginBottom: 20 }}
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

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                className="auth-btn"
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
              >
                {t('auth_reset_password')}
              </Button>
            </Form.Item>
            </ResponsiveForm>
          </Form>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#666' }}>
            <Link to="/login" style={{ color: '#667EEA', fontWeight: 600 }}>
              {t('auth_back_to_login')}
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
