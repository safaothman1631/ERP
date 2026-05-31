import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Typography, List } from 'antd';
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

const { Title, Text } = Typography;

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
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2}>{t('portal.dashboard')}</Title>
            <Text type="secondary">
              {sessionStorage.getItem('portal_email')}
            </Text>
          </Col>
          <Col>
            <Button
              icon={<LogoutOutlined />}
              onClick={logout}
            >
              {t('portal.logout')}
            </Button>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('portal.total_due')}
                value={stats.total_due}
                prefix={<DollarOutlined />}
                suffix={t('currency')}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('portal.overdue')}
                value={stats.overdue}
                prefix={<DollarOutlined />}
                suffix={t('currency')}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('portal.invoices')}
                value={stats.invoices_count}
                prefix={<FileTextOutlined />}
              />
              <Button
                type="link"
                onClick={() => navigate('/portal/invoices')}
                style={{ padding: 0, marginTop: 8 }}
              >
                {t('portal.view_all')}
              </Button>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={t('portal.orders')}
                value={stats.orders_count}
                prefix={<ShoppingOutlined />}
              />
              <Button
                type="link"
                onClick={() => navigate('/portal/orders')}
                style={{ padding: 0, marginTop: 8 }}
              >
                {t('portal.view_all')}
              </Button>
            </Card>
          </Col>
        </Row>

        <Card title={t('portal.recent_invoices')} loading={loading}>
          <List
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
        </Card>
      </div>
    </div>
  );
};

export default PortalDashboard;
