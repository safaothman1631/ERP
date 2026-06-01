import React, { useState, useEffect } from 'react';
import { Button, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import vendorApi from '../../api/vendorPortal';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { PageHeader, SectionCard, StatusTag, type StatusKind } from '../../design-system';

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
      align: 'right' as const,
      render: (val: number) => val?.toFixed(2) || '0.00',
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const kinds: Record<string, StatusKind> = {
          completed: 'success',
          pending: 'warning',
          failed: 'error',
        };
        return (
          <StatusTag status={kinds[status] || 'default'} label={status || t('completed')} />
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('vendor_portal.my_payments')}
        extra={
          <Button onClick={() => navigate('/vendor-portal')}>
            {t('back')}
          </Button>
        }
      />

      <SectionCard padded={false}>
        <ResponsiveTableAdapter
          dataSource={payments}
          columns={columns}
          loading={loading}
          rowKey="id"
          locale={{
            emptyText: <Empty description={t('vendor_portal.no_payments')} />,
          }}
        />
      </SectionCard>
    </div>
  );
};

export default VendorPortalPayments;
