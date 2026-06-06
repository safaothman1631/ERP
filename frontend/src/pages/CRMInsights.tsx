import { useEffect, useState, type CSSProperties } from 'react';
import { Row, Col, message } from 'antd';
import { DollarOutlined, FundOutlined, TrophyOutlined, RiseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import ExportButton from '../components/ExportButton';
import { PageHeader, SectionCard, DataTable, KpiCard, StatusTag } from '../design-system';
import type { ColumnDef } from '../design-system/DataTable';
import { LoadingSkeleton } from '../design-system/LoadingSkeleton';
import { useLoadingState } from '../hooks/useLoadingState';

interface ForecastMonth { month: string; weighted_value: number; }
interface ForecastResp { months: ForecastMonth[]; total: number; }
interface PipelineStage { stage_id: string; stage_name: string; color?: string; count: number; value: number; }
interface PipelineResp { stages: PipelineStage[]; total_value: number; }
interface WonLostResp {
  won_count: number; lost_count: number; won_value: number; lost_value: number;
  win_rate: number; average_deal_size: number;
}
interface LeaderboardItem { owner_id: string; deals: number; value: number; }

const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0);

export default function CRMInsights() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<ForecastResp | null>(null);
  const [pipeline, setPipeline] = useState<PipelineResp | null>(null);
  const [wonLost, setWonLost] = useState<WonLostResp | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardItem[]>([]);
  const { showSkeleton } = useLoadingState(loading);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [f, p, w, l] = await Promise.all([
          api.get('/api/crm/forecast'),
          api.get('/api/crm/reports/pipeline'),
          api.get('/api/crm/reports/won-lost'),
          api.get('/api/crm/reports/leaderboard'),
        ]);
        setForecast(f.data);
        setPipeline(p.data);
        setWonLost(w.data);
        setLeaders(l.data.items || []);
      } catch {
        message.error(t('error'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (showSkeleton && !forecast) return <LoadingSkeleton variant="card" />;

  const embeddedTable: CSSProperties = { border: 'none', boxShadow: 'none', borderRadius: 0 };

  const forecastCols: ColumnDef<ForecastMonth>[] = [
    { title: t('month'), dataIndex: 'month' },
    { title: t('weighted_value'), dataIndex: 'weighted_value', align: 'right', render: (v: number) => fmt(v) },
  ];
  const stageCols: ColumnDef<PipelineStage>[] = [
    { title: t('stage'), dataIndex: 'stage_name', render: (v: string) => <StatusTag status="default" label={v} /> },
    { title: t('count'), dataIndex: 'count', align: 'right' },
    { title: t('value'), dataIndex: 'value', align: 'right', render: (v: number) => fmt(v) },
  ];
  const leaderCols: ColumnDef<LeaderboardItem>[] = [
    { title: t('owner'), dataIndex: 'owner_id' },
    { title: t('deals'), dataIndex: 'deals', align: 'right' },
    { title: t('value'), dataIndex: 'value', align: 'right', render: (v: number) => fmt(v) },
  ];

  return (
    <div>
      <PageHeader title={t('crm_insights', 'CRM Insights')} />

      <Row gutter={[16, 16]} style={{ marginBottom: 'var(--space-lg)' }}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title={t('forecasted_revenue')} value={fmt(forecast?.total || 0)} icon={<FundOutlined />} tone="primary" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title={t('open_pipeline')} value={fmt(pipeline?.total_value || 0)} icon={<DollarOutlined />} tone="info" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title={t('win_rate')} value={`${wonLost?.win_rate || 0}%`} icon={<TrophyOutlined />} tone="success" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title={t('average_deal_size')} value={fmt(wonLost?.average_deal_size || 0)} icon={<RiseOutlined />} tone="primary" />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 'var(--space-lg)' }}>
        <Col xs={24} lg={12}>
          <SectionCard
            title={t('forecast_by_month')}
            extra={<ExportButton endpoint="/api/export/sales-by-customer" filename="forecast" />}
            padded={false}
            style={{ marginBottom: 0 }}
          >
            <DataTable
              rowKey="month"
              stickyHeader={false}
              pagination={false}
              dataSource={forecast?.months || []}
              columns={forecastCols}
              style={embeddedTable}
            />
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title={t('pipeline_by_stage')} padded={false} style={{ marginBottom: 0 }}>
            <DataTable
              rowKey="stage_id"
              stickyHeader={false}
              pagination={false}
              dataSource={pipeline?.stages || []}
              columns={stageCols}
              style={embeddedTable}
            />
          </SectionCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title={t('won_lost_summary')} style={{ marginBottom: 0 }}>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{t('won')}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--success-fg)', letterSpacing: '-0.02em' }}>
                  {wonLost?.won_count || 0} <span style={{ fontSize: 13, color: 'var(--ink-500)', fontWeight: 500 }}>({fmt(wonLost?.won_value || 0)})</span>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{t('lost')}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--danger-fg)', letterSpacing: '-0.02em' }}>
                  {wonLost?.lost_count || 0} <span style={{ fontSize: 13, color: 'var(--ink-500)', fontWeight: 500 }}>({fmt(wonLost?.lost_value || 0)})</span>
                </div>
              </Col>
            </Row>
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title={t('top_owners')} padded={false} style={{ marginBottom: 0 }}>
            <DataTable
              rowKey="owner_id"
              stickyHeader={false}
              pagination={false}
              dataSource={leaders}
              columns={leaderCols}
              style={embeddedTable}
            />
          </SectionCard>
        </Col>
      </Row>
    </div>
  );
}
