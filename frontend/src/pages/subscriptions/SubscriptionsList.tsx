import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, DatePicker, InputNumber, Modal, message, Radio } from 'antd';
import { PlusOutlined, EyeOutlined, PauseOutlined, PlayCircleOutlined, StopOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, StatusTag, type StatusKind, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
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
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('subscriptions.hiddenCols') || '[]'); } catch { return []; }
 });

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

 const statusKinds: Record<string, StatusKind> = {
 trial: 'info',
 active: 'active',
 past_due: 'warning',
 cancelled: 'error',
 paused: 'default',
 };

 // Kit list tabs (All / Trial / Active / Past due / Paused / Cancelled) — wired to the
 // SAME `status` server filter the page already supports.
 const statusOptions = [
 { value: 'trial', label: t('subscription.status_trial') },
 { value: 'active', label: t('subscription.status_active') },
 { value: 'past_due', label: t('subscription.status_past_due') },
 { value: 'paused', label: t('subscription.status_paused') },
 { value: 'cancelled', label: t('subscription.status_cancelled') },
 ];
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...statusOptions.map((o) => ({ key: o.value, label: o.label })),
 ];

 const allColumns = [
 {
 title: t('subscription.subscription_id'),
 dataIndex: 'id',
 key: 'id',
 width: 120,
 render: (id: string) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{id.substring(0, 8)}</span>
 ),
 },
 {
 title: t('subscription.contact'),
 dataIndex: 'contact_id',
 key: 'contact_id',
 width: 100,
 render: (id: string) => (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{id.substring(0, 8)}</span>
 ),
 },
 {
 title: t('subscription.plan'),
 dataIndex: 'plan_id',
 key: 'plan_id',
 render: (planId: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{plans.find(p => p.id === planId)?.name || planId.substring(0, 8)}</span>
 ),
 },
 {
 title: t('subscription.status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => (
 <StatusTag status={statusKinds[status] || 'default'} label={t(`subscription.status_${status}`)} />
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
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: Subscription) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => navigate(`/subscriptions/${record.id}`) },
 ...(record.status === 'active' ? [
 { key: 'invoice', icon: <FileTextOutlined />, label: t('subscription.generate_invoice', 'Generate invoice'), onClick: () => handleGenerateInvoice(record.id) },
 { key: 'pause', icon: <PauseOutlined />, label: t('subscription.pause', 'Pause'), onClick: () => handlePause(record.id) },
 { type: 'divider' as const },
 { key: 'cancel', icon: <StopOutlined />, label: t('subscription.cancel', 'Cancel'), danger: true, onClick: () => handleCancel(record.id) },
 ] : []),
 ...(record.status === 'paused' ? [
 { key: 'resume', icon: <PlayCircleOutlined />, label: t('subscription.resume', 'Resume'), onClick: () => handleResume(record.id) },
 ] : []),
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t, plans, statusFilter, planFilter]);
 const filteredData = useMemo(() => {
 if (!search) return subscriptions;
 const q = search.toLowerCase();
 return subscriptions.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [subscriptions, search]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'id' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('subscriptions.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const activeFilterCount = (statusFilter ? 1 : 0) + (planFilter ? 1 : 0);

 return (
 <div data-addgate-section="subscriptions.list">
 <PageHeader
 title={t('subscription.subscriptions')}
 subtitle={t('subscription.subscriptions_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} data-add-action="subscriptions.list">
 {t('subscription.new_subscription')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={statusFilter || 'all'}
 onTabChange={(k) => setStatusFilter(k === 'all' ? '' : k)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={activeFilterCount}
 onClear={() => { setStatusFilter(''); setPlanFilter(''); }}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-600)' }}>{t('subscription.filter_status')}</div>
 <Radio.Group
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 {statusOptions.map((o) => (
 <Radio key={o.value} value={o.value}>{o.label}</Radio>
 ))}
 </Radio.Group>
 </div>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-600)' }}>{t('subscription.filter_plan')}</div>
 <Radio.Group
 value={planFilter}
 onChange={(e) => setPlanFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 {plans.map((p) => (
 <Radio key={p.id} value={p.id}>{p.name}</Radio>
 ))}
 </Radio.Group>
 </div>
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('subscription.status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => setStatusFilter(v)}
 options={statusOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('subscriptions', subscriptions, cols);
 }}
 onPrint={() => window.print()}
 onImport={() => message.info(t('coming_soon', 'Coming soon'))}
 onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
 onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
 />
 </div>
 </>
 }
 >
 <ListWithEmptyState
 entity="subscription"
 data={filteredData}
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
 </KitListCard>

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
