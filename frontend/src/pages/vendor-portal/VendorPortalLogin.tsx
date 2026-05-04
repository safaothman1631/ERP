import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Steps, Typography, Result, Space } from 'antd';
import { MailOutlined, LoginOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import vendorApi from '../../api/vendorPortal';

const { Title, Text } = Typography;

const VendorPortalLogin: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(searchParams.get('token') ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [magicToken, setMagicToken] = useState(searchParams.get('token') || '');
  const [form] = Form.useForm();

  useEffect(() => {
    if (magicToken && step === 1) {
      verifyToken();
    }
  }, [magicToken, step]);

  const requestLink = async (values: { email: string }) => {
    try {
      setLoading(true);
      const res = await vendorApi.post('/api/vendor-portal/request-link', { email: values.email });
      setMagicToken(res.data.token);
      message.success(t('vendor_portal.magic_link_sent'));
      setStep(1);
    } catch (err: any) {
      if (err.response?.status === 404) {
        message.error(t('vendor_portal.email_not_found'));
      } else if (err.response?.status === 403) {
        message.error(t('vendor_portal.not_vendor'));
      } else {
        message.error(t('vendor_portal.request_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    try {
      setLoading(true);
      const res = await vendorApi.post('/api/vendor-portal/verify-link', { token: magicToken });

      localStorage.setItem('vendor_jwt', res.data.vendor_jwt);
      localStorage.setItem('vendor_email', res.data.email);
      localStorage.setItem('vendor_contact_id', res.data.contact_id);

      message.success(t('vendor_portal.login_success'));
      navigate('/vendor-portal');
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 410) {
        message.error(t('vendor_portal.token_invalid'));
        setStep(0);
        setMagicToken('');
      } else {
        message.error(t('vendor_portal.request_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const stepsItems = [
    {
      title: t('vendor_portal.email_label'),
      icon: <MailOutlined />,
    },
    {
      title: t('vendor_portal.verify_token'),
      icon: <LoginOutlined />,
    },
  ];

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card 
        style={{ 
          width: '100%', 
          maxWidth: 500,
          margin: 16,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2}>{t('vendor_portal.login')}</Title>
            <Text type="secondary">{t('vendor_portal.welcome')}</Text>
          </div>

          <Steps current={step} items={stepsItems} />

          {step === 0 && (
            <Form
              form={form}
              layout="vertical"
              onFinish={requestLink}
            >
              <Form.Item
                name="email"
                label={t('vendor_portal.email_label')}
                rules={[
                  { required: true, message: t('required') },
                  { type: 'email', message: t('email_invalid') },
                ]}
              >
                <Input 
                  prefix={<MailOutlined />}
                  placeholder="vendor@example.com"
                  size="large"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                >
                  {t('vendor_portal.request_link')}
                </Button>
              </Form.Item>
            </Form>
          )}

          {step === 1 && (
            <Result
              status="success"
              title={t('vendor_portal.magic_link_sent')}
              subTitle={t('vendor_portal.verify_token')}
              extra={
                loading ? (
                  <Button type="primary" loading>
                    {t('loading')}
                  </Button>
                ) : (
                  <Button type="primary" onClick={verifyToken}>
                    {t('retry')}
                  </Button>
                )
              }
            />
          )}
        </Space>
      </Card>
    </div>
  );
};

export default VendorPortalLogin;
