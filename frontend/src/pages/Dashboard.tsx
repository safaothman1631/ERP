import React, { useEffect, useRef, useState } from 'react';
import { Row, Col, Card, Button, Space, Timeline, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DollarOutlined, TeamOutlined, WarningOutlined,
  RiseOutlined, FallOutlined, PlusOutlined,
  FileTextOutlined, BarChartOutlined, WalletOutlined,
  ClockCircleOutlined, CheckCircleOutlined, InboxOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api, { backendRetryConfig, isBackendUnavailableError } from '../api';
import { PageHeader, KpiCard, StatusTag, EmptyState, LoadingSkeleton } from '../design-system';
import DashboardHero from '../components/DashboardHero';
import { palette, space, radius } from '../theme/tokens';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { ResponsiveChart } from '../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../i18n/types';
import { HelpIcon } from '../help/HelpIcon';
import { InlineError } from '../components/feedback/InlineError';
import { useLoadingState } from '../hooks/useLoadingState';

const { Text, Title } = Typography;

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const initialFetchDoneRef = useRef(false);
  const { showSkeleton } = useLoadingState(loading);

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
      sectionId="dashboard.kpis"
      extra={
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/invoices/new')}>
          {t('new_invoice')}
        </Button>
      }
    />
  );

  if (showSkeleton) return (
    <div>
      {pageHeader}
      <LoadingSkeleton variant="card" />
    </div>
  );
  if (backendUnavailable) return (
    <div>
      {pageHeader}
      <InlineError messageKey="error_backend_unavailable" onRetry={() => void fetchDashboard(true)} />
    </div>
  );
  if (!data) return (
    <div>
      {pageHeader}
      <InlineError messageKey="error_loading" onRetry={() => void fetchDashboard(true)} />
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

      {/* KPI cards — 2×2 on mobile/tablet, 4-col on desktop — Requirement 4.5, 4.8, 4.9 */}
      <Row gutter={[space.md, space.md]} data-section-id="dashboard.kpis">
        <Col xs={12} sm={12} lg={6}>
          <KpiCard
            title={t('total_receivable')}
            value={fmtIQD(data.total_receivable)}
            suffix={` ${currencySuffix}`}
            icon={<DollarOutlined />}
            tone="success"
            onClick={() => navigate('/invoices?status=open')}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <KpiCard
            title={t('total_payable')}
            value={fmtIQD(data.total_payable)}
            suffix={` ${currencySuffix}`}
            icon={<FallOutlined />}
            tone="danger"
            onClick={() => navigate('/bills?status=open')}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <KpiCard
            title={t('income_this_month')}
            value={fmtIQD(data.income_this_month)}
            suffix={` ${currencySuffix}`}
            icon={<RiseOutlined />}
            tone="primary"
            onClick={() => navigate('/reports/advanced')}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
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
      <Card style={cardStyle} title={<Space align="center"><Title level={5} style={{ margin: 0 }}>{t('quick_actions')}</Title><HelpIcon sectionId="dashboard.quickActions" /></Space>} data-section-id="dashboard.quickActions">
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
      <Card style={cardStyle} title={<Space align="center"><Title level={5} style={{ margin: 0 }}>{t('income')} / {t('expenses')}</Title><HelpIcon sectionId="dashboard.incomeExpenseChart" /></Space>} data-section-id="dashboard.incomeExpenseChart">
        <ResponsiveChart
          legendItems={[
            { id: 'income', labelKey: asTranslationKey('income'), color: palette.success },
            { id: 'expense', labelKey: asTranslationKey('expenses'), color: palette.danger },
          ]}
          minMobileBlockSize={320}
        >
          <BarChart data={data.income_expense_chart} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.ink100} />
            <XAxis dataKey="month" tick={{ fill: palette.ink500, fontSize: 12 }} />
            <YAxis tick={{ fill: palette.ink500, fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: radius.md, border: `1px solid ${palette.border}`, boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}
              formatter={(value) => [`${(value as number)?.toLocaleString()} ${currencySuffix}`]}
            />
            <Bar dataKey="income"  fill={palette.success} name={t('income')}   radius={[8, 8, 0, 0]} />
            <Bar dataKey="expense" fill={palette.danger}  name={t('expenses')} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveChart>
      </Card>

      {/* Recent invoices */}
      <Card
        style={cardStyle}
        title={<Space align="center"><Title level={5} style={{ margin: 0 }}>{t('invoices')}</Title><HelpIcon sectionId="dashboard.recentInvoices" /></Space>}
        extra={<Button type="link" onClick={() => navigate('/invoices')}>{t('all')} {'>'}</Button>}
        data-section-id="dashboard.recentInvoices"
      >
        {data.recent_invoices?.length > 0 ? (
          <ResponsiveTableAdapter dataSource={data.recent_invoices} columns={invoiceCols} rowKey="id" pagination={false} size="small" />
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
      <Card style={cardStyle} title={<Space align="center"><Title level={5} style={{ margin: 0 }}>{t('activities')}</Title><HelpIcon sectionId="dashboard.activities" /></Space>} data-section-id="dashboard.activities">
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
