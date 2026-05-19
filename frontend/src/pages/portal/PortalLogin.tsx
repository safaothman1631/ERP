import React, { useState } from 'react';
import { Card, Form, Input, Button, Steps, Typography, Result } from 'antd';
import { MailOutlined, LoginOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import { ResponsiveForm } from '../../components/responsive/ResponsiveForm';

const { Title, Text } = Typography;

const PortalLogin: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(searchParams.get('token') ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [magicToken, setMagicToken] = useState(searchParams.get('token') || '');
  const [form] = Form.useForm();

  const requestLink = async (values: { email: string }) => {
    try {
      setLoading(true);
      const res = await api.post('/api/portal/request-link', { email: values.email });
      setMagicToken(res.data.token); // Demo: token returned directly
      message.success(t('portal.magic_link_sent'));
      setStep(1);
    } catch (err: any) {
      if (err.response?.status === 404) {
        message.error(t('portal.email_not_found'));
      } else {
        message.error(t('portal.request_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    try {
      setLoading(true);
      const res = await api.post('/api/portal/verify-link', { token: magicToken });

      sessionStorage.setItem('portal_jwt', res.data.portal_jwt);
      sessionStorage.setItem('portal_email', res.data.email);

      message.success(t('portal.login_success'));
      navigate('/portal');
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 410) {
        message.error(t('portal.token_invalid'));
      } else {
        message.error(t('portal.verify_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 500, margin: '60px auto' }}>
        <Card>
          <Title level={2} style={{ textAlign: 'center' }}>
            {t('portal.title')}
          </Title>

          <Steps
            current={step}
            items={[
              { title: t('portal.enter_email') },
              { title: t('portal.verify') },
            ]}
            style={{ marginBottom: 32 }}
          />

          {step === 0 && (
            <Form form={form} layout="vertical" onFinish={requestLink}>
              <ResponsiveForm layout="single">
              <Form.Item
                label={t('portal.email')}
                name="email"
                rules={[
                  { required: true, message: t('portal.email_required') },
                  { type: 'email', message: t('portal.email_invalid') },
                ]}
              >
                <Input
                  size="large"
                  prefix={<MailOutlined />}
                  placeholder={t('portal.email_placeholder')}
                />
              </Form.Item>

              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={loading}
                block
              >
                {t('portal.send_magic_link')}
              </Button>
              </ResponsiveForm>
</Form>
          )}

          {step === 1 && (
            <>
              <Result
                status="info"
                title={t('portal.check_email')}
                subTitle={t('portal.magic_link_instruction')}
              />

              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                {t('portal.demo_token')}: <Text code>{magicToken}</Text>
              </Text>

              <Button
                type="primary"
                size="large"
                icon={<LoginOutlined />}
                onClick={verifyToken}
                loading={loading}
                block
              >
                {t('portal.verify_and_login')}
              </Button>

              <Button
                type="link"
                onClick={() => setStep(0)}
                style={{ marginTop: 16, width: '100%' }}
              >
                {t('portal.back_to_email')}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PortalLogin;
