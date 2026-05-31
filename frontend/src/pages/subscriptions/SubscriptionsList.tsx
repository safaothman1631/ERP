import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Tag, message, Card, DatePicker, InputNumber, Modal } from 'antd';
import { PlusOutlined, EyeOutlined, PauseOutlined, PlayCircleOutlined, StopOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import dayjs from 'dayjs';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { useAddGate } from '../../components/AddGate/useAddGate';
import { SelectWithQuickCreate } from '../../design-system/empty/SelectWithQuickCreate';
import { ListWithEmptyState } from '../../design-system/empty/ListWithEmptyState';

interface Subscription {
 id: string;
 contact_id: string;
 plan_id: string;
 status: string;
 start_date: string;
 current_period_start: string;
 current_period_end: string;
 next_invoice_date?: string;
 trial_end?: string;
}

interface Plan {
 id: string;
 name: string;
 price: number;
}

const SubscriptionsList: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
 const [plans, setPlans] = useState<Plan[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [planFilter, setPlanFilter] = useState<string>('');

 // AddGate: wire Selective Add for subscriptions section (R9.1, R9.5)
 const addGate = useAddGate('subscriptions.list');

 const fetchSubscriptions = async () => {
 setLoading(true);
 try {
 const params: any = {};
 if (statusFilter) params.status = statusFilter;
 if (planFilter) params.plan_id = planFilter;
 const res = await api.get('/api/subscriptions', { params });
 setSubscriptions(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchPlans = async () => {
 try {
 const res = await api.get('/api/subscriptions/plans');
 setPlans(res.data.items || []);
 } catch { /* noop */ }
 };

 useEffect(() => {
 void fetchSubscriptions();
 void fetchPlans();
 }, [statusFilter, planFilter]);

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(subscriptions.length); }, [subscriptions.length, addGate.setRecordCount]);

 const handleCreate = () => {
 form.resetFields();
 setModalOpen(true);
 };

 const handleSave = async (values: any) => {
 try {
 const data = {
 ...values,
 start_date: values.start_date ? dayjs(values.start_date).format('YYYY-MM-DD') : undefined,
 };
 await api.post('/api/subscriptions', data);
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 void fetchSubscriptions();
 } catch {
 message.error(t('error'));
 }
 };

 const handlePause = async (id: string) => {
 try {
 await api.post(`/api/subscriptions/${id}/pause`, {});
 message.success(t('subscription.paused'));
 void fetchSubscriptions();
 } catch {
 message.error(t('error'));
 }
 };

 const handleResume = async (id: string) => {
 try {
 await api.post(`/api/subscriptions/${id}/resume`, {});
 message.success(t('subscription.resumed'));
 void fetchSubscriptions();
 } catch {
 message.error(t('error'));
 }
 };

 const handleCancel = (id: string) => {
 Modal.confirm({
 title: t('subscription.confirm_cancel'),
 content: t('subscription.cancel_warning'),
 onOk: async () => {
 try {
 await api.post(`/api/subscriptions/${id}/cancel`, { at_period_end: true });
 message.success(t('subscription.cancel_scheduled'));
 void fetchSubscriptions();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleGenerateInvoice = async (id: string) => {
 try {
 await api.post(`/api/subscriptions/${id}/generate-invoice`, {});
 message.success(t('subscription.invoice_generated'));
 void fetchSubscriptions();
 } catch {
 message.error(t('error'));
 }
 };

 const statusColors: Record<string, string> = {
 trial: 'blue',
 active: 'green',
 past_due: 'orange',
 cancelled: 'red',
 paused: 'default',
 };

 const columns = [
 {
 title: t('subscription.subscription_id'),
 dataIndex: 'id',
 key: 'id',
 width: 120,
 render: (id: string) => id.substring(0, 8),
 },
 {
 title: t('subscription.contact'),
 dataIndex: 'contact_id',
 key: 'contact_id',
 width: 100,
 render: (id: string) => id.substring(0, 8),
 },
 {
 title: t('subscription.plan'),
 dataIndex: 'plan_id',
 key: 'plan_id',
 render: (planId: string) => plans.find(p => p.id === planId)?.name || planId.substring(0, 8),
 },
 {
 title: t('subscription.status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => (
 <Tag color={statusColors[status] || 'default'}>
 {t(`subscription.status_${status}`)}
 </Tag>
 ),
 width: 100,
 },
 {
 title: t('subscription.next_invoice'),
 dataIndex: 'next_invoice_date',
 key: 'next_invoice_date',
 render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
 width: 120,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: Subscription) => (
 <Space>
 <Button
 type="link"
 icon={<EyeOutlined />}
 onClick={() => navigate(`/subscriptions/${record.id}`)}
 />
 {record.status === 'active' && (
 <>
 <Button
 type="link"
 icon={<FileTextOutlined />}
 onClick={() => handleGenerateInvoice(record.id)}
 />
 <Button
 type="link"
 icon={<PauseOutlined />}
 onClick={() => handlePause(record.id)}
 />
 <Button
 type="link"
 danger
 icon={<StopOutlined />}
 onClick={() => handleCancel(record.id)}
 />
 </>
 )}
 {record.status === 'paused' && (
 <Button
 type="link"
 icon={<PlayCircleOutlined />}
 onClick={() => handleResume(record.id)}
 />
 )}
 </Space>
 ),
 width: 180,
 },
 ];

 return (
 <div style={{ padding: space.lg }} data-addgate-section="subscriptions.list">
 <PageHeader
 title={t('subscription.subscriptions')}
 subtitle={t('subscription.subscriptions_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} data-add-action="subscriptions.list">
 {t('subscription.new_subscription')}
 </Button>
 }
 />
 
 <Card style={{ marginTop: space.md }}>
 <Space style={{ marginBottom: space.md }}>
 <Select
 placeholder={t('subscription.filter_status')}
 style={{ width: 150 }}
 allowClear
 value={statusFilter || undefined}
 onChange={setStatusFilter}
 >
 <Select.Option value="trial">{t('subscription.status_trial')}</Select.Option>
 <Select.Option value="active">{t('subscription.status_active')}</Select.Option>
 <Select.Option value="past_due">{t('subscription.status_past_due')}</Select.Option>
 <Select.Option value="paused">{t('subscription.status_paused')}</Select.Option>
 <Select.Option value="cancelled">{t('subscription.status_cancelled')}</Select.Option>
 </Select>
 <Select
 placeholder={t('subscription.filter_plan')}
 style={{ width: 200 }}
 allowClear
 value={planFilter || undefined}
 onChange={setPlanFilter}
 >
 {plans.map(p => (
 <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
 ))}
 </Select>
 </Space>
 
 <ListWithEmptyState
 entity="subscription"
 data={subscriptions}
 loading={loading}
 onCreate={handleCreate}
 onRetry={() => void fetchSubscriptions()}
 render={(rows) => (
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={rows}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 />
 )}
 />
 </Card>

 <FormDialog
 title={t('subscription.new_subscription')}
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="contact_id" label={t('subscription.contact')} rules={[{ required: true }]}>
 <SelectWithQuickCreate
 entity="customer"
 placeholder={t('subscription.contact_id_placeholder')}
 />
 </Form.Item>
 <Form.Item name="plan_id" label={t('subscription.plan')} rules={[{ required: true }]}>
 <SelectWithQuickCreate
 entity="subscription_plan"
 placeholder={t('subscription.select_plan')}
 />
 </Form.Item>
 <Form.Item name="start_date" label={t('subscription.start_date')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="trial_days_override" label={t('subscription.trial_days_override')}>
 <InputNumber min={0} max={365} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="payment_method" label={t('subscription.payment_method')}>
 <Input placeholder={t('subscription.payment_method_placeholder')} />
 </Form.Item>
 <Form.Item name="notes" label={t('notes')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default SubscriptionsList;
