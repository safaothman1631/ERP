import React, { useEffect, useState } from 'react';
import { Card, Result, Button, Typography } from 'antd';
import { CheckCircleOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { KeyValueGrid } from '../../design-system';

const { Title, Text } = Typography;

const StoreOrderConfirm: React.FC = () => {
  const { t } = useTranslation();
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const email = searchParams.get('email');
      if (!email) {
        navigate('/store');
        return;
      }

      const res = await api.get(`/api/storefront/orders/${orderId}/status`, {
        params: { email },
      });

      setOrder(res.data);
    } catch (err) {
      console.error('Failed to load order:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Text>{t('loading')}</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: 'var(--surface-2)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Card>
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: 'var(--success-500)' }} />}
            title={t('storefront.order_confirmed')}
            subTitle={t('storefront.order_confirmation_message')}
            extra={[
              <Button
                type="primary"
                key="store"
                icon={<ShoppingOutlined />}
                onClick={() => navigate('/store')}
              >
                {t('storefront.continue_shopping')}
              </Button>,
            ]}
          />

          {order && (
            <Card style={{ marginTop: 24 }}>
              <Title level={4}>{t('storefront.order_details')}</Title>
              <KeyValueGrid
                columns={1}
                items={[
                  { label: t('storefront.order_id'), value: order.id },
                  { label: t('storefront.customer'), value: order.customer_name },
                  { label: t('storefront.order_date'), value: order.order_date },
                  { label: t('storefront.status'), value: order.status },
                  { label: t('storefront.total'), value: <Text strong style={{ fontSize: 18 }}>{order.total?.toLocaleString()} {t('currency')}</Text> },
                ]}
              />
            </Card>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StoreOrderConfirm;
