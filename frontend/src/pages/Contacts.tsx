import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Input, Form, Select, Modal, Radio } from 'antd';
import KitSearchInput from '../design-system/KitSearchInput';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api, { backendRetryConfig, isBackendUnavailableError } from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import ExportButton from '../components/ExportButton';
import ChatterWidget from '../components/chatter/ChatterWidget';
import { EmptyState, PageHeader, BulkActionBar, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';
const { Option } = Select;

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const Contacts: React.FC = () => {
 const { t } = useTranslation();
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [tab, setTab] = useState<'all' | 'customer' | 'vendor' | 'lead'>('all');
 const [modal, setModal] = useState(false);
 const [editing, setEditing] = useState<any>(null);
 const [form] = Form.useForm();
 const [backendUnavailable, setBackendUnavailable] = useState(false);
 const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('contacts.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 // AddGate: wire Selective Add for contacts section (R9.1, R9.5)
 const addGate = useAddGate('contacts.list');
 const forceRetryRef = useRef(false);

 const contactType = tab === 'all' ? undefined : tab;
 const contactsQuery = useListQuery<any, { items?: any[]; total?: number }, unknown>({
 queryKey: listQueryKeys.contacts({ page, search, page_size: 20, contact_type: contactType }),
 queryFn: async () => {
 const shouldForceRetry = forceRetryRef.current;
 forceRetryRef.current = false;
 return api.get('/api/contacts', {
 params: { page, search, page_size: 20, ...(contactType ? { contact_type: contactType } : {}) },
 ...(shouldForceRetry ? backendRetryConfig : {}),
 });
 },
 retry: false,
 });
 const queryData = contactsQuery.data?.items ?? [];
 const queryTotal = contactsQuery.data?.total ?? 0;
 const loading = contactsQuery.isLoading || contactsQuery.isFetching;
 const data = backendUnavailable ? [] : queryData;
 const total = backendUnavailable ? 0 : queryTotal;

 useEffect(() => {
 if (!contactsQuery.error) {
 setBackendUnavailable(false);
 return;
 }
 if (isBackendUnavailableError(contactsQuery.error)) {
 setBackendUnavailable(true);
 } else {
 message.error(t('error'));
 }
 }, [contactsQuery.error, t]);

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(total); }, [total, addGate.setRecordCount]);

 // Kit list tabs (All / Customers / Vendors / Leads) — server-side filtered.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'customer', label: t('customers', 'Customers') },
 { key: 'vendor', label: t('vendors', 'Vendors') },
 { key: 'lead', label: t('leads', 'Leads') },
 ];

 const handleSave = async (values: any) => {
 // Convert empty strings to null so Pydantic EmailStr validation passes
 const payload = Object.fromEntries(
 Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])
 );
 try {
 if (editing) {
 await api.put(`/api/contacts/${editing.id}`, payload);
 } else {
 await api.post('/api/contacts', payload);
 }
 message.success(t('success'));
 setModal(false);
 form.resetFields();
 setEditing(null);
 void contactsQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/contacts/${id}`);
 message.success(t('success'));
 void contactsQuery.refetch();
 },
 });
 };

 const openEdit = (record: any) => {
 setEditing(record);
 form.setFieldsValue(record);
 setModal(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const openDuplicate = (record: any) => {
 setEditing(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({ ...rest, display_name: `${record.display_name ?? ''} (${t('copy', 'copy')})` });
 setModal(true);
 };

 const handleBulkDelete = () => {
 Modal.confirm({
 title: t('are_you_sure'),
 content: t('data_table_v2.delete_n_confirm', 'Delete {{n}} items?', { n: selectedIds.length }),
 okButtonProps: { danger: true },
 onOk: async () => {
 await Promise.all(selectedIds.map((id) => api.delete(`/api/contacts/${id}`)));
 message.success(t('success'));
 setSelectedIds([]);
 void contactsQuery.refetch();
 },
 });
 };

 // Kit cell renderers — avatar+name, muted type chip, mono email (no blue links).
 const allColumns = [
 {
 title: t('display_name'), dataIndex: 'display_name', key: 'display_name',
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
 title: t('contact_type'), dataIndex: 'contact_type', key: 'contact_type',
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(v)}</span>
 ),
 },
 {
 title: t('email'), dataIndex: 'email', key: 'email',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('phone'), dataIndex: 'phone', key: 'phone',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('company_name'), dataIndex: 'company_name', key: 'company_name',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openEdit(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => openDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];
 // The Actions column is structural — it must never be hidden, even if a
 // stale `hiddenCols` entry from the old layout still has 'actions' in
 // localStorage (the previous version listed Actions as a "pinned" toggle).
 const columns = useMemo(
   () => allColumns.filter((c) => c.key === 'actions' || !hiddenCols.includes(c.key)),
   [hiddenCols, t],
 );
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'display_name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('contacts.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div data-addgate-section="contacts.list">
 <PageHeader
 title={t('contacts')}
 subtitle={t('contacts_subtitle', 'Customers and vendors')}
 helpKey="contacts"
 sectionId="contacts.list"
 extra={
 <Space>
 <ExportButton endpoint="/api/export/customers" filename="customers" />
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }} data-add-action="contacts.list">
 {t('new_contact')}
 </Button>
 </Space>
 }
 />
 {backendUnavailable ? (
 <EmptyState
 icon={<WarningOutlined />}
 title={t('backend_unavailable_title')}
 description={t('backend_unavailable_description')}
 actionLabel={t('retry')}
 onAction={() => {
 forceRetryRef.current = true;
 void contactsQuery.refetch();
 }}
 />
 ) : (
 <>
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as typeof tab); setPage(1); setSelectedIds([]); }}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPage(1); }}
 placeholder={t('search')}
 />
 {/* Group Filters + Type in a single flex unit so they ALWAYS wrap
 together to the same line — never one stranded on a row by itself
 (the user's report on mobile: "بیانبە تەنیشت یەکتر"). */}
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => { setTab('all'); setPage(1); }}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => { setTab(e.target.value); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="customer">{t('customers', 'Customers')}</Radio>
 <Radio value="vendor">{t('vendors', 'Vendors')}</Radio>
 <Radio value="lead">{t('leads', 'Leads')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('type', 'Type')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as typeof tab); setPage(1); }}
 options={[
 { value: 'customer', label: t('customers', 'Customers') },
 { value: 'vendor', label: t('vendors', 'Vendors') },
 { value: 'lead', label: t('leads', 'Leads') },
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
 downloadCsv('contacts', data, cols);
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
 dataSource={data}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
 rowSelection={{
 selectedRowKeys: selectedIds,
 onChange: (keys: React.Key[]) => setSelectedIds(keys),
 }}
 />
 </KitListCard>
 <BulkActionBar
 selectedCount={selectedIds.length}
 onClear={() => setSelectedIds([])}
 isDark={isDark}
 actions={[
 { key: 'delete', label: t('delete'), icon: <DeleteOutlined />, danger: true, onClick: handleBulkDelete },
 ]}
 />
 </>
 )}

 <FormDialog
 title={editing ? t('edit') : t('new_contact')}
 open={modal}
 onClose={() => { setModal(false); setEditing(null); form.resetFields(); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ contact_type: 'customer' }}>
 <Form.Item label={t('contact_type')} name="contact_type" rules={[{ required: true, message: t('required_field') }]}>
 <Select placeholder={t('placeholder_select')}>
 <Option value="customer">{t('customer')}</Option>
 <Option value="vendor">{t('vendor')}</Option>
 </Select>
 </Form.Item>
 <Form.Item label={t('display_name')} name="display_name" rules={[{ required: true, message: t('required_name') }]}>
 <Input placeholder={t('placeholder_name')} />
 </Form.Item>
 <Form.Item label={t('company_name')} name="company_name">
 <Input placeholder={t('placeholder_company')} />
 </Form.Item>
 <Form.Item label={t('email')} name="email" rules={[{ type: 'email', message: t('invalid_email') }]}>
 <Input placeholder={t('placeholder_email')} />
 </Form.Item>
 <Form.Item label={t('phone')} name="phone">
 <Input placeholder={t('placeholder_phone')} />
 </Form.Item>
 </Form>
 {editing?.id && (
 <div style={{ marginTop: 16 }}>
 <ChatterWidget entityType="contact" entityId={editing.id} />
 </div>
 )}
 </FormDialog>
 </div>
 );
};

export default Contacts;
