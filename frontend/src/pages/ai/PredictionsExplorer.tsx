import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, Typography, message, Card, Progress } from 'antd';
import type { TableProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReloadOutlined, EyeOutlined, LineChartOutlined } from '@ant-design/icons';
import { PageHeader } from '../../design-system';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Text, Paragraph } = Typography;

interface ForecastPoint {
 date?: string;
 value?: number;
 upper_bound?: number;
 lower_bound?: number;
}

interface Prediction {
 id: string;
 model_id?: string;
 entity: string;
 horizon_days?: number;
 points?: ForecastPoint[];
 confidence?: number;
 explanation?: string;
 created_at?: string;
}

const PredictionsExplorer: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Prediction[]>([]);
 const [loading, setLoading] = useState(false);
 const [drawerVisible, setDrawerVisible] = useState(false);
 const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);

 const fetchPredictions = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/ai/forecasts', { params: { limit: 500 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchPredictions();
 }, []);

 const showDetails = (prediction: Prediction) => {
 setSelectedPrediction(prediction);
 setDrawerVisible(true);
 };

 const columns: TableProps<Prediction>['columns'] = [
 {
 title: t('ai.entity'),
 dataIndex: 'entity',
 key: 'entity',
 render: (val: string) => <Tag color="purple">{val}</Tag>,
 },
 {
 title: t('ai.horizon_days'),
 dataIndex: 'horizon_days',
 key: 'horizon_days',
 render: (val?: number) => `${val || 30} ${t('days')}`,
 },
 {
 title: t('ai.predicted_value'),
 key: 'predicted_value',
 render: (_, record: Prediction) => {
 const lastPoint = record.points?.[record.points.length - 1];
 return lastPoint?.value
 ? `${lastPoint.value.toLocaleString()}`
 : '—';
 },
 },
 {
 title: t('ai.confidence'),
 dataIndex: 'confidence',
 key: 'confidence',
 render: (val?: number) => {
 const percent = val ? val * 100 : 0;
 return (
 <Space>
 <Progress
 percent={percent}
 style={{ width: 80 }}
 strokeColor={percent > 80 ? '#52c41a' : percent > 50 ? '#faad14' : '#ff4d4f'}
 />
 </Space>
 );
 },
 sorter: (a, b) => (a.confidence || 0) - (b.confidence || 0),
 },
 {
 title: t('ai.created_at'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (val?: string) => val?.substring(0, 16).replace('T', ' ') || '—',
 sorter: (a, b) => (a.created_at || '').localeCompare(b.created_at || ''),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_, record: Prediction) => (
 <Button icon={<EyeOutlined />} onClick={() => showDetails(record)}>
 {t('view')}
 </Button>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('ai.predictions_title')}
 subtitle={t('ai.predictions_subtitle')}
 extra={
 <Button icon={<ReloadOutlined />} onClick={fetchPredictions}>
 {t('refresh')}
 </Button>
 }
 />

 <ResponsiveTableAdapter
 columns={columns}
 dataSource={data}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 50, showSizeChanger: true }}
 />

 <FormDialog
 title={
 <Space>
 <LineChartOutlined />
 {t('ai.prediction_details')}
 </Space>
 }
 open={drawerVisible}
 onClose={() => setDrawerVisible(false)}
 >
 {selectedPrediction && (
 <>
 <Card style={{ marginBottom: 16 }}>
 <Space direction="vertical" style={{ width: '100%' }}>
 <div>
 <Text type="secondary">{t('ai.entity')}:</Text>
 <Tag color="purple" style={{ marginLeft: 8 }}>
 {selectedPrediction.entity}
 </Tag>
 </div>
 <div>
 <Text type="secondary">{t('ai.horizon_days')}:</Text>{' '}
 <Text strong>{selectedPrediction.horizon_days || 30}</Text>
 </div>
 <div>
 <Text type="secondary">{t('ai.confidence')}:</Text>{' '}
 <Progress
 percent={(selectedPrediction.confidence || 0) * 100}
 style={{ width: 200, marginLeft: 8 }}
 />
 </div>
 <div>
 <Text type="secondary">{t('ai.created_at')}:</Text>{' '}
 <Text>
 {selectedPrediction.created_at?.substring(0, 16).replace('T', ' ') || '—'}
 </Text>
 </div>
 </Space>
 </Card>

 {selectedPrediction.explanation && (
 <Card title={t('ai.explanation')} style={{ marginBottom: 16 }}>
 <Paragraph>{selectedPrediction.explanation}</Paragraph>
 </Card>
 )}

 {selectedPrediction.points && selectedPrediction.points.length > 0 && (
 <Card title={t('ai.forecast_points')}>
 <ResponsiveTableAdapter
 dataSource={selectedPrediction.points}
 pagination={false}
 scroll={{ y: 400 }}
 columns={[
 {
 title: t('date'),
 dataIndex: 'date',
 key: 'date',
 render: (val?: string) => val || '—',
 },
 {
 title: t('ai.predicted_value'),
 dataIndex: 'value',
 key: 'value',
 render: (val?: number) =>
 val !== undefined ? (
 <Text strong>{val.toLocaleString()}</Text>
 ) : (
 '—'
 ),
 },
 {
 title: t('ai.upper_bound'),
 dataIndex: 'upper_bound',
 key: 'upper_bound',
 render: (val?: number) =>
 val !== undefined ? val.toLocaleString() : '—',
 },
 {
 title: t('ai.lower_bound'),
 dataIndex: 'lower_bound',
 key: 'lower_bound',
 render: (val?: number) =>
 val !== undefined ? val.toLocaleString() : '—',
 },
 ]}
 />
 </Card>
 )}
 </>
 )}
 </FormDialog>
 </div>
 );
};

export default PredictionsExplorer;
