import React, { useState, useEffect } from 'react';
import { Card, Button, Empty, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import vendorApi from '../../api/vendorPortal';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Title } = Typography;

const VendorPortalPayments: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const res = await vendorApi.get('/api/vendor-portal/me/payments');
      setPayments(res.data.payments || []);
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.error(t('vendor_portal.token_invalid'));
        navigate('/vendor-portal/login');
      } else {
        message.error(t('portal.load_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('vendor_portal.payment_date'),
      dataIndex: 'payment_date',
      key: 'payment_date',
      render: (date: string, record: any) => date || record.date || '-',
    },
    {
      title: t('vendor_portal.payment_reference'),
      dataIndex: 'reference',
      key: 'reference',
      render: (ref: string) => ref || '-',
    },
    {
      title: t('vendor_portal.payment_method'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (method: string) => method || '-',
    },
    {
      title: t('vendor_portal.payment_amount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => val?.toFixed(2) || '0.00',
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: any = {
          completed: 'green',
          pending: 'orange',
          failed: 'red',
        };
        return (
          <Tag color={colors[status] || 'default'}>
            {status || t('completed')}
          </Tag>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>{t('vendor_portal.my_payments')}</Title>
        <Button onClick={() => navigate('/vendor-portal')}>
          {t('back')}
        </Button>
      </div>

      <Card style={{ marginTop: 24 }}>
        <ResponsiveTableAdapter
          dataSource={payments}
          columns={columns}
          loading={loading}
          rowKey="id"
          locale={{
            emptyText: <Empty description={t('vendor_portal.no_payments')} />,
          }}
        />
      </Card>
    </div>
  );
};

export default VendorPortalPayments;
