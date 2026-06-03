import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, Switch, Space, Modal, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import { message } from '../utils/message';
import api from '../api';
import { PageHeader, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface Company {
 id: string;
 name: string;
 code?: string;
 currency?: string;
 tax_id?: string;
 address?: string;
 phone?: string;
 email?: string;
 is_primary?: boolean;
 is_active?: boolean;
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

export default function Companies() {
 const { t } = useTranslation();
 const [data, setData] = useState<Company[]>([]);
 const [loading, setLoading] = useState(false);
 const [open, setOpen] = useState(false);
 const [editing, setEditing] = useState<Company | null>(null);
 const [form] = Form.useForm();
 const [tab, setTab] = useState<'all' | 'active' | 'inactive'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('companies.hiddenCols') || '[]'); } catch { return []; }
 });

 const load = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/companies');
 setData(Array.isArray(res.data) ? res.data : []);
 } catch {
 message.error(t('error'));
 }
 setLoading(false);
 };

 useEffect(() => { load(); }, []);

 const onSubmit = async (values: Record<string, unknown>) => {
 try {
 if (editing && !editing.is_primary) {
 await api.put(`/api/companies/${editing.id}`, values);
 message.success(t('updated'));
 } else {
 await api.post('/api/companies', values);
 message.success(t('created'));
 }
 setOpen(false);
 form.resetFields();
 setEditing(null);
 load();
 } catch {
 message.error(t('error'));
 }
 };

 const onSwitch = async (id: string) => {
 try {
 await api.post(`/api/companies/${id}/switch`);
 localStorage.setItem('active_company_id', id);
 message.success(t('switched') || 'Switched');
 } catch {
 message.error(t('error'));
 }
 };

 const onArchive = (record: Company) => {
 if (record.is_primary) {
 message.warning(t('cannot_archive_primary') || 'Cannot archive primary');
 return;
 }
 Modal.confirm({
 title: t('confirmDelete'),
 onOk: async () => {
 try {
 await api.delete(`/api/companies/${record.id}`);
 message.success(t('deleted'));
 load();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 // Kit list tabs (All / Active / Inactive) — client-side filtered.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'active', label: t('active', 'Active') },
 { key: 'inactive', label: t('inactive', 'Inactive') },
 ];

 const filteredData = useMemo(() => {
 let rows = data;
 if (tab === 'active') rows = rows.filter((d) => d.is_active !== false);
 else if (tab === 'inactive') rows = rows.filter((d) => d.is_active === false);
 if (search) {
 const q = search.toLowerCase();
 rows = rows.filter((row: Company) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
 );
 }
 return rows;
 }, [data, tab, search]);

 const allColumns = [
 {
 title: t('name'),
 dataIndex: 'name',
 key: 'name',
 render: (v: string, r: Company) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(v)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 {r.is_primary && (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--accent-soft)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--accent-500)',
 }}>{t('primary', 'Primary')}</span>
 )}
 </div>
 ),
 },
 {
 title: t('code'),
 dataIndex: 'code',
 key: 'code',
 render: (v: string) => v
 ? <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('currency'),
 dataIndex: 'currency',
 key: 'currency',
 render: (v: string) => v
 ? <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('tax_id') || 'Tax ID',
 dataIndex: 'tax_id',
 key: 'tax_id',
 render: (v: string) => v
 ? <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('phone'),
 dataIndex: 'phone',
 key: 'phone',
 render: (v: string) => v
 ? <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('active'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (v: boolean) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: v ? 'var(--success-bg, var(--surface-2))' : 'var(--surface-2)',
 border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600,
 color: v ? 'var(--success-fg, var(--ink-700))' : 'var(--ink-500)',
 }}>{v ? t('yes') : t('no')}</span>
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, r: Company) => {
 const actions: Array<{ key: string; label: string; icon?: React.ReactNode; danger?: boolean; onClick?: () => void } | { type: 'divider' }> = [
 { key: 'switch', icon: <SwapOutlined />, label: t('switch', 'Switch'), onClick: () => onSwitch(r.id) },
 ];
 if (!r.is_primary) {
 actions.push({ key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => { setEditing(r); form.setFieldsValue(r); setOpen(true); } });
 actions.push({ type: 'divider' });
 actions.push({ key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => onArchive(r) });
 }
 return <KitRowActions ariaLabel={t('actions') || 'Actions'} actions={actions} />;
 },
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
 try { localStorage.setItem('companies.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('companies') || 'Companies'}
 subtitle={t('companies_subtitle', 'Manage multiple companies')}
 extra={
 <Space>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}
 >
 {t('new_company') || 'New Company'}
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
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => { setTab('all'); }}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => { setTab(e.target.value); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="active">{t('active', 'Active')}</Radio>
 <Radio value="inactive">{t('inactive', 'Inactive')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as typeof tab); }}
 options={[
 { value: 'active', label: t('active', 'Active') },
 { value: 'inactive', label: t('inactive', 'Inactive') },
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
 downloadCsv('companies', filteredData, cols);
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
 rowKey="id"
 dataSource={filteredData}
 columns={visibleColumns}
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </KitListCard>
 <FormDialog
 title={editing ? (t('edit') + ' ' + t('company')) : (t('new_company') || 'New Company')}
 open={open}
 onClose={() => { setOpen(false); setEditing(null); form.resetFields(); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={onSubmit}>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="code" label={t('code')}>
 <Input />
 </Form.Item>
 <Form.Item name="currency" label={t('currency')} initialValue="IQD">
 <Input />
 </Form.Item>
 <Form.Item name="tax_id" label={t('tax_id') || 'Tax ID'}>
 <Input />
 </Form.Item>
 <Form.Item name="phone" label={t('phone')}>
 <Input />
 </Form.Item>
 <Form.Item name="email" label={t('email')}>
 <Input type="email" />
 </Form.Item>
 <Form.Item name="address" label={t('address')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 {editing && (
 <Form.Item name="is_active" label={t('active')} valuePropName="checked">
 <Switch />
 </Form.Item>
 )}
 </Form>
 </FormDialog>
 </div>
 );
}
