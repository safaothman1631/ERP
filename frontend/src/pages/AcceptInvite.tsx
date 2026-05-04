/**
 * Public landing page for invited users.
 * Reads ?token=... from URL, verifies it, and lets the user set a password
 * to activate their account. On success, stores JWT and redirects to /.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Result, Spin, App as AntApp } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../api';

const { Title, Text } = Typography;

interface InviteInfo {
  email: string;
  name: string;
  org_name: string;
}

export default function AcceptInvite() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!token) {
      setError(t('invite_missing_token', 'تۆکن نەنووسراوە'));
      setVerifying(false);
      return;
    }
    api
      .get('/api/users/invite/verify', { params: { token } })
      .then((r) => setInfo(r.data))
      .catch((e) => {
        setError(e?.response?.data?.detail || t('invite_invalid', 'بانگهێشت نادروستە یان بەسەرچوو'));
      })
      .finally(() => setVerifying(false));
  }, [token, t]);

  const submit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await api.post('/api/users/accept-invite', {
        token,
        password: values.password,
      });
      // Auto-login
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('userId', res.data.user_id);
      localStorage.setItem('orgId', res.data.org_id);
      localStorage.setItem('userName', res.data.user_name || '');
      message.success(t('account_activated', 'ئەکاونتت چالاک کرا'));
      navigate('/');
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (detail) message.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
        <Result
          status="error"
          title={t('invite_invalid', 'بانگهێشت نادروستە')}
          subTitle={error}
          extra={<Button type="primary" onClick={() => navigate('/login')}>{t('go_to_login', 'بڕۆ بۆ چوونەژوورەوە')}</Button>}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 460 }}>
        <Title level={3} style={{ marginBottom: 8 }}>{t('accept_invite_title', 'بانگهێشتت قبووڵ بکە')}</Title>
        <Text type="secondary">
          {t('accept_invite_subtitle', 'بەخێربێیت بۆ ')} <strong>{info.org_name}</strong>
        </Text>
        <div style={{ marginTop: 20, marginBottom: 16 }}>
          <Text strong>{info.name}</Text>
          <br />
          <Text type="secondary">{info.email}</Text>
        </div>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="password"
            label={t('password', 'وشەی نهێنی')}
            rules={[
              { required: true, min: 8 },
              {
                validator: (_, val) => {
                  if (!val) return Promise.resolve();
                  if (!/[A-Z]/.test(val)) return Promise.reject(new Error(t('password_need_upper', 'پێویستە یەک پیتی گەورە')));
                  if (!/[0-9]/.test(val)) return Promise.reject(new Error(t('password_need_digit', 'پێویستە یەک ژمارە')));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.Password autoFocus placeholder={t('choose_password', 'وشەی نهێنیێک هەڵبژێرە')} />
          </Form.Item>
          <Form.Item
            name="confirm"
            label={t('confirm_password', 'دووپاتکردنەوەی وشەی نهێنی')}
            dependencies={['password']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, val) {
                  if (!val || getFieldValue('password') === val) return Promise.resolve();
                  return Promise.reject(new Error(t('passwords_dont_match', 'وشە نهێنییەکان وەک یەک نین')));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            {t('activate_account', 'چالاککردنی ئەکاونت')}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
