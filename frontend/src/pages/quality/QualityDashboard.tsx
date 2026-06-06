import React, { useEffect, useState, useCallback } from 'react';
import { Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../api';
import { PageHeader, KpiCard, LoadingSkeleton, SectionCard, ChartCard } from '../../design-system';
import { InlineError } from '../../components/feedback/InlineError';
import { useLoadingState } from '../../hooks/useLoadingState';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';

interface DashboardData {
  checks_total: number;
  checks_passed: number;
  checks_failed: number;
  non_conformities: number;
  capas_open: number;
}

interface FailedCheck {
  id: string;
  product_id?: string;
  notes?: string;
  checked_at?: string;
}

const QualityDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentFailures, setRecentFailures] = useState<FailedCheck[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const { showSkeleton } = useLoadingState(loading);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [dashRes, checksRes] = await Promise.all([
        api.get('/api/quality/dashboard'),
        api.get('/api/quality/checks', { params: { status: 'fail', limit: 10 } }),
      ]);
      setData(dashRes.data);
      setRecentFailures(checksRes.data.items || []);

      // Generate trend data (mock - last 8 weeks)
      const trend = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekLabel = `W${Math.floor((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / 604800000) + 1}`;
        trend.push({
          week: weekLabel,
          pass: Math.floor(Math.random() * 20) + 10,
          fail: Math.floor(Math.random() * 5),
        });
      }
      setTrendData(trend);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const failureColumns: ColumnsType<FailedCheck> = [
    {
      title: t('quality.product'),
      dataIndex: 'product_id',
      key: 'product_id',
      render: (v) => v || t('n_a'),
    },
    {
      title: t('quality.notes'),
      dataIndex: 'notes',
      key: 'notes',
      render: (v) => v || '—',
    },
    {
      title: t('quality.date'),
      dataIndex: 'checked_at',
      key: 'checked_at',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
    },
  ];

  if (error) {
    return <InlineError onRetry={fetchData} />;
  }

  if (showSkeleton || !data) {
    return <LoadingSkeleton variant="card" />;
  }

  const passRate = data.checks_total > 0 ? ((data.checks_passed / data.checks_total) * 100).toFixed(1) : '0.0';

  return (
    <div>
      <PageHeader
        title={t('quality.dashboard')}
        subtitle={t('quality.dashboard_subtitle')}
      />
      <Row gutter={[space.md, space.md]} style={{ marginBottom: space.lg }}>
        <Col xs={24} sm={12} lg={8}>
          <KpiCard
            title={t('quality.open_checks')}
            value={data.checks_total - data.checks_passed - data.checks_failed}
            trend={0}
            trendLabel=""
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KpiCard
            title={t('quality.pass_rate')}
            value={`${passRate}%`}
            trend={0}
            trendLabel=""
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KpiCard
            title={t('quality.open_ncr')}
            value={data.non_conformities}
            trend={0}
            trendLabel=""
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KpiCard
            title={t('quality.open_capa')}
            value={data.capas_open}
            trend={0}
            trendLabel=""
          />
        </Col>
      </Row>

      <Row gutter={[space.md, space.md]}>
        <Col xs={24} lg={12}>
          <SectionCard title={t('quality.recent_failures')}>
            <ResponsiveTableAdapter
              dataSource={recentFailures}
              columns={failureColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard title={t('quality.trend_chart')}>
            <ResponsiveChart
              legendItems={[
                { id: 'pass', labelKey: asTranslationKey('quality.passed'), color: 'var(--success-500)' },
                { id: 'fail', labelKey: asTranslationKey('quality.failed'), color: 'var(--danger-500)' },
              ]}
            >
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fill: 'var(--ink-400)' }} />
                <YAxis tick={{ fill: 'var(--ink-400)' }} />
                <Tooltip />
                <Line type="monotone" dataKey="pass" stroke="var(--success-500)" name={t('quality.passed')} />
                <Line type="monotone" dataKey="fail" stroke="var(--danger-500)" name={t('quality.failed')} />
              </LineChart>
            </ResponsiveChart>
          </ChartCard>
        </Col>
      </Row>
    </div>
  );
};

export default QualityDashboard;
