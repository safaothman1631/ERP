import React, { useEffect, useState } from 'react';
import { Card, Button, Space } from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
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
 render: (v: string) => <StatusTag status={v === 'ok' ? 'success' : 'error'} label={v} />,
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
 <SectionCard padded={false}>
 <ResponsiveTableAdapter dataSource={runs} columns={columns} loading={loading} rowKey="id" />
 </SectionCard>

 <FormDialog
 title={t('automation.run_detail')}
 open={detailOpen}
 onClose={() => setDetailOpen(false)}
 >
 {selectedRun && (
 <div>
 <p><strong>{t('automation.run_at')}:</strong> {new Date(selectedRun.ran_at).toLocaleString()}</p>
 <p><strong>{t('automation.status')}:</strong> <StatusTag status={selectedRun.status === 'ok' ? 'success' : 'error'} label={selectedRun.status} /></p>
 <p><strong>{t('automation.duration')}:</strong> {selectedRun.duration_ms || 0} ms</p>

 {selectedRun.trigger_data && (
 <div style={{ marginTop: space.md }}>
 <h4>{t('automation.trigger_data')}:</h4>
 <pre style={{ background: 'var(--surface-2)', color: 'var(--ink-700)', padding: space.sm, borderRadius: 'var(--radius-md)' }}>
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
 <p><strong>{t('automation.status')}:</strong> <StatusTag status={step.status === 'ok' ? 'success' : 'error'} label={step.status} /></p>
 {step.output && (
 <details>
 <summary>{t('automation.output')}</summary>
 <pre style={{ background: 'var(--surface-2)', color: 'var(--ink-700)', padding: space.xs, marginTop: space.xs, borderRadius: 'var(--radius-md)' }}>
 {JSON.stringify(step.output, null, 2)}
 </pre>
 </details>
 )}
 {step.error && (
 <p style={{ color: 'var(--danger-500)' }}><strong>{t('error')}:</strong> {step.error}</p>
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
