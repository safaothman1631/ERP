import React, { useState } from 'react';
import { Form, Input, Button, Alert, Result } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import AuthLayout from '../components/AuthLayout';

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: any) => {
    if (values.new_password !== values.confirm_password) {
      setErrorMsg(t('auth_password_mismatch'));
      return;
    }
    if (!token) {
      setErrorMsg(t('auth_token_expired'));
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.post('/api/auth/reset-password', {
        token,
        new_password: values.new_password,
      });
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
    <AuthLayout
      title={t('auth_reset_password')}
      subtitle={t('auth_new_password')}
    >
      {success ? (
        <Result
          status="success"
          title={t('auth_reset_success')}
          extra={
            <Link to="/login">
              <Button type="primary" className="auth-btn" style={{ borderRadius: 10 }}>
                {t('auth_login')}
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

          {!token ? (
            <Alert
              message={t('auth_token_expired')}
              type="warning"
              showIcon
              style={{ marginBottom: 20, borderRadius: 10, direction: 'rtl', textAlign: 'end' }}
            />
          ) : (
            <Form layout="vertical" onFinish={handleSubmit} style={{ direction: 'rtl' }}>
              <Form.Item
                name="new_password"
                style={{ marginBottom: 16 }}
                rules={[
                  { required: true, message: t('required_password') },
                  { min: 6, message: t('password_too_short') },
                ]}
              >
                <Input.Password
                  className="auth-input"
                  size="large"
                  placeholder={t('placeholder_new_password')}
                  prefix={<LockOutlined />}
                  style={{ borderRadius: 10, height: 46 }}
                />
              </Form.Item>

              <Form.Item
                name="confirm_password"
                style={{ marginBottom: 20 }}
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
                  {t('auth_reset_password')}
                </Button>
              </Form.Item>
            </Form>
          )}

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

export default ResetPassword;
