import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, Space, Modal, Empty, Typography } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined, InboxOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitSearchInput from '../design-system/KitSearchInput';
import KitStatusFilter from '../design-system/KitStatusFilter';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

const { Text } = Typography;

interface Rule {
 id: string;
 name: string;
 rule_type: string; // deposit | withdrawal
 apply_to: string; // description | payee | reference
 condition_type: string; // contains | equals | starts_with
 condition_value: string;
 target_account_id: string;
 target_account_name?: string;
 target_contact_id?: string;
 is_active: boolean;
}

const applyToOptions = [
 { label: 'Description', value: 'description' },
 { label: 'Payee', value: 'payee' },
 { label: 'Reference', value: 'reference' },
];

const conditionTypeOptions = [
 { label: 'Contains', value: 'contains' },
 { label: 'Equals', value: 'equals' },
 { label: 'Starts with', value: 'starts_with' },
];

const ruleTypeOptions = [
 { label: 'Deposit (income)', value: 'deposit' },
 { label: 'Withdrawal (expense)', value: 'withdrawal' },
];

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const BankRules: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Rule[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [_accounts, setAccounts] = useState<{ id: string; name: string; code: string }[]>([]);
 const [_contacts, setContacts] = useState<{ id: string; display_name: string }[]>([]);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [applying, setApplying] = useState(false);
 const [tab, setTab] = useState<'all' | 'deposit' | 'withdrawal'>('all');
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('bankRules.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = () => {
 setLoading(true);
 api.get('/api/banking/rules')
 .then(r => setData(r.data.items || []))
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 useEffect(() => { fetchData(); }, []);

 const openNew = async () => {
 const [a, c] = await Promise.all([
 api.get('/api/accounts', { params: { page_size: 200 } }),
 api.get('/api/contacts', { params: { page_size: 200 } }),
 ]);
 setAccounts(a.data.items || a.data);
 setContacts(c.data.items || c.data);
 setEditingId(null);
 form.resetFields();
 setModalOpen(true);
 };

 const openEdit = async (record: Rule) => {
 const [a, c] = await Promise.all([
 api.get('/api/accounts', { params: { page_size: 200 } }),
 api.get('/api/contacts', { params: { page_size: 200 } }),
 ]);
 setAccounts(a.data.items || a.data);
 setContacts(c.data.items || c.data);
 setEditingId(record.id);
 form.setFieldsValue(record);
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 if (editingId) {
 await api.put(`/api/banking/rules/${editingId}`, values);
 } else {
 await api.post('/api/banking/rules', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 okButtonProps: { danger: true },
 onOk: async () => {
 try {
 await api.delete(`/api/banking/rules/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleApplyAll = async () => {
 setApplying(true);
 try {
 const r = await api.post('/api/banking/rules/apply');
 message.success(`${t('success')} — ${r.data.matched || 0} matched`);
 } catch {
 message.error(t('error'));
 } finally {
 setApplying(false);
 }
 };

 // Kit list tabs (All / Deposit / Withdrawal) — client-filtered by rule_type.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'deposit', label: t('deposit', 'Deposit') },
 { key: 'withdrawal', label: t('withdrawal', 'Withdrawal') },
 ];

 // Client-side filter (page doesn't support server-side search/filter params).
 const filteredData = useMemo(() => {
 const q = search.trim().toLowerCase();
 return data.filter((r) => {
 if (tab !== 'all' && r.rule_type !== tab) return false;
 if (statusFilter === 'active' && !r.is_active) return false;
 if (statusFilter === 'inactive' && r.is_active) return false;
 if (q && !Object.values(r as Record<string, unknown>).some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
 return true;
 });
 }, [data, tab, statusFilter, search]);

 const allColumns = [
 {
 title: t('name'), dataIndex: 'name', key: 'name',
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
 title: t('condition'), key: 'condition',
 render: (_: unknown, r: Rule) => (
 <span style={{ color: 'var(--ink-700)' }}>{r.apply_to} {r.condition_type} &quot;{r.condition_value}&quot;</span>
 ),
 },
 {
 title: t('account'), dataIndex: 'target_account_name', key: 'target_account_name',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('type'), dataIndex: 'rule_type', key: 'rule_type',
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(v)}</span>
 ),
 },
 {
 title: t('status'), dataIndex: 'is_active', key: 'is_active',
 render: (v: boolean) => (
 <StatusTag status={v ? 'active' : 'inactive'} label={v ? t('active') : t('inactive')} />
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, record: Rule) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openEdit(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openEdit(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];
 const visibleColumns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('bankRules.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('bankRules')}
 subtitle={t('bank_rules_subtitle', 'Automatic bank rules')}
 sectionId="banking.bank_rules"
 extra={
 <Space>
 <Button icon={<ThunderboltOutlined />} loading={applying} onClick={handleApplyAll}>
 {t('apply_all_rules')}
 </Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('create')}
 </Button>
 </Space>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as typeof tab); }}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => setStatusFilter(v)}
 options={[
 { value: 'active', label: t('active', 'Active') },
 { value: 'inactive', label: t('inactive', 'Inactive') },
 ]}
 />
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('bank-rules', filteredData, cols);
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
 dataSource={filteredData}
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 locale={{
 emptyText: (
 <Empty
 image={<InboxOutlined style={{ fontSize: 48, color: 'var(--ink-300)' }} />}
 description={
 <Space orientation="vertical">
 <Text strong>{t('no_bank_rules_yet')}</Text>
 <Text type="secondary">{t('no_bank_rules_hint')}</Text>
 </Space>
 }
 >
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_rule')}</Button>
 </Empty>
 ),
 }}
 />
 </KitListCard>

 <FormDialog
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 title={editingId ? t('edit') : t('bankRules')} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]}>
 <Input placeholder={t('placeholder_name')} />
 </Form.Item>

 <Space wrap style={{ width: '100%' }}>
 <Form.Item label={t('field')} name="apply_to" rules={[{ required: true, message: t('required_field') }]} style={{ width: 160 }}>
 <Select placeholder={t('placeholder_select')} options={applyToOptions} />
 </Form.Item>
 <Form.Item label={t('operator')} name="condition_type" rules={[{ required: true, message: t('required_field') }]} style={{ width: 160 }}>
 <Select placeholder={t('placeholder_select')} options={conditionTypeOptions} />
 </Form.Item>
 <Form.Item label={t('value')} name="condition_value" rules={[{ required: true, message: t('required_field') }]} style={{ width: 200 }}>
 <Input placeholder={t('placeholder_description')} />
 </Form.Item>
 </Space>

 <Form.Item label={t('account')} name="target_account_id" rules={[{ required: true, message: t('required_account') }]}>
 <SelectWithQuickCreate entity="account" showSearch placeholder={t('placeholder_select')} allowClear />
 </Form.Item>

 <Form.Item label={t('contact')} name="target_contact_id">
 <SelectWithQuickCreate entity="customer" showSearch placeholder={t('placeholder_contact')} allowClear />
 </Form.Item>

 <Form.Item label={t('type')} name="rule_type" rules={[{ required: true, message: t('required_field') }]}>
 <Select placeholder={t('placeholder_select')} options={ruleTypeOptions} />
 </Form.Item>

 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button>
 <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
 </Space>
 </Form>
 </FormDialog>
 </div>
 );
};

export default BankRules;
