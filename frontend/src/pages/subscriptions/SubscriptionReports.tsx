import React, { useEffect, useState } from 'react';
import { Row, Col, Statistic } from 'antd';
import { DollarOutlined, TeamOutlined, FallOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../api';
import { PageHeader, SectionCard, KpiCard, StatusTag } from '../../design-system';
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
    <div>
      <PageHeader
        title={t('subscription.reports')}
        subtitle={t('subscription.reports_subtitle')}
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: space.md, marginBottom: space.lg }}>
        <KpiCard
          title={t('subscription.mrr')}
          value={`${(mrrData?.current_mrr || 0).toFixed(2)} IQD`}
          icon={<DollarOutlined />}
          loading={loading}
          tone={mrrData && mrrData.growth_pct > 0 ? 'success' : 'danger'}
          delta={mrrData ? mrrData.growth_pct : undefined}
          trendLabel={t('subscription.vs_last_month')}
        />
        <KpiCard
          title={t('subscription.arr')}
          value={`${(arrData?.arr || 0).toFixed(2)} IQD`}
          icon={<DollarOutlined />}
          loading={loading}
          tone="primary"
        />
        <KpiCard
          title={t('subscription.active_subscriptions')}
          value={mrrData?.active_count || 0}
          icon={<TeamOutlined />}
          loading={loading}
          tone="info"
        />
        <KpiCard
          title={t('subscription.churn_rate')}
          value={`${(churnData?.churn_pct || 0).toFixed(2)}%`}
          icon={<FallOutlined />}
          loading={loading}
          tone={churnData && churnData.churn_pct < 5 ? 'success' : 'danger'}
        />
      </div>

      <SectionCard title={t('subscription.mrr_trend')}>
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
      </SectionCard>

      <SectionCard title={t('subscription.mrr_by_plan')} padded={false}>
        <ResponsiveTableAdapter
          columns={planColumns}
          dataSource={mrrData?.by_plan || []}
          rowKey="plan"
          pagination={false}
        />
      </SectionCard>

      {churnData && (
        <SectionCard title={t('subscription.churn_details')}>
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
        </SectionCard>
      )}
    </div>
  );
};

export default SubscriptionReports;
