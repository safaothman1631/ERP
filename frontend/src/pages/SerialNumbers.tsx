import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, DatePicker, Space } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../api';
import { PageHeader, StatusTag, type StatusKind, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface Serial {
 id: string;
 item_id: string;
 serial_number: string;
 status: string;
 batch_number?: string;
 expiry_date?: string;
 purchase_date?: string;
 notes?: string;
}

interface Item {
 id: string;
 name: string;
 sku?: string;
}

/** Map domain serial-status → StatusTag semantic kind (Vertex tokens). */
const STATUS_KIND: Record<string, StatusKind> = {
 in_stock: 'active',
 sold: 'info',
 reserved: 'pending',
 damaged: 'error',
 returned: 'archived',
};
const STATUS_KEYS = ['in_stock', 'sold', 'reserved', 'damaged', 'returned'];

const SerialNumbers: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Serial[]>([]);
 const [items, setItems] = useState<Item[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [filterItem, setFilterItem] = useState<string | undefined>();
 const [filterStatus, setFilterStatus] = useState<string | undefined>();
 const [search, setSearch] = useState('');
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('serialNumbers.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchItems = () => {
 api.get('/api/items', { params: { page_size: 500 } })
 .then(r => setItems(r.data.items || r.data || []))
 .catch((e) => console.error(e));
 };

 const fetchData = () => {
 setLoading(true);
 const params: Record<string, unknown> = { page_size: 500 };
 if (filterItem) params.item_id = filterItem;
 if (filterStatus) params.status = filterStatus;
 api.get('/api/inventory/serials', { params })
 .then(r => setData(r.data.items || []))
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 useEffect(() => { fetchItems(); }, []);
 useEffect(() => { fetchData(); }, [filterItem, filterStatus]);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 setModalOpen(true);
 };

 const openEdit = (record: Serial) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 expiry_date: record.expiry_date ? dayjs(record.expiry_date) : undefined,
 purchase_date: record.purchase_date ? dayjs(record.purchase_date) : undefined,
 });
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 expiry_date: values.expiry_date ? (values.expiry_date as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
 purchase_date: values.purchase_date ? (values.purchase_date as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
 };
 if (editingId) {
 await api.put(`/api/inventory/serials/${editingId}`, payload);
 } else {
 await api.post('/api/inventory/serials', payload);
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

 const itemNameById = (id: string) => items.find(i => i.id === id)?.name || id;

 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);

 // Kit list tabs (All + 5 status segments) — server-side filtered via status param.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...STATUS_KEYS.map((s) => ({ key: s, label: t(s) || s })),
 ];
 const activeTab = filterStatus || 'all';

 const allColumns = [
 {
 title: t('serial_number'), dataIndex: 'serial_number', key: 'serial_number',
 render: (v: string) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 ),
 },
 {
 title: t('item'), dataIndex: 'item_id', key: 'item_id',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{itemNameById(v)}</span>,
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (v: string) => <StatusTag status={STATUS_KIND[v] || 'default'} label={t(v) || v} />,
 },
 {
 title: t('batch_number'), dataIndex: 'batch_number', key: 'batch_number',
 render: (v?: string) => v
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('expiry_date'), dataIndex: 'expiry_date', key: 'expiry_date',
 render: (d?: string) => d
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{d.substring(0, 10)}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, r: Serial) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openEdit(r) },
 ]}
 />
 ),
 },
 ];
 const visibleColumns = useMemo(
 () => allColumns.filter((c) => !hiddenCols.includes(c.key as string)),
 [hiddenCols, allColumns],
 );
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'serial_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('serialNumbers.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('serial_numbers')}
 helpKey="serial_numbers"
 sectionId="inventory.serial_numbers"
 extra={<Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_serial')}</Button>}
 />

 <KitListCard
 tabs={tabs}
 activeTab={activeTab}
 onTabChange={(k) => setFilterStatus(k === 'all' ? undefined : k)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={filterItem ? 1 : 0}
 onClear={() => setFilterItem(undefined)}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
 <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>{t('filter_by_item')}</span>
 <Select
 allowClear
 showSearch
 optionFilterProp="label"
 placeholder={t('filter_by_item')}
 value={filterItem}
 onChange={setFilterItem}
 options={items.map(i => ({ label: `${i.sku || ''} ${i.name}`.trim(), value: i.id }))}
 />
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={filterStatus || ''}
 onChange={(v) => setFilterStatus(v || undefined)}
 options={STATUS_KEYS.map((s) => ({ value: s, label: t(s) || s }))}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('serial-numbers', data, cols);
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
 <ResponsiveTableAdapter rowKey="id" columns={visibleColumns} dataSource={filteredData} loading={loading} pagination={{ pageSize: 50 }} />
 </KitListCard>

 <FormDialog
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 title={editingId ? t('edit_serial') : t('new_serial')} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item label={t('item')} name="item_id" rules={[{ required: true, message: t('required_field') }]}>
 <Select
 showSearch
 optionFilterProp="label"
 placeholder={t('placeholder_select')}
 options={items.map(i => ({ label: `${i.sku || ''} ${i.name}`.trim(), value: i.id }))}
 disabled={!!editingId}
 />
 </Form.Item>
 <Form.Item label={t('serial_number')} name="serial_number" rules={[{ required: true, message: t('required_field') }]}>
 <Input placeholder="SN-0001" disabled={!!editingId} />
 </Form.Item>
 {editingId && (
 <Form.Item label={t('status')} name="status">
 <Select options={STATUS_KEYS.map(s => ({ label: t(s) || s, value: s }))} />
 </Form.Item>
 )}
 <Form.Item label={t('batch_number')} name="batch_number">
 <Input />
 </Form.Item>
 <Form.Item label={t('purchase_date')} name="purchase_date">
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('expiry_date')} name="expiry_date">
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('notes')} name="notes">
 <Input.TextArea rows={2} />
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

export default SerialNumbers;
