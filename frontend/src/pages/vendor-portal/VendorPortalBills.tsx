import React, { useState, useEffect } from 'react';
import { Card, Tag, Button, Select, Space, Empty, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import vendorApi from '../../api/vendorPortal';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Title } = Typography;

const VendorPortalBills: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadBills();
  }, [statusFilter]);

  const loadBills = async () => {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/api/vendor-portal/me/bills?status=${statusFilter}`
        : '/api/vendor-portal/me/bills';
      const res = await vendorApi.get(url);
      setBills(res.data.bills || []);
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
      title: t('vendor_portal.bill_number'),
      dataIndex: 'bill_number',
      key: 'bill_number',
    },
    {
      title: t('vendor_portal.bill_date'),
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: t('vendor_portal.due_date'),
      dataIndex: 'due_date',
      key: 'due_date',
    },
    {
      title: t('vendor_portal.bill_status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: any = {
          pending_review: 'orange',
          draft: 'default',
          approved: 'blue',
          open: 'cyan',
          paid: 'green',
          partially_paid: 'lime',
          void: 'red',
        };
        return (
          <Tag color={colors[status] || 'default'}>
            {t(`vendor_portal.${status}`) || status}
          </Tag>
        );
      },
    },
    {
      title: t('invoices.total'),
      dataIndex: 'total',
      key: 'total',
      render: (val: number) => val?.toFixed(2) || '0.00',
    },
    {
      title: t('invoices.balance'),
      dataIndex: 'balance_due',
      key: 'balance_due',
      render: (val: number) => val?.toFixed(2) || '0.00',
    },
    {
      title: t('vendor_portal.po_number'),
      dataIndex: 'po_id',
      key: 'po_id',
      render: (poId: string) => poId || '-',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>{t('vendor_portal.my_bills')}</Title>
        <Space>
          <Button onClick={() => navigate('/vendor-portal/submit-bill')}>
            {t('vendor_portal.submit_bill')}
          </Button>
          <Button onClick={() => navigate('/vendor-portal')}>
            {t('back')}
          </Button>
        </Space>
      </div>

      <Card style={{ marginTop: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 200 }}
            allowClear
            placeholder={t('filter_by_status')}
            options={[
              { label: t('vendor_portal.pending_review'), value: 'pending_review' },
              { label: t('vendor_portal.approved'), value: 'approved' },
              { label: t('vendor_portal.paid'), value: 'paid' },
              { label: t('all'), value: '' },
            ]}
          />
        </Space>

        <ResponsiveTableAdapter
          dataSource={bills}
          columns={columns}
          loading={loading}
          rowKey="id"
          locale={{
            emptyText: <Empty description={t('vendor_portal.no_bills')} />,
          }}
        />
      </Card>
    </div>
  );
};

export default VendorPortalBills;
