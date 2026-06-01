import { useEffect, useState } from 'react';
import { Card, Tag, Button, Form, Input, InputNumber, Select, Space, message, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';
import { FormDialog } from '../components/responsive/FormDialog';
import { LoadingSkeleton } from '../design-system/LoadingSkeleton';
import { useLoadingState } from '../hooks/useLoadingState';

interface Stage {
 id: string;
 name: string;
 sequence: number;
 color?: string;
 is_won?: boolean;
 is_lost?: boolean;
}

interface Opportunity {
 id: string;
 name: string;
 stage_id: string;
 amount: number;
 probability: number;
 close_date?: string;
 owner_id?: string;
 contact_id?: string;
 notes?: string;
}

const formatMoney = (n: number) =>
 new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0);

export default function CRMPipeline() {
 const { t } = useTranslation();
 const [stages, setStages] = useState<Stage[]>([]);
 const [opps, setOpps] = useState<Opportunity[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const { showSkeleton } = useLoadingState(loading);

 const load = async () => {
 setLoading(true);
 try {
 const [s, o] = await Promise.all([
 api.get('/api/crm/stages'),
 api.get('/api/crm/opportunities', { params: { page_size: 200, status: 'open' } }),
 ]);
 setStages((s.data.items || []).sort((a: Stage, b: Stage) => a.sequence - b.sequence));
 setOpps(o.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 load();
 }, []);

 const onDrop = async (oppId: string, newStageId: string) => {
 const opp = opps.find((o) => o.id === oppId);
 if (!opp || opp.stage_id === newStageId) return;
 setOpps((prev) => prev.map((o) => (o.id === oppId ? { ...o, stage_id: newStageId } : o)));
 try {
 await api.put(`/api/crm/opportunities/${oppId}`, { stage_id: newStageId });
 message.success(t('saved'));
 } catch {
 load();
 }
 };

 const onCreate = async () => {
 const values = await form.validateFields();
 try {
 await api.post('/api/crm/opportunities', values);
 message.success(t('saved'));
 setModalOpen(false);
 form.resetFields();
 load();
 } catch {
 message.error(t('error'));
 }
 };

 const totalByStage = (sid: string) =>
 opps.filter((o) => o.stage_id === sid).reduce((s, o) => s + (Number(o.amount) || 0), 0);

 return (
 <div data-section-id="crm.pipeline">
 <PageHeader
 title={t('pipeline')}
 sectionId="crm.pipeline"
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
 {t('new_opportunity')}
 </Button>
 </Space>
 }
 />

 {showSkeleton ? (
 <LoadingSkeleton variant="card" />
 ) : stages.length === 0 ? (
 <Empty />
 ) : (
 <div style={{ display: 'flex', gap: 'var(--space-md)', overflowX: 'auto', alignItems: 'flex-start' }}>
 {stages.map((stage) => {
 const stageOpps = opps.filter((o) => o.stage_id === stage.id);
 return (
 <div
 key={stage.id}
 onDragOver={(e) => e.preventDefault()}
 onDrop={(e) => {
 const id = e.dataTransfer.getData('text/plain');
 if (id) onDrop(id, stage.id);
 }}
 style={{
 minWidth: 280,
 background: 'var(--surface-2)',
 border: '1px solid var(--border)',
 borderRadius: 'var(--radius-lg)',
 padding: 10,
 borderTop: `4px solid ${stage.color || 'var(--accent-500)'}`,
 }}
 >
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 10px' }}>
 <strong style={{ fontSize: 13, color: 'var(--ink-900)' }}>{stage.name}</strong>
 <Tag>{stageOpps.length} · {formatMoney(totalByStage(stage.id))}</Tag>
 </div>

 {stageOpps.map((opp) => (
 <Card
 key={opp.id}
 className="vx-card vx-card-h"
 style={{ marginBottom: 8, cursor: 'grab' }}
 draggable
 onDragStart={(e) => e.dataTransfer.setData('text/plain', opp.id)}
 >
 <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{opp.name}</div>
 <div style={{ color: 'var(--ink-500)', fontSize: 12 }}>
 {formatMoney(opp.amount)} · {opp.probability}%
 </div>
 {opp.close_date && (
 <div style={{ color: 'var(--ink-400)', fontSize: 11 }}>{opp.close_date}</div>
 )}
 </Card>
 ))}

 {stageOpps.length === 0 && (
 <div style={{ color: 'var(--ink-300)', fontSize: 12, textAlign: 'center', padding: 16 }}>
 {t('drop_here')}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}

 <FormDialog
 title={t('new_opportunity')}
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 onOk={onCreate}
 >
 <Form form={form} layout="vertical" initialValues={{ amount: 0, probability: 50 }}>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="stage_id" label={t('stage')} rules={[{ required: true }]}>
 <Select options={stages.map((s) => ({ value: s.id, label: s.name }))} />
 </Form.Item>
 <Form.Item name="amount" label={t('amount')}>
 <InputNumber style={{ width: '100%' }} min={0} />
 </Form.Item>
 <Form.Item name="probability" label={t('probability')}>
 <InputNumber style={{ width: '100%' }} min={0} max={100} />
 </Form.Item>
 <Form.Item name="close_date" label={t('close_date')}>
 <Input placeholder="YYYY-MM-DD" />
 </Form.Item>
 <Form.Item name="notes" label={t('notes')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
