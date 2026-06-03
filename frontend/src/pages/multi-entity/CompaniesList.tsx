import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Radio } from 'antd';
import { PlusOutlined, SwapOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import api from '../../api';
import { message } from '../../utils/message';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { SelectWithQuickCreate } from '../../design-system/empty/SelectWithQuickCreate';
import { ListWithEmptyState } from '../../design-system/empty/ListWithEmptyState';

interface Company {
 id: string;
 name: string;
 code: string;
 currency: string;
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

const CompaniesList = () => {
 const { t } = useTranslation();
 const [loading, setLoading] = useState(false);
 const [companies, setCompanies] = useState<Company[]>([]);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 // Client-side status segment (companies load fully into local state — no server param).
 const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('companies.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchCompanies = async () => {
 setLoading(true);
 try {
 const { data } = await api.get('/api/companies');
 setCompanies(data);
 } catch (_err) {
 message.error(t('multi_entity.error_loading_companies'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchCompanies();
 }, []);

 const handleCreate = () => {
 setEditingId(null);
 form.resetFields();
 setDrawerOpen(true);
 };

 const handleEdit = (record: Company) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setDrawerOpen(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 if (editingId) {
 await api.put(`/api/companies/${editingId}`, values);
 message.success(t('multi_entity.company_updated'));
 } else {
 await api.post('/api/companies', values);
 message.success(t('multi_entity.company_created'));
 }
 setDrawerOpen(false);
 fetchCompanies();
 } catch (_err) {
 message.error(t('multi_entity.error_saving_company'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/companies/${id}`);
 message.success(t('multi_entity.company_deleted'));
 fetchCompanies();
 } catch (_err) {
 message.error(t('multi_entity.error_deleting_company'));
 }
 };

 const handleSwitch = async (id: string) => {
 try {
 await api.post(`/api/companies/${id}/switch`);
 message.success(t('multi_entity.company_switched'));
 } catch (_err) {
 message.error(t('multi_entity.error_switching_company'));
 }
 };

 // Kit list tabs (All / Active / Inactive) — client-side filtered on is_active.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'active', label: t('multi_entity.active') },
 { key: 'inactive', label: t('multi_entity.inactive') },
 ];

 const visibleRows = useMemo(
 () => {
 const statusFiltered = companies.filter((c) => {
 if (statusFilter === 'active') return c.is_active !== false;
 if (statusFilter === 'inactive') return c.is_active === false;
 return true;
 });
 if (!search) return statusFiltered;
 const q = search.toLowerCase();
 return statusFiltered.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 },
 [companies, statusFilter, search],
 );

 const allColumns: ColumnsType<Company> = [
 {
 title: t('multi_entity.company_name'),
 dataIndex: 'name',
 key: 'name',
 render: (text: string, record: Company) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(text)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{text}</span>
 {record.is_primary && <StatusTag status="info" label={t('multi_entity.base_entity')} />}
 </div>
 ),
 },
 {
 title: t('multi_entity.code'),
 dataIndex: 'code',
 key: 'code',
 render: (v: string) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 ),
 },
 {
 title: t('multi_entity.currency'),
 dataIndex: 'currency',
 key: 'currency',
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{v}</span>
 ),
 },
 {
 title: t('multi_entity.tax_id'),
 dataIndex: 'tax_id',
 key: 'tax_id',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('multi_entity.status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (active: boolean) => (
 <StatusTag status={active ? 'active' : 'inactive'} label={active ? t('multi_entity.active') : t('multi_entity.inactive')} />
 ),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: unknown, record: Company) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'switch', icon: <SwapOutlined />, label: t('multi_entity.switch'), disabled: record.is_primary, onClick: () => handleSwitch(record.id) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), disabled: record.is_primary, onClick: () => handleEdit(record) },
 ...(record.is_primary ? [] : [
 { type: 'divider' as const },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]),
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes((c as { key: string }).key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => {
 const key = (c as { key: string }).key;
 return {
 key,
 label: typeof c.title === 'string' ? c.title : key,
 pinned: key === 'name' || key === 'actions',
 };
 });
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('companies.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <>
 <PageHeader
 title={t('multi_entity.companies')}
 subtitle={t('multi_entity.companies_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('multi_entity.add_company')}
 </Button>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={statusFilter}
 onTabChange={(k) => setStatusFilter(k as typeof statusFilter)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusFilter !== 'all' ? 1 : 0}
 onClear={() => setStatusFilter('all')}
 >
 <Radio.Group
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="active">{t('multi_entity.active')}</Radio>
 <Radio value="inactive">{t('multi_entity.inactive')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('multi_entity.status')}
 anyLabel={t('all', 'All')}
 value={statusFilter === 'all' ? '' : statusFilter}
 onChange={(v) => setStatusFilter((v || 'all') as typeof statusFilter)}
 options={[
 { value: 'active', label: t('multi_entity.active') },
 { value: 'inactive', label: t('multi_entity.inactive') },
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
 downloadCsv('companies', visibleRows, cols);
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
 entity="company"
 data={visibleRows}
 loading={loading}
 onCreate={handleCreate}
 onRetry={fetchCompanies}
 render={(rows) => (
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={rows}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 )}
 />
 </KitListCard>

 <FormDialog
 title={editingId ? t('multi_entity.edit_company') : t('multi_entity.add_company')}
 open={drawerOpen}
 onClose={() => setDrawerOpen(false)}
 footer={
 <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
 <Button onClick={() => setDrawerOpen(false)}>{t('cancel')}</Button>
 <Button type="primary" onClick={handleSave}>
 {t('save')}
 </Button>
 </div>
 }
 >
 <Form form={form} layout="vertical">
 <Form.Item
 name="name"
 label={t('multi_entity.company_name')}
 rules={[{ required: true, message: t('multi_entity.name_required') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item
 name="code"
 label={t('multi_entity.code')}
 rules={[{ required: true, message: t('multi_entity.code_required') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item
 name="currency"
 label={t('multi_entity.currency')}
 rules={[{ required: true, message: t('multi_entity.currency_required') }]}
 >
 <SelectWithQuickCreate entity="currency" />
 </Form.Item>
 <Form.Item name="tax_id" label={t('multi_entity.tax_id')}>
 <Input />
 </Form.Item>
 <Form.Item name="address" label={t('multi_entity.address')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="phone" label={t('multi_entity.phone')}>
 <Input />
 </Form.Item>
 <Form.Item name="email" label={t('multi_entity.email')}>
 <Input />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default CompaniesList;
