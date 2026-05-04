import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Typography } from 'antd';
import { LeftOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';

const { Title, Text } = Typography;

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
    } catch (err) {
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
          <ShoppingOutlined style={{ marginRight: 8 }} />
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
      render: (source: string) => <Tag>{source || 'manual'}</Tag>,
    },
    {
      title: t('portal.total'),
      dataIndex: 'total',
      key: 'total',
      render: (val: number) => (
        <Text strong>{val?.toLocaleString()} {t('currency')}</Text>
      ),
    },
    {
      title: t('portal.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          draft: 'default',
          confirmed: 'blue',
          processing: 'orange',
          shipped: 'cyan',
          delivered: 'green',
          cancelled: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate('/portal')}
          style={{ marginBottom: 16 }}
        >
          {t('portal.back_to_dashboard')}
        </Button>

        <Card>
          <Title level={2}>{t('portal.my_orders')}</Title>

          <Table
            dataSource={orders}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: t('portal.no_orders') }}
          />
        </Card>
      </div>
    </div>
  );
};

export default PortalOrders;
