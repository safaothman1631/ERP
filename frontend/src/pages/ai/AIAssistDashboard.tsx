import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Spin, Space, Statistic, Typography, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ExperimentOutlined, AlertOutlined, BulbOutlined,
  ScanOutlined, LineChartOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import { PageHeader } from '../../design-system';
import api from '../../api';

const { Text, Title } = Typography;

interface DashboardStats {
  open_anomalies: number;
  pending_suggestions: number;
  in_progress_ocr: number;
  completed_ocr: number;
  recent_predictions: number;
  anomaly_trend: Array<{ date: string; score: number }>;
}

const AIAssistDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [anomRes, sugRes, ocrRes, predRes] = await Promise.all([
        api.get('/api/ai/anomalies', { params: { limit: 500 } }),
        api.get('/api/ai/recommendations', { params: { limit: 500 } }),
        api.get('/api/ai/ocr', { params: { limit: 500 } }),
        api.get('/api/ai/forecasts', { params: { limit: 100 } }),
      ]);

      const anomalies = anomRes.data.items || [];
      const suggestions = sugRes.data.items || [];
      const ocrJobs = ocrRes.data.items || [];
      const predictions = predRes.data.items || [];

      const openAnomalies = anomalies.filter((a: any) => a.status === 'new').length;
      const pendingSuggestions = suggestions.filter((s: any) => s.status !== 'accepted').length;
      const inProgressOcr = ocrJobs.filter((o: any) => o.status === 'in-progress').length;
      const completedOcr = ocrJobs.filter((o: any) => o.status === 'completed').length;

      // Build anomaly score trend (last 7 days)
      const last7Days = anomalies
        .filter((a: any) => a.detected_at)
        .sort((a: any, b: any) => a.detected_at.localeCompare(b.detected_at))
        .slice(-7)
        .map((a: any) => ({
          date: a.detected_at.substring(0, 10),
          score: a.score || 0,
        }));

      setStats({
        open_anomalies: openAnomalies,
        pending_suggestions: pendingSuggestions,
        in_progress_ocr: inProgressOcr,
        completed_ocr: completedOcr,
        recent_predictions: predictions.length,
        anomaly_trend: last7Days,
      });
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, []);

  const CustomTooltip: React.FC<TooltipProps<number, string>> = (props) => {
    const { active, payload } = props as any;
    if (active && payload && payload.length) {
      return (
        <Card size="small" style={{ border: '1px solid #d9d9d9' }}>
          <Text strong>{payload[0].payload.date}</Text>
          <br />
          <Text>{t('ai.anomaly_score')}: {payload[0].value}</Text>
        </Card>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div>
        <PageHeader title={t('ai.dashboard_title')} subtitle={t('ai.dashboard_subtitle')} />
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('ai.dashboard_title')}
        subtitle={t('ai.dashboard_subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchDashboard}>
            {t('refresh')}
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card hoverable onClick={() => navigate('/ai/anomalies')}>
            <Statistic
              title={t('ai.open_anomalies')}
              value={stats?.open_anomalies ?? 0}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card hoverable onClick={() => navigate('/ai/suggestions')}>
            <Statistic
              title={t('ai.pending_suggestions')}
              value={stats?.pending_suggestions ?? 0}
              prefix={<BulbOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card hoverable onClick={() => navigate('/ai/ocr')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic
                title={t('ai.ocr_in_progress')}
                value={stats?.in_progress_ocr ?? 0}
                prefix={<ScanOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
              <Text type="secondary">
                {t('ai.completed')}: {stats?.completed_ocr ?? 0}
              </Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card hoverable onClick={() => navigate('/ai/predictions')}>
            <Statistic
              title={t('ai.recent_predictions')}
              value={stats?.recent_predictions ?? 0}
              prefix={<LineChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ marginTop: 24 }}
        title={<Title level={5}>{t('ai.anomaly_score_trend')}</Title>}
      >
        {stats?.anomaly_trend && stats.anomaly_trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={stats.anomaly_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="score" stroke="#ff4d4f" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Space direction="vertical" align="center" style={{ width: '100%', padding: '40px 0' }}>
            <ExperimentOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
            <Text type="secondary">{t('ai.no_trend_data')}</Text>
          </Space>
        )}
      </Card>
    </div>
  );
};

export default AIAssistDashboard;
