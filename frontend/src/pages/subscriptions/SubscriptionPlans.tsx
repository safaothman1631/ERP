import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, InputNumber, Switch, Modal, message, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Plan {
 id: string;
 code: string;
 name: string;
 price: number;
 currency: string;
 billing_cycle: 'monthly' | 'quarterly' | 'yearly';
 billing_interval: number;
 trial_days: number;
 setup_fee: number;
 active: boolean;
 description?: string;
}

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const SubscriptionPlans: React.FC = () => {
 const { t } = useTranslation();
 const [plans, setPlans] = useState<Plan[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [editing, setEditing] = useState<Plan | null>(null);
 const [tab, setTab] = useState<'all' | 'active' | 'inactive'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('subscription_plans.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchPlans = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/subscriptions/plans');
 setPlans(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchPlans();
 }, []);

 const handleCreate = () => {
 setEditing(null);
 form.resetFields();
 form.setFieldsValue({ currency: 'IQD', billing_cycle: 'monthly', billing_interval: 1, trial_days: 0, setup_fee: 0, active: true });
 setModalOpen(true);
 };

 const handleEdit = (record: Plan) => {
 setEditing(record);
 form.setFieldsValue(record);
 setModalOpen(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: Plan) => {
 setEditing(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({ ...rest, code: '', name: `${record.name ?? ''} (${t('copy', 'copy')})` });
 setModalOpen(true);
 };

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.put(`/api/subscriptions/plans/${editing.id}`, values);
 } else {
 await api.post('/api/subscriptions/plans', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditing(null);
 void fetchPlans();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 try {
 await api.delete(`/api/subscriptions/plans/${id}`);
 message.success(t('success'));
 void fetchPlans();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 // Kit list tabs (All / Active / Inactive) — client-side filtered on `active`.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'active', label: t('active') },
 { key: 'inactive', label: t('inactive') },
 ];

 const data = useMemo(() => {
 if (tab === 'active') return plans.filter((p) => p.active);
 if (tab === 'inactive') return plans.filter((p) => !p.active);
 return plans;
 }, [plans, tab]);

 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);

 const allColumns = [
 {
 title: t('subscription.code'), dataIndex: 'code', key: 'code', width: 100,
 render: (v: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 ),
 },
 {
 title: t('subscription.plan_name'), dataIndex: 'name', key: 'name',
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(v)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 </div>
 ),
 },
 {
 title: t('subscription.price'),
 key: 'price',
 render: (_: any, record: Plan) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {`${record.price.toLocaleString()} ${record.currency}`}
 </span>
 ),
 width: 120,
 },
 {
 title: t('subscription.billing_cycle'),
 dataIndex: 'billing_cycle',
 key: 'billing_cycle',
 render: (cycle: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(`subscription.cycle_${cycle}`)}</span>
 ),
 width: 120,
 },
 {
 title: t('subscription.trial_days'),
 dataIndex: 'trial_days',
 key: 'trial_days',
 width: 100,
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)' }}>{v}</span>
 ),
 },
 {
 title: t('subscription.setup_fee'),
 dataIndex: 'setup_fee',
 key: 'setup_fee',
 render: (fee: number) => fee > 0
 ? <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{fee.toLocaleString()}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 width: 100,
 },
 {
 title: t('status'),
 key: 'active',
 render: (_: any, record: Plan) => (
 <StatusTag status={record.active ? 'active' : 'inactive'} label={record.active ? t('active') : t('inactive')} />
 ),
 width: 80,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: Plan) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('subscription_plans.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('subscription.plans')}
 subtitle={t('subscription.plans_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('subscription.new_plan')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => setTab(k as typeof tab)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => setTab('all')}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => setTab(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="active">{t('active')}</Radio>
 <Radio value="inactive">{t('inactive')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => setTab((v || 'all') as typeof tab)}
 options={[
 { value: 'active', label: t('active') },
 { value: 'inactive', label: t('inactive') },
 ]}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('subscription_plans', filteredData, cols);
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
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={filteredData}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 />
 </KitListCard>

 <FormDialog
 title={editing ? t('subscription.edit_plan') : t('subscription.new_plan')}
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="code" label={t('subscription.code')} rules={[{ required: true }]}>
 <Input maxLength={50} />
 </Form.Item>
 <Form.Item name="name" label={t('subscription.plan_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="price" label={t('subscription.price')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="currency" label={t('currency')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="IQD">IQD</Select.Option>
 <Select.Option value="USD">USD</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="billing_cycle" label={t('subscription.billing_cycle')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="monthly">{t('subscription.cycle_monthly')}</Select.Option>
 <Select.Option value="quarterly">{t('subscription.cycle_quarterly')}</Select.Option>
 <Select.Option value="yearly">{t('subscription.cycle_yearly')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="billing_interval" label={t('subscription.billing_interval')} rules={[{ required: true }]}>
 <InputNumber min={1} max={12} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="trial_days" label={t('subscription.trial_days')}>
 <InputNumber min={0} max={365} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="setup_fee" label={t('subscription.setup_fee')}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="description" label={t('description')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="active" label={t('active')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default SubscriptionPlans;
