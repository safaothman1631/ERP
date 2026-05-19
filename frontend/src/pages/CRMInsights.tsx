import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, message, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../api';
import ExportButton from '../components/ExportButton';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
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

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title={t('forecasted_revenue')} value={forecast?.total || 0} formatter={(v) => fmt(Number(v))} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title={t('open_pipeline')} value={pipeline?.total_value || 0} formatter={(v) => fmt(Number(v))} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title={t('win_rate')} value={wonLost?.win_rate || 0} suffix="%" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title={t('average_deal_size')} value={wonLost?.average_deal_size || 0} formatter={(v) => fmt(Number(v))} /></Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title={t('forecast_by_month')} extra={<ExportButton endpoint="/api/export/sales-by-customer" filename="forecast" />}>
            <ResponsiveTableAdapter
              rowKey="month"
              size="small"
              pagination={false}
              dataSource={forecast?.months || []}
              columns={[
                { title: t('month'), dataIndex: 'month' },
                { title: t('weighted_value'), dataIndex: 'weighted_value', align: 'right', render: (v: number) => fmt(v) },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title={t('pipeline_by_stage')}>
            <ResponsiveTableAdapter
              rowKey="stage_id"
              size="small"
              pagination={false}
              dataSource={pipeline?.stages || []}
              columns={[
                { title: t('stage'), dataIndex: 'stage_name', render: (v: string, r: PipelineStage) => <Tag color={r.color}>{v}</Tag> },
                { title: t('count'), dataIndex: 'count', align: 'right' },
                { title: t('value'), dataIndex: 'value', align: 'right', render: (v: number) => fmt(v) },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={12}>
          <Card title={t('won_lost_summary')}>
            <Row gutter={12}>
              <Col span={12}>
                <Statistic title={t('won')} value={wonLost?.won_count || 0} suffix={`(${fmt(wonLost?.won_value || 0)})`} styles={{ content: { color: '#52c41a' } }} />
              </Col>
              <Col span={12}>
                <Statistic title={t('lost')} value={wonLost?.lost_count || 0} suffix={`(${fmt(wonLost?.lost_value || 0)})`} styles={{ content: { color: '#f5222d' } }} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Card title={t('top_owners')}>
            <ResponsiveTableAdapter
              rowKey="owner_id"
              size="small"
              pagination={false}
              dataSource={leaders}
              columns={[
                { title: t('owner'), dataIndex: 'owner_id' },
                { title: t('deals'), dataIndex: 'deals', align: 'right' },
                { title: t('value'), dataIndex: 'value', align: 'right', render: (v: number) => fmt(v) },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
