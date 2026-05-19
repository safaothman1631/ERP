import React, { useEffect, useState } from 'react';
import { Card, Tag, Button, Typography } from 'antd';
import { LeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Title, Text } = Typography;

const PortalInvoices: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const jwt = sessionStorage.getItem('portal_jwt');
    if (!jwt) {
      message.warning(t('portal.session_expired'));
      navigate('/portal/login');
      return;
    }

    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const jwt = sessionStorage.getItem('portal_jwt');
      const res = await api.get('/api/portal/me/invoices', {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      setInvoices(res.data.invoices || []);
    } catch (err) {
      message.error(t('portal.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('portal.invoice_number'),
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (text: string) => (
        <span>
          <FileTextOutlined style={{ marginRight: 8 }} />
          {text}
        </span>
      ),
    },
    {
      title: t('portal.date'),
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: t('portal.due_date'),
      dataIndex: 'due_date',
      key: 'due_date',
    },
    {
      title: t('portal.amount'),
      dataIndex: 'total',
      key: 'total',
      render: (val: number) => `${val?.toLocaleString()} ${t('currency')}`,
    },
    {
      title: t('portal.balance'),
      dataIndex: 'balance',
      key: 'balance',
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
          sent: 'blue',
          paid: 'green',
          partial: 'orange',
          overdue: 'red',
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
          <Title level={2}>{t('portal.my_invoices')}</Title>

          <ResponsiveTableAdapter
            dataSource={invoices}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: t('portal.no_invoices') }}
          />
        </Card>
      </div>
    </div>
  );
};

export default PortalInvoices;
