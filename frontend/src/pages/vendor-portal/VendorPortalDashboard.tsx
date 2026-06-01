import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Button, Typography, Empty } from 'antd';
import { ShoppingOutlined, FileTextOutlined, DollarOutlined, WarningOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import vendorApi from '../../api/vendorPortal';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';
import { InlineError } from '../../components/feedback/InlineError';
import { useLoadingState } from '../../hooks/useLoadingState';

const { Title, Text: _Text } = Typography;

interface DashboardStats {
  open_pos_count: number;
  open_pos_value: number;
  pending_bills_count: number;
  paid_bills_total_30d: number;
  outstanding_balance: number;
}

const VendorPortalDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const { showSkeleton } = useLoadingState(loading);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const [dashRes, posRes, billsRes] = await Promise.all([
        vendorApi.get('/api/vendor-portal/me/dashboard'),
        vendorApi.get('/api/vendor-portal/me/purchase-orders?status=open'),
        vendorApi.get('/api/vendor-portal/me/bills'),
      ]);

      setStats(dashRes.data);
      setRecentPOs(posRes.data.purchase_orders.slice(0, 5));
      setRecentBills(billsRes.data.bills.slice(0, 5));
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.error(t('vendor_portal.token_invalid'));
        handleLogout();
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('vendor_jwt');
    localStorage.removeItem('vendor_email');
    localStorage.removeItem('vendor_contact_id');
    navigate('/vendor-portal/login');
  };

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const poColumns = [
    {
      title: t('vendor_portal.po_number'),
      dataIndex: 'number',
      key: 'number',
    },
    {
      title: t('vendor_portal.po_date'),
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: t('vendor_portal.po_total'),
      dataIndex: 'total',
      key: 'total',
      render: (val: number) => `${val?.toFixed(2) || '0.00'}`,
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, _record: any) => (
        <Button
          type="link"
          onClick={() => navigate(`/vendor-portal/purchase-orders`)}
        >
          {t('vendor_portal.view_po')}
        </Button>
      ),
    },
  ];

  const billColumns = [
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
      title: t('vendor_portal.bill_status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => t(`vendor_portal.${status}`) || status,
    },
  ];

  if (error) {
    return <InlineError onRetry={loadDashboard} />;
  }

  if (showSkeleton) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 100 }}>
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>{t('vendor_portal.dashboard')}</Title>
        <Button
          icon={<LogoutOutlined />}
          onClick={handleLogout}
        >
          {t('vendor_portal.logout')}
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('vendor_portal.open_pos_count')}
              value={stats?.open_pos_count || 0}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: 'var(--success-500)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('vendor_portal.open_pos_value')}
              value={stats?.open_pos_value || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: 'var(--info-500)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('vendor_portal.pending_bills')}
              value={stats?.pending_bills_count || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: 'var(--warning-500)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('vendor_portal.payments_30d')}
              value={stats?.paid_bills_total_30d || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: 'var(--success-500)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={t('vendor_portal.outstanding_balance')}
              value={stats?.outstanding_balance || 0}
              prefix={<WarningOutlined />}
              precision={2}
              valueStyle={{ color: 'var(--danger-500)' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card 
            title={t('vendor_portal.my_pos')}
            extra={
              <Button type="link" onClick={() => navigate('/vendor-portal/purchase-orders')}>
                {t('view_all')}
              </Button>
            }
          >
            {recentPOs.length > 0 ? (
              <ResponsiveTableAdapter
                dataSource={recentPOs}
                columns={poColumns}
                pagination={false}
                size="small"
                rowKey="id"
              />
            ) : (
              <Empty description={t('vendor_portal.no_pos')} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title={t('vendor_portal.my_bills')}
            extra={
              <Button type="link" onClick={() => navigate('/vendor-portal/bills')}>
                {t('view_all')}
              </Button>
            }
          >
            {recentBills.length > 0 ? (
              <ResponsiveTableAdapter
                dataSource={recentBills}
                columns={billColumns}
                pagination={false}
                size="small"
                rowKey="id"
              />
            ) : (
              <Empty description={t('vendor_portal.no_bills')} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VendorPortalDashboard;
