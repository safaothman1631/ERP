import React, { useEffect, useState } from 'react';
import { Tag, Card, Button, Space } from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const WorkflowRunHistory: React.FC = () => {
 const { t } = useTranslation();
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const [runs, setRuns] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [detailOpen, setDetailOpen] = useState(false);
 const [selectedRun, setSelectedRun] = useState<any>(null);

 const fetchRuns = async () => {
 if (!id) return;
 setLoading(true);
 try {
 const res = await api.get(`/api/automation/workflows/${id}/run-history`, { params: { limit: 50 } });
 setRuns(res.data.items || []);
 } catch {
 // message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchRuns();
 const interval = setInterval(() => {
 void fetchRuns();
 }, 5000);
 return () => clearInterval(interval);
 }, [id]);

 const columns = [
 {
 title: t('automation.run_at'),
 dataIndex: 'ran_at',
 key: 'ran_at',
 render: (v: string) => new Date(v).toLocaleString(),
 },
 {
 title: t('automation.status'),
 dataIndex: 'status',
 key: 'status',
 render: (v: string) => <Tag color={v === 'ok' ? 'green' : 'red'}>{v}</Tag>,
 },
 {
 title: t('automation.duration'),
 dataIndex: 'duration_ms',
 key: 'duration_ms',
 render: (v: number) => `${v || 0} ms`,
 },
 {
 title: t('automation.nodes_executed'),
 dataIndex: 'trace',
 key: 'nodes_executed',
 render: (trace: any[]) => trace?.length || 0,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Button
 icon={<EyeOutlined />}
 onClick={() => {
 setSelectedRun(record);
 setDetailOpen(true);
 }}
 >
 {t('view')}
 </Button>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('automation.run_history')}
 subtitle={t('automation.run_history_subtitle')}
 extra={
 <Space>
 <Button onClick={() => navigate(`/automation/workflows/${id}`)}>{t('back')}</Button>
 <Button icon={<ReloadOutlined />} onClick={fetchRuns}>
 {t('refresh')}
 </Button>
 </Space>
 }
 />
 <Card style={{ marginTop: space.md }}>
 <ResponsiveTableAdapter dataSource={runs} columns={columns} loading={loading} rowKey="id" />
 </Card>

 <FormDialog
 title={t('automation.run_detail')}
 open={detailOpen}
 onClose={() => setDetailOpen(false)}
 >
 {selectedRun && (
 <div>
 <p><strong>{t('automation.run_at')}:</strong> {new Date(selectedRun.ran_at).toLocaleString()}</p>
 <p><strong>{t('automation.status')}:</strong> <Tag color={selectedRun.status === 'ok' ? 'green' : 'red'}>{selectedRun.status}</Tag></p>
 <p><strong>{t('automation.duration')}:</strong> {selectedRun.duration_ms || 0} ms</p>
 
 {selectedRun.trigger_data && (
 <div style={{ marginTop: space.md }}>
 <h4>{t('automation.trigger_data')}:</h4>
 <pre style={{ backgroundColor: '#f5f5f5', padding: space.sm, borderRadius: 4 }}>
 {JSON.stringify(selectedRun.trigger_data, null, 2)}
 </pre>
 </div>
 )}
 
 {selectedRun.trace && (
 <div style={{ marginTop: space.md }}>
 <h4>{t('automation.trace')}:</h4>
 {selectedRun.trace.map((step: any, idx: number) => (
 <Card key={idx} style={{ marginBottom: space.sm }}>
 <p><strong>{t('automation.node_id')}:</strong> {step.node_id}</p>
 <p><strong>{t('automation.status')}:</strong> <Tag color={step.status === 'ok' ? 'green' : 'red'}>{step.status}</Tag></p>
 {step.output && (
 <details>
 <summary>{t('automation.output')}</summary>
 <pre style={{ backgroundColor: '#f5f5f5', padding: space.xs, marginTop: space.xs }}>
 {JSON.stringify(step.output, null, 2)}
 </pre>
 </details>
 )}
 {step.error && (
 <p style={{ color: 'red' }}><strong>{t('error')}:</strong> {step.error}</p>
 )}
 </Card>
 ))}
 </div>
 )}
 </div>
 )}
 </FormDialog>
 </div>
 );
};

export default WorkflowRunHistory;
