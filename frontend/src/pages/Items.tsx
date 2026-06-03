import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Input, Form, InputNumber, Modal, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api, { backendRetryConfig, isBackendUnavailableError } from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import ExportButton from '../components/ExportButton';
import { EmptyState, PageHeader, BulkActionBar, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';
import ChatterWidget from '../components/chatter/ChatterWidget';

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const Items: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [tab, setTab] = useState<'all' | 'goods' | 'service'>('all');
 const [modal, setModal] = useState(false);
 const [editing, setEditing] = useState<any>(null);
 const [form] = Form.useForm();
 const [backendUnavailable, setBackendUnavailable] = useState(false);
 const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('items.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 // AddGate: wire Selective Add for items section (R9.1, R9.5)
 const addGate = useAddGate('inventory.items');
 const forceRetryRef = useRef(false);

 const itemType = tab === 'all' ? undefined : tab;
 const itemsQuery = useListQuery<any, { items?: any[]; total?: number }, unknown>({
 queryKey: listQueryKeys.items({ page, search, page_size: 20, item_type: itemType }),
 queryFn: async () => {
 const shouldForceRetry = forceRetryRef.current;
 forceRetryRef.current = false;
 return api.get('/api/items', {
 params: { page, search, page_size: 20, ...(itemType ? { item_type: itemType } : {}) },
 ...(shouldForceRetry ? backendRetryConfig : {}),
 });
 },
 retry: false,
 });
 const queryData = itemsQuery.data?.items ?? [];
 const queryTotal = itemsQuery.data?.total ?? 0;
 const loading = itemsQuery.isLoading || itemsQuery.isFetching;
 const data = backendUnavailable ? [] : queryData;
 const total = backendUnavailable ? 0 : queryTotal;

 useEffect(() => {
 if (!itemsQuery.error) {
 setBackendUnavailable(false);
 return;
 }
 if (isBackendUnavailableError(itemsQuery.error)) {
 setBackendUnavailable(true);
 } else {
 message.error(t('error'));
 }
 }, [itemsQuery.error, t]);

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(total); }, [total, addGate.setRecordCount]);

 // Kit list tabs (All / Goods / Services) — server-side filtered via item_type.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'goods', label: t('goods', 'Goods') },
 { key: 'service', label: t('services', 'Services') },
 ];

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.put(`/api/items/${editing.id}`, values);
 } else {
 await api.post('/api/items', values);
 }
 message.success(t('success'));
 setModal(false); form.resetFields(); setEditing(null); void itemsQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => { await api.delete(`/api/items/${id}`); message.success(t('success')); void itemsQuery.refetch(); },
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
 form.setFieldsValue({ ...rest, name: `${record.name ?? ''} (${t('copy', 'copy')})` });
 setModal(true);
 };

 const handleBulkDelete = () => {
 Modal.confirm({
 title: t('are_you_sure'),
 content: t('data_table_v2.delete_n_confirm', 'Delete {{n}} items?', { n: selectedIds.length }),
 okButtonProps: { danger: true },
 onOk: async () => {
 await Promise.all(selectedIds.map((id) => api.delete(`/api/items/${id}`)));
 message.success(t('success'));
 setSelectedIds([]);
 void itemsQuery.refetch();
 },
 });
 };

 // Kit cell renderers — avatar+name, muted type chip, mono numbers (no blue links).
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
 title: t('sku'), dataIndex: 'sku', key: 'sku',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('selling_price'), dataIndex: 'selling_price', key: 'selling_price',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {v?.toLocaleString() ?? '—'}
 </span>
 ),
 },
 {
 title: t('cost_price'), dataIndex: 'cost_price', key: 'cost_price',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {v?.toLocaleString() ?? '—'}
 </span>
 ),
 },
 {
 title: t('stock'), dataIndex: 'stock_on_hand', key: 'stock_on_hand',
 render: (v: number | undefined) => (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)' }}>
 {v != null ? v.toLocaleString() : '—'}
 </span>
 ),
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
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));

 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('items.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div data-addgate-section="inventory.items">
 <PageHeader
 title={t('items')}
 subtitle={t('items_subtitle', 'Items and services')}
 helpKey="items"
 sectionId="inventory.items"
 extra={
 <Space>
 <ExportButton endpoint="/api/export/products" filename="products" />
 <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/items/new')} data-add-action="inventory.items">{t('new_item')}</Button>
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
 void itemsQuery.refetch();
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
 {/* Group Filters + Type so they wrap together to the same line. */}
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
 <Radio value="goods">{t('goods', 'Goods')}</Radio>
 <Radio value="service">{t('services', 'Services')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('type', 'Type')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as typeof tab); setPage(1); }}
 options={[
 { value: 'goods', label: t('goods', 'Goods') },
 { value: 'service', label: t('services', 'Services') },
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
 downloadCsv('items', data, cols);
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

 <FormDialog title={editing ? t('edit') : t('new_item')} open={modal} onClose={() => { setModal(false); setEditing(null); form.resetFields(); }} onOk={() => form.submit()}>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ item_type: 'goods', selling_price: 0, cost_price: 0 }}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]}><Input placeholder={t('placeholder_item_name')} /></Form.Item>
 <Form.Item label={t('sku')} name="sku"><Input placeholder={t('placeholder_sku')} /></Form.Item>
 <Form.Item label={t('description')} name="description"><Input.TextArea rows={2} placeholder={t('placeholder_description')} /></Form.Item>
 <Space style={{ width: '100%' }}>
 <Form.Item label={t('selling_price')} name="selling_price"><InputNumber min={0} style={{ width: 200 }} placeholder={t('placeholder_amount')} /></Form.Item>
 <Form.Item label={t('cost_price')} name="cost_price"><InputNumber min={0} style={{ width: 200 }} placeholder={t('placeholder_amount')} /></Form.Item>
 </Space>
 {editing?.id && <ChatterWidget entityType="item" entityId={editing.id} />}
 </Form>
 </FormDialog>
 </div>
 );
};

export default Items;
