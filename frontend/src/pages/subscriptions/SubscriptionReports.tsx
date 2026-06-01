import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, DollarOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../api';
import { PageHeader, StatusTag } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface MRRData {
  current_mrr: number;
  previous_mrr: number;
  growth_pct: number;
  active_count: number;
  by_plan: Array<{ plan: string; mrr: number; count: number }>;
}

interface ChurnData {
  period_days: number;
  active_at_start: number;
  cancelled: number;
  churn_pct: number;
  remaining: number;
}

const SubscriptionReports: React.FC = () => {
  const { t } = useTranslation();
  const [mrrData, setMrrData] = useState<MRRData | null>(null);
  const [arrData, setArrData] = useState<{ arr: number; mrr: number; growth_pct: number } | null>(null);
  const [churnData, setChurnData] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [mrrRes, arrRes, churnRes] = await Promise.all([
        api.get('/api/subscriptions/reports/mrr'),
        api.get('/api/subscriptions/reports/arr'),
        api.get('/api/subscriptions/reports/churn', { params: { period: 30 } }),
      ]);
      setMrrData(mrrRes.data);
      setArrData(arrRes.data);
      setChurnData(churnRes.data);
    } catch {
      // Silent fail - show empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReports();
  }, []);

  const chartData = mrrData
    ? [
        { month: t('subscription.previous_month'), mrr: mrrData.previous_mrr },
        { month: t('subscription.current_month'), mrr: mrrData.current_mrr },
      ]
    : [];

  const planColumns = [
    {
      title: t('subscription.plan'),
      dataIndex: 'plan',
      key: 'plan',
    },
    {
      title: t('subscription.mrr'),
      dataIndex: 'mrr',
      key: 'mrr',
      render: (mrr: number) => `${mrr.toLocaleString()} IQD`,
    },
    {
      title: t('subscription.subscriber_count'),
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <StatusTag status="info" label={count} />,
    },
  ];

  return (
    <div style={{ padding: space.lg }}>
      <PageHeader
        title={t('subscription.reports')}
        subtitle={t('subscription.reports_subtitle')}
      />
      
      <Row gutter={[16, 16]} style={{ marginTop: space.md }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('subscription.mrr')}
              value={mrrData?.current_mrr || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="IQD"
              valueStyle={{ color: mrrData && mrrData.growth_pct > 0 ? 'var(--success-500)' : 'var(--danger-500)' }}
            />
            {mrrData && (
              <div style={{ marginTop: space.sm }}>
                {mrrData.growth_pct > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                <span style={{ marginInlineStart: space.xs }}>
                  {Math.abs(mrrData.growth_pct).toFixed(2)}% {t('subscription.vs_last_month')}
                </span>
              </div>
            )}
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('subscription.arr')}
              value={arrData?.arr || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="IQD"
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('subscription.active_subscriptions')}
              value={mrrData?.active_count || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('subscription.churn_rate')}
              value={churnData?.churn_pct || 0}
              precision={2}
              suffix="%"
              valueStyle={{ color: churnData && churnData.churn_pct < 5 ? 'var(--success-500)' : 'var(--danger-500)' }}
            />
            {churnData && (
              <div style={{ marginTop: space.sm, fontSize: '12px', color: 'var(--ink-500)' }}>
                {t('subscription.last_30_days')}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card title={t('subscription.mrr_trend')} loading={loading} style={{ marginTop: space.md }}>
        <ResponsiveChart
          legendItems={[
            { id: 'mrr', labelKey: asTranslationKey('subscription.mrr'), color: 'var(--accent-500)' },
          ]}
        >
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="mrr" stroke="var(--accent-500)" name={t('subscription.mrr')} />
          </LineChart>
        </ResponsiveChart>
      </Card>

      <Card title={t('subscription.mrr_by_plan')} loading={loading} style={{ marginTop: space.md }}>
        <ResponsiveTableAdapter
          columns={planColumns}
          dataSource={mrrData?.by_plan || []}
          rowKey="plan"
          pagination={false}
        />
      </Card>

      {churnData && (
        <Card title={t('subscription.churn_details')} loading={loading} style={{ marginTop: space.md }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Statistic
                title={t('subscription.active_at_period_start')}
                value={churnData.active_at_start}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title={t('subscription.cancelled_in_period')}
                value={churnData.cancelled}
                valueStyle={{ color: 'var(--danger-500)' }}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title={t('subscription.remaining_active')}
                value={churnData.remaining}
                valueStyle={{ color: 'var(--success-500)' }}
              />
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default SubscriptionReports;
