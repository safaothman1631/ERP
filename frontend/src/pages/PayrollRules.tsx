import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, message, Switch, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, DataTable, StatusTag, type ColumnVisibilityItem } from '../design-system';
import type { ColumnDef } from '../design-system/DataTable';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { FormDialog } from '../components/responsive/FormDialog';
import { downloadCsv } from '../utils/exportCsv';

interface Rule {
 id: string; code: string; name: string; type?: string; amount_type?: string;
 amount?: number; apply_on?: string; active?: boolean;
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

export default function PayrollRules() {
 const { t } = useTranslation();
 const [list, setList] = useState<Rule[]>([]);
 const [open, setOpen] = useState(false);
 const [editing, setEditing] = useState<Rule | null>(null);
 const [form] = Form.useForm();
 const [tab, setTab] = useState<string>('all');
 const [activeFilter, setActiveFilter] = useState<string>('');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('payroll_rules.hiddenCols') || '[]'); } catch { return []; }
 });

 const load = async () => {
 const r = await api.get('/api/payroll/rules');
 setList(r.data.items || []);
 };
 useEffect(() => { load(); }, []);

 const save = async () => {
 const v = await form.validateFields();
 try {
 if (editing) await api.put(`/api/payroll/rules/${editing.id}`, v);
 else await api.post('/api/payroll/rules', v);
 message.success(t('saved'));
 setOpen(false); setEditing(null); form.resetFields();
 load();
 } catch { message.error(t('error')); }
 };
 const remove = async (id: string) => {
 try { await api.delete(`/api/payroll/rules/${id}`); load(); }
 catch { message.error(t('error')); }
 };

 const startEdit = (r: Rule) => { setEditing(r); form.setFieldsValue(r); setOpen(true); };

 // Duplicate: open the create form pre-filled with this rule's values (no id).
 const startDuplicate = (r: Rule) => {
 setEditing(null);
 const { id: _id, ...rest } = r;
 form.setFieldsValue({ ...rest, code: '', name: `${r.name ?? ''} (${t('copy', 'copy')})` });
 setOpen(true);
 };

 // Kit list tabs (All / Allowance / Deduction / Tax / Social security) — client-side filter on `type`.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'allowance', label: t('allowance') },
 { key: 'deduction', label: t('deduction') },
 { key: 'tax', label: t('tax') },
 { key: 'social_security', label: t('social_security') },
 ];

 const filtered = useMemo(() => {
 const q = search.trim().toLowerCase();
 return list.filter((r) => {
 if (tab !== 'all' && r.type !== tab) return false;
 if (activeFilter === 'active' && !r.active) return false;
 if (activeFilter === 'inactive' && r.active) return false;
 if (q && !Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
 return true;
 });
 }, [list, tab, activeFilter, search]);

 const allColumns: ColumnDef<Rule>[] = [
 {
 title: t('code'), dataIndex: 'code', key: 'code',
 render: (s: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{s || '—'}</span>
 ),
 },
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
 title: t('type'), dataIndex: 'type', key: 'type',
 render: (s?: string) => s ? (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(s)}</span>
 ) : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('amount_type'), dataIndex: 'amount_type', key: 'amount_type',
 render: (s?: string) => s ? (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(s)}</span>
 ) : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('amount'), dataIndex: 'amount', key: 'amount', align: 'right' as const,
 render: (n: number, r: Rule) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {r.amount_type === 'percent' ? `${n}%` : n.toLocaleString()}
 </span>
 ),
 },
 {
 title: t('active'), dataIndex: 'active', key: 'active',
 render: (b: boolean) => <StatusTag status={b ? 'active' : 'default'} label={b ? t('yes') : t('no')} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, r: Rule) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => startEdit(r) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => startDuplicate(r) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => remove(r.id) },
 ]}
 />
 ),
 },
 ];

 const cols = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('payroll_rules.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('salary_rules')}
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
 {t('new_rule')}
 </Button>
 </Space>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => setTab(k)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={(tab !== 'all' ? 1 : 0) + (activeFilter ? 1 : 0)}
 onClear={() => { setTab('all'); setActiveFilter(''); }}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => setTab(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="allowance">{t('allowance')}</Radio>
 <Radio value="deduction">{t('deduction')}</Radio>
 <Radio value="tax">{t('tax')}</Radio>
 <Radio value="social_security">{t('social_security')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('active', 'Active')}
 anyLabel={t('all', 'All')}
 value={activeFilter}
 onChange={(v) => setActiveFilter(v)}
 options={[
 { value: 'active', label: t('yes') },
 { value: 'inactive', label: t('no') },
 ]}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const exportCols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('payroll_rules', filtered, exportCols);
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
 <DataTable rowKey="id" dataSource={filtered} columns={cols} pagination={false} />
 </KitListCard>

 <FormDialog open={open} onOk={save} onClose={() => setOpen(false)} title={editing ? t('edit_rule') : t('new_rule')}>
 <Form form={form} layout="vertical">
 <Form.Item name="code" label={t('code')} rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item name="type" label={t('type')} initialValue="allowance">
 <Select options={[
 { value: 'allowance', label: t('allowance') },
 { value: 'deduction', label: t('deduction') },
 { value: 'tax', label: t('tax') },
 { value: 'social_security', label: t('social_security') },
 ]} />
 </Form.Item>
 <Form.Item name="amount_type" label={t('amount_type')} initialValue="fixed">
 <Select options={[
 { value: 'fixed', label: t('fixed') },
 { value: 'percent', label: t('percent') },
 ]} />
 </Form.Item>
 <Form.Item name="amount" label={t('amount')} initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="active" label={t('active')} initialValue={true} valuePropName="checked"><Switch /></Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
