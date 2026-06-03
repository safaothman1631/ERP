import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, Space, Modal, InputNumber, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface PriceListItem {
 item_id: string;
 item_name: string;
 custom_rate: number;
}

interface PriceList {
 id: string;
 name: string;
 type: string;
 currency_code: string;
 is_default: boolean;
 items: PriceListItem[];
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

const PriceLists: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<PriceList[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [items, setItems] = useState<{ id: string; name: string; selling_price: number }[]>([]);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [priceItems, setPriceItems] = useState<{ key: number; item_id: string; custom_rate: number }[]>([]);
 const [tab, setTab] = useState<'all' | 'fixed' | 'markdown'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('priceLists.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = () => {
 setLoading(true);
 api.get('/api/inventory/price-lists')
 .then(r => setData(r.data.items || []))
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 useEffect(() => { fetchData(); }, []);

 const openNew = async () => {
 const i = await api.get('/api/items', { params: { page_size: 200 } });
 setItems(i.data.items || i.data);
 setEditingId(null);
 setPriceItems([]);
 form.resetFields();
 setModalOpen(true);
 };

 const openEdit = async (record: PriceList) => {
 const i = await api.get('/api/items', { params: { page_size: 200 } });
 setItems(i.data.items || i.data);
 setEditingId(record.id);
 form.setFieldsValue({ name: record.name, type: record.type, currency_code: record.currency_code, is_default: record.is_default });
 setPriceItems((record.items || []).map((pi, idx) => ({ key: idx, item_id: pi.item_id, custom_rate: pi.custom_rate })));
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 items: priceItems.map(p => ({ item_id: p.item_id, custom_rate: p.custom_rate })),
 };
 if (editingId) {
 await api.put(`/api/inventory/price-lists/${editingId}`, payload);
 } else {
 await api.post('/api/inventory/price-lists', payload);
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
 await api.delete(`/api/inventory/price-lists/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const updatePriceItem = (key: number, field: string, value: unknown) => {
 setPriceItems(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p));
 };

 const fmtIQD = (v: number) => `${new Intl.NumberFormat('en-US').format(v || 0)} IQD`;

 // Client-side filter by tab + search (no server param exists for type).
 const filteredData = useMemo(() => {
 const byTab = tab === 'all' ? data : data.filter((r) => r.type === tab);
 if (!search) return byTab;
 const q = search.toLowerCase();
 return byTab.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }, [data, tab, search]);

 // Kit list tabs (All / Fixed / Markdown) — type segments.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'fixed', label: t('fixed', 'Fixed') },
 { key: 'markdown', label: t('markdown', 'Markdown') },
 ];

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
 title: t('type'), dataIndex: 'type', key: 'type',
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(v, v)}</span>
 ),
 },
 {
 title: t('currency'), dataIndex: 'currency_code', key: 'currency_code',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('default'), dataIndex: 'is_default', key: 'is_default',
 render: (v: boolean) => v
 ? <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--success-bg, var(--accent-soft))', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--success-fg, var(--accent-500))',
 }}>{t('default')}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, r: PriceList) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openEdit(r) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openEdit(r) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(r.id) },
 ]}
 />
 ),
 },
 ];
 const visibleColumns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, allColumns]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('priceLists.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const nestedColumns = [
 { title: t('items'), dataIndex: 'item_name', key: 'item_name' },
 { title: t('custom_rate'), dataIndex: 'custom_rate', key: 'custom_rate', render: (v: number) => fmtIQD(v) },
 ];

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('create')}</Button>
 </div>

 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as typeof tab); }}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); }}
 placeholder={t('search')}
 />
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
 <Radio value="fixed">{t('fixed', 'Fixed')}</Radio>
 <Radio value="markdown">{t('markdown', 'Markdown')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('type', 'Type')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as typeof tab); }}
 options={[
 { value: 'fixed', label: t('fixed', 'Fixed') },
 { value: 'markdown', label: t('markdown', 'Markdown') },
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
 downloadCsv('price-lists', filteredData, cols);
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
 expandable={{
 expandedRowRender: (record: PriceList) => (
 <ResponsiveTableAdapter dataSource={record.items || []} columns={nestedColumns} rowKey="item_id" pagination={false} />
 ),
 }}
 />
 </KitListCard>

 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('edit') : t('priceLists')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ currency_code: 'IQD', type: 'fixed' }}>
 <Space wrap>
 <Form.Item label={t('name')} name="name" rules={[{ required: true }]} style={{ width: 220 }}>
 <Input />
 </Form.Item>
 <Form.Item label={t('type')} name="type" rules={[{ required: true }]} style={{ width: 160 }}>
 <Select options={[
 { label: 'Fixed', value: 'fixed' },
 { label: 'Markdown', value: 'markdown' },
 ]} />
 </Form.Item>
 <Form.Item label={t('currency')} name="currency_code" style={{ width: 120 }}>
 <Input />
 </Form.Item>
 </Space>

 <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('items')}</div>
 <table style={{ width: '100%', marginBottom: 8 }}>
 <thead>
 <tr><th>{t('items')}</th><th>{t('custom_rate')}</th><th></th></tr>
 </thead>
 <tbody>
 {priceItems.map(p => (
 <tr key={p.key}>
 <td style={{ padding: 4 }}>
 <Select
 style={{ width: 280 }}
 value={p.item_id || undefined}
 onChange={v => updatePriceItem(p.key, 'item_id', v)}
 options={items.map(i => ({ label: i.name, value: i.id }))}
 showSearch
 optionFilterProp="label"
 />
 </td>
 <td style={{ padding: 4 }}>
 <InputNumber min={0} value={p.custom_rate} onChange={v => updatePriceItem(p.key, 'custom_rate', v || 0)} style={{ width: 160 }} />
 </td>
 <td style={{ padding: 4 }}>
 <Button icon={<DeleteOutlined />} danger onClick={() => setPriceItems(prev => prev.filter(x => x.key !== p.key))} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <Button type="dashed" onClick={() => setPriceItems(prev => [...prev, { key: Date.now(), item_id: '', custom_rate: 0 }])} icon={<PlusOutlined />}>
 {t('add_line')}
 </Button>

 <div style={{ marginTop: 16 }}>
 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button>
 <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
 </Space>
 </div>
 </Form>
 </FormDialog>
 </div>
 );
};

export default PriceLists;
