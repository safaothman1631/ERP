import React, { useEffect, useState } from 'react';
import { Button, Typography } from 'antd';
import { LeftOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag, type StatusKind } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Text } = Typography;

const PortalOrders: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const jwt = sessionStorage.getItem('portal_jwt');
    if (!jwt) {
      message.warning(t('portal.session_expired'));
      navigate('/portal/login');
      return;
    }

    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const jwt = sessionStorage.getItem('portal_jwt');
      const res = await api.get('/api/portal/me/orders', {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      setOrders(res.data.orders || []);
    } catch (_err) {
      message.error(t('portal.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('portal.order_id'),
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => (
        <span>
          <ShoppingOutlined style={{ marginInlineEnd: 8 }} />
          {text.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: t('portal.order_date'),
      dataIndex: 'order_date',
      key: 'order_date',
    },
    {
      title: t('portal.source'),
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => <StatusTag status="default" label={source || 'manual'} />,
    },
    {
      title: t('portal.total'),
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (val: number) => (
        <Text strong>{val?.toLocaleString()} {t('currency')}</Text>
      ),
    },
    {
      title: t('portal.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const kindMap: Record<string, StatusKind> = {
          draft: 'default',
          confirmed: 'info',
          processing: 'warning',
          shipped: 'info',
          delivered: 'success',
          cancelled: 'error',
        };
        return <StatusTag status={kindMap[status] || 'default'} label={status} />;
      },
    },
  ];

  return (
    <div style={{ padding: '24px', background: 'var(--surface-2)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate('/portal')}
          style={{ marginBottom: 16 }}
        >
          {t('portal.back_to_dashboard')}
        </Button>

        <PageHeader title={t('portal.my_orders')} />

        <SectionCard padded={false}>
          <ResponsiveTableAdapter
            dataSource={orders}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: t('portal.no_orders') }}
          />
        </SectionCard>
      </div>
    </div>
  );
};

export default PortalOrders;
