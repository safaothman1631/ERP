import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Steps, Typography, Row, Col } from 'antd';
import { LeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import { ResponsiveForm } from '../../components/responsive/ResponsiveForm';

const { Title, Text } = Typography;
const { TextArea } = Input;

const StoreCheckout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [cartTotal, setCartTotal] = useState(0);

  useEffect(() => {
    const cartId = localStorage.getItem('store_cart_id');
    if (!cartId) {
      message.warning(t('storefront.cart_empty'));
      navigate('/store/cart');
    }
    calculateTotal();
  }, []);

  const calculateTotal = async () => {
    try {
      const sessionId = localStorage.getItem('store_session_id');
      const cartRes = await api.post('/api/storefront/cart', { session_id: sessionId });
      const lines = cartRes.data.lines || [];

      let total = 0;
      for (const line of lines) {
        const prodRes = await api.get(`/api/storefront/products/${line.item_id}`);
        const price = prodRes.data.sale_price || prodRes.data.price || 0;
        total += price * line.quantity;
      }

      setCartTotal(total);
    } catch (err) {
      console.error('Failed to calculate total:', err);
    }
  };

  const onFinish = async (values: any) => {
    try {
      setSubmitting(true);
      const cartId = localStorage.getItem('store_cart_id');

      const res = await api.post(`/api/storefront/cart/${cartId}/checkout`, {
        customer_name: values.name,
        customer_email: values.email,
        customer_phone: values.phone,
        customer_address: values.address,
        payment_method: 'cash',
      });

      // Clear cart
      localStorage.removeItem('store_cart_id');

      message.success(t('storefront.order_placed'));
      navigate(`/store/order/${res.data.order_id}?email=${values.email}`);
    } catch (err) {
      message.error(t('storefront.checkout_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { title: t('storefront.customer_info') },
    { title: t('storefront.review_order') },
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate('/store/cart')}
          style={{ marginBottom: 16 }}
        >
          {t('storefront.back_to_cart')}
        </Button>

        <Card>
          <Title level={2}>{t('storefront.checkout')}</Title>

          <Steps current={step} items={steps} style={{ marginBottom: 32 }} />

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
          >
            {step === 0 && (
              <>
                <Form.Item
                  label={t('storefront.full_name')}
                  name="name"
                  rules={[{ required: true, message: t('storefront.name_required') }]}
                >
                  <Input size="large" />
                </Form.Item>

                <Form.Item
                  label={t('storefront.email')}
                  name="email"
                  rules={[
                    { required: true, message: t('storefront.email_required') },
                    { type: 'email', message: t('storefront.email_invalid') },
                  ]}
                >
                  <Input size="large" />
                </Form.Item>

                <Form.Item
                  label={t('storefront.phone')}
                  name="phone"
                >
                  <Input size="large" />
                </Form.Item>

                <Form.Item
                  label={t('storefront.address')}
                  name="address"
                >
                  <TextArea rows={3} />
                </Form.Item>

                <Button
                  type="primary"
                  size="large"
                  onClick={() => {
                    form.validateFields().then(() => setStep(1));
                  }}
                  block
                >
                  {t('storefront.continue')}
                </Button>
              </>
            )}

            {step === 1 && (
              <>
                <Card style={{ marginBottom: 24, background: '#fafafa' }}>
                  <Title level={4}>{t('storefront.order_summary')}</Title>
                  <Row justify="space-between" style={{ marginTop: 16 }}>
                    <Text strong>{t('storefront.total')}:</Text>
                    <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                      {cartTotal.toLocaleString()} {t('currency')}
                    </Title>
                  </Row>
                </Card>

                <Row gutter={16}>
                  <Col span={12}>
                    <Button
                      size="large"
                      onClick={() => setStep(0)}
                      block
                    >
                      {t('storefront.back')}
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      type="primary"
                      size="large"
                      htmlType="submit"
                      loading={submitting}
                      icon={<CheckCircleOutlined />}
                      block
                    >
                      {t('storefront.place_order')}
                    </Button>
                  </Col>
                </Row>
              </>
            )}
</Form>
        </Card>
      </div>
    </div>
  );
};

export default StoreCheckout;
