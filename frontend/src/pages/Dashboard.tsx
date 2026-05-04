import React, { useEffect, useRef, useState } from 'react';
import { Row, Col, Card, Table, Spin, Button, Space, Timeline, Typography, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DollarOutlined, TeamOutlined, WarningOutlined,
  RiseOutlined, FallOutlined, PlusOutlined,
  FileTextOutlined, BarChartOutlined, WalletOutlined,
  ClockCircleOutlined, CheckCircleOutlined, InboxOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api, { backendRetryConfig, isBackendUnavailableError } from '../api';
import { PageHeader, KpiCard, StatusTag, EmptyState } from '../design-system';
import DashboardHero from '../components/DashboardHero';
import { palette, space, radius } from '../theme/tokens';

const { Text, Title } = Typography;

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const initialFetchDoneRef = useRef(false);

  const fetchDashboard = async (forceRetry = false) => {
    setLoading(true);
    try {
      const res = await api.get('/api/dashboard', forceRetry ? backendRetryConfig : undefined);
      setData(res.data);
      setBackendUnavailable(false);
    } catch (error) {
      setData(null);
      setBackendUnavailable(isBackendUnavailableError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialFetchDoneRef.current) {
      return;
    }
    initialFetchDoneRef.current = true;
    void fetchDashboard();
  }, []);

  const currencySuffix = 'IQD';

  const pageHeader = (
    <PageHeader
      title={t('dashboard')}
      subtitle={t('overview_subtitle')}
      helpKey="dashboard"
      extra={
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/invoices/new')}>
          {t('new_invoice')}
        </Button>
      }
    />
  );

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (backendUnavailable) return (
    <div>
      {pageHeader}
      <EmptyState
        icon={<WarningOutlined />}
        title={t('backend_unavailable_title')}
        description={t('backend_unavailable_description')}
        actionLabel={t('retry')}
        onAction={() => void fetchDashboard(true)}
      />
    </div>
  );
  if (!data) return (
    <div>
      {pageHeader}
      <Empty description={t('error')} style={{ marginTop: 100 }}>
        <Button onClick={() => void fetchDashboard(true)}>{t('retry')}</Button>
      </Empty>
    </div>
  );

  const fmtIQD = (v: number) => `${new Intl.NumberFormat('en-US').format(v || 0)}`;

  const invoiceCols = [
    { title: '#', dataIndex: 'invoice_number', key: 'invoice_number',
      render: (v: string) => <Text strong style={{ color: palette.primary600 }}>{v}</Text> },
    { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
    { title: t('total'), dataIndex: 'total', key: 'total',
      render: (v: number) => <Text strong>{fmtIQD(v)} {currencySuffix}</Text> },
    { title: t('status'), dataIndex: 'status', key: 'status',
      render: (s: string) => <StatusTag status={s} label={t(s)} /> },
  ];

  const quickActions = [
    { icon: <FileTextOutlined />, label: t('new_invoice'), onClick: () => navigate('/invoices/new') },
    { icon: <WalletOutlined />, label: t('expenses'), onClick: () => navigate('/expenses') },
    { icon: <DollarOutlined />, label: t('payments'), onClick: () => navigate('/banking') },
    { icon: <BarChartOutlined />, label: t('reports'), onClick: () => navigate('/reports') },
  ];

  const cardStyle: React.CSSProperties = { borderRadius: radius.lg, marginTop: space.lg };

  return (
    <div>
      {pageHeader}

      {/* Premium greeting hero */}
      <DashboardHero onCreateInvoice={() => navigate('/invoices/new')} />

      {/* KPI cards */}
      <Row gutter={[space.md, space.md]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('total_receivable')}
            value={fmtIQD(data.total_receivable)}
            suffix={` ${currencySuffix}`}
            icon={<DollarOutlined />}
            tone="success"
            onClick={() => navigate('/invoices?status=open')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('total_payable')}
            value={fmtIQD(data.total_payable)}
            suffix={` ${currencySuffix}`}
            icon={<FallOutlined />}
            tone="danger"
            onClick={() => navigate('/bills?status=open')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('income_this_month')}
            value={fmtIQD(data.income_this_month)}
            suffix={` ${currencySuffix}`}
            icon={<RiseOutlined />}
            tone="primary"
            onClick={() => navigate('/reports/advanced')}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title={t('expenses_this_month')}
            value={fmtIQD(data.expenses_this_month)}
            suffix={` ${currencySuffix}`}
            icon={<WarningOutlined />}
            tone="warning"
            onClick={() => navigate('/expenses')}
          />
        </Col>
      </Row>

      {/* Secondary KPIs */}
      <Row gutter={[space.md, space.md]} style={{ marginTop: space.md }}>
        <Col xs={24} sm={12}>
          <KpiCard
            title={t('total_contacts')}
            value={data.total_contacts}
            icon={<TeamOutlined />}
            tone="info"
            onClick={() => navigate('/contacts')}
          />
        </Col>
        <Col xs={24} sm={12}>
          <KpiCard
            title={t('overdue_invoices')}
            value={data.overdue_invoices}
            icon={data.overdue_invoices > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
            tone={data.overdue_invoices > 0 ? 'danger' : 'success'}
            onClick={() => navigate('/invoices?status=overdue')}
          />
        </Col>
      </Row>

      {/* Quick actions */}
      <Card style={cardStyle} title={<Title level={5} style={{ margin: 0 }}>{t('quick_actions')}</Title>}>
        <Row gutter={[space.sm, space.sm]}>
          {quickActions.map((action, i) => (
            <Col xs={12} sm={6} key={i}>
              <Button
                block
                size="large"
                onClick={action.onClick}
                icon={action.icon}
                style={{ height: 56, borderRadius: radius.md, textAlign: 'start', fontWeight: 500 }}
              >
                {action.label}
              </Button>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Income vs Expense chart */}
      <Card style={cardStyle} title={<Title level={5} style={{ margin: 0 }}>{t('income')} / {t('expenses')}</Title>}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data.income_expense_chart} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.ink100} />
            <XAxis dataKey="month" tick={{ fill: palette.ink500, fontSize: 12 }} />
            <YAxis tick={{ fill: palette.ink500, fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: radius.md, border: `1px solid ${palette.border}`, boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}
              formatter={(value) => [`${(value as number)?.toLocaleString()} ${currencySuffix}`]}
            />
            <Legend wrapperStyle={{ paddingTop: space.md }} />
            <Bar dataKey="income"  fill={palette.success} name={t('income')}   radius={[8, 8, 0, 0]} />
            <Bar dataKey="expense" fill={palette.danger}  name={t('expenses')} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent invoices */}
      <Card
        style={cardStyle}
        title={<Title level={5} style={{ margin: 0 }}>{t('invoices')}</Title>}
        extra={<Button type="link" onClick={() => navigate('/invoices')}>{t('all')} {'>'}</Button>}
      >
        {data.recent_invoices?.length > 0 ? (
          <Table dataSource={data.recent_invoices} columns={invoiceCols} rowKey="id" pagination={false} size="small" />
        ) : (
          <EmptyState
            icon={<InboxOutlined />}
            title={t('no_invoices')}
            description={t('no_invoices_hint')}
            actionLabel={t('new_invoice')}
            onAction={() => navigate('/invoices/new')}
          />
        )}
      </Card>

      {/* Activity timeline */}
      <Card style={cardStyle} title={<Title level={5} style={{ margin: 0 }}>{t('activities')}</Title>}>
        <Timeline
          items={[
            { color: 'green', icon: <CheckCircleOutlined />, content: (
              <Space size="small">
                <Text type="secondary">{t('today')}</Text>
                <span>-</span>
                <span>{t('income_this_month')}: <Text strong style={{ color: palette.success }}>{fmtIQD(data.income_this_month)} {currencySuffix}</Text></span>
              </Space>
            )},
            { color: 'red', icon: <FallOutlined />, content: (
              <Space size="small">
                <Text type="secondary">{t('today')}</Text>
                <span>-</span>
                <span>{t('expenses_this_month')}: <Text strong style={{ color: palette.danger }}>{fmtIQD(data.expenses_this_month)} {currencySuffix}</Text></span>
              </Space>
            )},
            { color: data.overdue_invoices > 0 ? 'red' : 'green', icon: <ClockCircleOutlined />, content: (
              <span>{t('overdue_invoices')}: <Text strong>{data.overdue_invoices}</Text></span>
            )},
            { color: 'blue', icon: <TeamOutlined />, content: (
              <span>{t('total_contacts')}: <Text strong>{data.total_contacts}</Text></span>
            )},
          ]}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
