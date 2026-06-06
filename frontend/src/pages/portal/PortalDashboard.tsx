import React, { useEffect, useState } from 'react';
import { Button, Typography, List } from 'antd';
import {
  FileTextOutlined,
  ShoppingOutlined,
  DollarOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import { PageHeader, SectionCard, KpiCard } from '../../design-system';
import { space } from '../../theme/tokens';

const { Text } = Typography;

const PortalDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_due: 0,
    overdue: 0,
    invoices_count: 0,
    orders_count: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);

  useEffect(() => {
    const jwt = sessionStorage.getItem('portal_jwt');
    if (!jwt) {
      message.warning(t('portal.session_expired'));
      navigate('/portal/login');
      return;
    }

    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const jwt = sessionStorage.getItem('portal_jwt');

      const [statementsRes, invoicesRes, ordersRes] = await Promise.all([
        api.get('/api/portal/me/statements', {
          headers: { Authorization: `Bearer ${jwt}` },
        }),
        api.get('/api/portal/me/invoices', {
          headers: { Authorization: `Bearer ${jwt}` },
        }),
        api.get('/api/portal/me/orders', {
          headers: { Authorization: `Bearer ${jwt}` },
        }),
      ]);

      setStats({
        total_due: statementsRes.data.total_due || 0,
        overdue: statementsRes.data.overdue || 0,
        invoices_count: invoicesRes.data.total || 0,
        orders_count: ordersRes.data.total || 0,
      });

      setRecentInvoices(statementsRes.data.recent_invoices || []);
    } catch (_err) {
      message.error(t('portal.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('portal_jwt');
    sessionStorage.removeItem('portal_email');
    navigate('/portal/login');
  };

  return (
    <div style={{ padding: '24px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <PageHeader
          title={t('portal.dashboard')}
          subtitle={sessionStorage.getItem('portal_email') || undefined}
          extra={
            <Button
              icon={<LogoutOutlined />}
              onClick={logout}
            >
              {t('portal.logout')}
            </Button>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: space.md, marginBottom: space.lg }}>
          <KpiCard
            title={t('portal.total_due')}
            value={`${stats.total_due.toLocaleString()} ${t('currency')}`}
            icon={<DollarOutlined />}
            tone="info"
          />
          <KpiCard
            title={t('portal.overdue')}
            value={`${stats.overdue.toLocaleString()} ${t('currency')}`}
            icon={<DollarOutlined />}
            tone="danger"
          />
          <KpiCard
            title={t('portal.invoices')}
            value={stats.invoices_count}
            icon={<FileTextOutlined />}
            tone="primary"
            onClick={() => navigate('/portal/invoices')}
          />
          <KpiCard
            title={t('portal.orders')}
            value={stats.orders_count}
            icon={<ShoppingOutlined />}
            tone="primary"
            onClick={() => navigate('/portal/orders')}
          />
        </div>

        <SectionCard title={t('portal.recent_invoices')}>
          <List
            loading={loading}
            dataSource={recentInvoices}
            renderItem={(invoice: any) => (
              <List.Item>
                <List.Item.Meta
                  title={`${t('portal.invoice')} #${invoice.invoice_number}`}
                  description={`${t('portal.date')}: ${invoice.date}`}
                />
                <div>
                  <Text strong>{invoice.balance?.toLocaleString()} {t('currency')}</Text>
                  <br />
                  <Text type="secondary">{invoice.status}</Text>
                </div>
              </List.Item>
            )}
            locale={{ emptyText: t('portal.no_invoices') }}
          />
        </SectionCard>
      </div>
    </div>
  );
};

export default PortalDashboard;
