import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, DatePicker, Space, Divider, Descriptions, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import ChatterWidget from '../components/chatter/ChatterWidget';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitSearchInput from '../design-system/KitSearchInput';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions, { type KitRowEntry } from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';

const SalesOrders: React.FC = () => {
 const { t } = useTranslation();
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 // Single source for both the tab strip and the Status filter — wired to the
 // real `status` server param the backend supports ('' = All).
 const [status, setStatus] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [_contacts, setContacts] = useState<any[]>([]);
 const [items, setItems] = useState<any[]>([]);
 const [form] = Form.useForm();
 const [lines, setLines] = useState<any[]>([{ key: 0, item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
 const [saving, setSaving] = useState(false);
 const [viewingOrder, setViewingOrder] = useState<any | null>(null);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('salesOrders.hiddenCols') || '[]'); } catch { return []; }
 });

 // AddGate: wire Selective Add for sales orders section (R9.1, R9.5)
 const addGate = useAddGate('sales.sales_orders');

 const salesOrdersQuery = useListQuery<any, { items?: any[]; total?: number }>({
 queryKey: listQueryKeys.salesOrders({ page, page_size: 20, status }),
 queryFn: () => api.get('/api/sales-orders', { params: { page, page_size: 20, ...(status ? { status } : {}) } }),
 });
 const data = salesOrdersQuery.data?.items ?? [];
 const total = salesOrdersQuery.data?.total ?? 0;
 const loading = salesOrdersQuery.isLoading || salesOrdersQuery.isFetching;

 // Client-side search over the current page (the page already had no search; this
 // is presentation-only and does not change the query/endpoint).
 const visibleData = useMemo(() => {
 const q = search.trim().toLowerCase();
 if (!q) return data;
 return data.filter((r: any) =>
 String(r.order_number ?? '').toLowerCase().includes(q) ||
 String(r.reference ?? '').toLowerCase().includes(q)
 );
 }, [data, search]);

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(total); }, [total, addGate.setRecordCount]);

 // Kit list tabs — wired to the real backend `status` values (state machine:
 // draft → confirmed → fulfilled → invoiced, plus cancelled).
 const tabs: KitListTab[] = [
 { key: '', label: t('all', 'All') },
 { key: 'draft', label: t('draft', 'Draft') },
 { key: 'confirmed', label: t('confirmed', 'Confirmed') },
 { key: 'fulfilled', label: t('fulfilled', 'Fulfilled') },
 { key: 'invoiced', label: t('invoiced', 'Invoiced') },
 { key: 'cancelled', label: t('cancelled', 'Cancelled') },
 ];

 // Status options shared by the Filters popover + the Status dropdown.
 const statusOptions = [
 { value: 'draft', label: t('draft', 'Draft') },
 { value: 'confirmed', label: t('confirmed', 'Confirmed') },
 { value: 'partially_fulfilled', label: t('partially_fulfilled', 'Partially fulfilled') },
 { value: 'fulfilled', label: t('fulfilled', 'Fulfilled') },
 { value: 'invoiced', label: t('invoiced', 'Invoiced') },
 { value: 'cancelled', label: t('cancelled', 'Cancelled') },
 ];

 const openNew = async () => {
 const [c, i] = await Promise.all([
 api.get('/api/contacts', { params: { page_size: 100, contact_type: 'customer' } }),
 api.get('/api/items', { params: { page_size: 100 } }),
 ]);
 setContacts(c.data.items); setItems(i.data.items);
 setLines([{ key: 0, item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
 form.resetFields(); setModalOpen(true);
 };

 const handleAction = async (id: string, action: string) => {
 try { await api.post(`/api/sales-orders/${id}/${action}`); message.success(t('success')); void salesOrdersQuery.refetch(); }
 catch { message.error(t('error')); }
 };

 const updateLine = (key: number, field: string, value: any) => {
 setLines(lines.map(l => {
 if (l.key !== key) return l;
 const u = { ...l, [field]: value };
 if (field === 'item_id') { const it = items.find(i => i.id === value); if (it) { u.description = it.description || it.name; u.unit_price = it.selling_price || 0; } }
 return u;
 }));
 };

 const handleSave = async (values: any) => {
 setSaving(true);
 try {
 await api.post('/api/sales-orders', {
 contact_id: values.contact_id, date: values.date.format('YYYY-MM-DD'), expected_shipment_date: values.expected_shipment_date?.format('YYYY-MM-DD') || null,
 reference: values.reference || '', currency_code: 'IQD', notes: values.notes || '',
 lines: lines.map(l => ({ item_id: l.item_id || null, description: l.description, quantity: l.quantity, unit_price: l.unit_price, discount_percent: l.discount_percent || 0, tax_id: null, account_id: null })),
 });
 message.success(t('success')); setModalOpen(false); void salesOrdersQuery.refetch();
 } catch { message.error(t('error')); } finally { setSaving(false); }
 };

 const allColumns = [
 {
 title: '#', dataIndex: 'order_number', key: 'order_number',
 render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>,
 },
 {
 title: t('date'), dataIndex: 'date', key: 'date',
 render: (d: string) => <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{d?.substring(0, 10) || '—'}</span>,
 },
 {
 title: t('total'), dataIndex: 'total', key: 'total',
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {(v ?? 0).toLocaleString()} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
 </span>
 ),
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (s: string) => <StatusTag status={s} label={t(s)} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, r: any) => {
 const actions: KitRowEntry[] = [
 { key: 'view', icon: <EyeOutlined />, label: t('view'), onClick: () => setViewingOrder(r) },
 ];
 if (r.status === 'draft') actions.push({ key: 'confirm', label: t('confirm'), onClick: () => handleAction(r.id, 'confirm') });
 if (['draft', 'confirmed'].includes(r.status)) actions.push({ key: 'to-inv', label: t('convert_to_invoice'), onClick: () => handleAction(r.id, 'convert-to-invoice') });
 if (r.status !== 'void') {
 actions.push({ type: 'divider' });
 actions.push({ key: 'void', icon: <DeleteOutlined />, label: t('void'), danger: true, onClick: () => handleAction(r.id, 'void') });
 }
 return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
 },
 },
 ];
 const visibleColumns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, allColumns]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'order_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('salesOrders.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div data-addgate-section="sales.sales_orders">
 <PageHeader
 title={t('sales_orders')}
 subtitle={t('sales_orders_subtitle', 'Customer sales orders')}
 sectionId="sales.sales_orders"
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew} data-add-action="sales.sales_orders">{t('new_sales_order')}</Button>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={status}
 onTabChange={(k) => { setStatus(k); setPage(1); }}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPage(1); }}
 placeholder={t('search')}
 />
 {/* Group Filters + Status in a single flex unit so they ALWAYS wrap
 together to the same line — never one stranded on a row by itself. */}
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={status ? 1 : 0}
 onClear={() => { setStatus(''); setPage(1); }}
 >
 <Radio.Group
 value={status}
 onChange={(e) => { setStatus(e.target.value); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 {statusOptions.map((o) => (
 <Radio key={o.value} value={o.value}>{o.label}</Radio>
 ))}
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('any_status', 'Any status')}
 value={status}
 onChange={(v) => { setStatus(v); setPage(1); }}
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
 downloadCsv('sales-orders', data, cols);
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
 <ResponsiveTableAdapter dataSource={visibleData} columns={visibleColumns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
 </KitListCard>
 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('new_sales_order')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ date: dayjs() }}>
 <Space wrap>
 <Form.Item label={t('customer')} name="contact_id" rules={[{ required: true, message: t('required_contact') }]} style={{ width: 250 }}>
 <SelectWithQuickCreate entity="customer" showSearch placeholder={t('placeholder_customer')} allowClear />
 </Form.Item>
 <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}><DatePicker placeholder={t('placeholder_date')} /></Form.Item>
 <Form.Item label={t('expected_shipment')} name="expected_shipment_date"><DatePicker placeholder={t('placeholder_date')} /></Form.Item>
 <Form.Item label={t('reference')} name="reference"><Input placeholder={t('placeholder_reference')} /></Form.Item>
 </Space>
 <Divider>{t('items')}</Divider>
 <table style={{ width: '100%', marginBottom: 8 }}>
 <thead><tr><th>{t('items')}</th><th>{t('description')}</th><th>{t('quantity')}</th><th>{t('unit_price')}</th><th>{t('discount')}%</th><th>{t('total')}</th><th></th></tr></thead>
 <tbody>{lines.map(l => (
 <tr key={l.key}>
 <td style={{ padding: 4 }}><SelectWithQuickCreate entity="item" style={{ width: 180 }} value={l.item_id || undefined} onChange={(v: any) => updateLine(l.key, 'item_id', v)} allowClear /></td>
 <td style={{ padding: 4 }}><Input value={l.description} onChange={e => updateLine(l.key, 'description', e.target.value)} /></td>
 <td style={{ padding: 4 }}><InputNumber min={1} value={l.quantity} onChange={v => updateLine(l.key, 'quantity', v || 1)} style={{ width: 80 }} /></td>
 <td style={{ padding: 4 }}><InputNumber min={0} value={l.unit_price} onChange={v => updateLine(l.key, 'unit_price', v || 0)} style={{ width: 120 }} /></td>
 <td style={{ padding: 4 }}><InputNumber min={0} max={100} value={l.discount_percent} onChange={v => updateLine(l.key, 'discount_percent', v || 0)} style={{ width: 80 }} /></td>
 <td style={{ padding: 4, textAlign: 'center' }}>{(l.quantity * l.unit_price * (1 - l.discount_percent / 100)).toLocaleString()}</td>
 <td style={{ padding: 4 }}><Button icon={<DeleteOutlined />} danger onClick={() => setLines(lines.filter(x => x.key !== l.key))} /></td>
 </tr>
 ))}</tbody>
 </table>
 <Button type="dashed" onClick={() => setLines([...lines, { key: Date.now(), item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }])} icon={<PlusOutlined />}>{t('add_line')}</Button>
 <div style={{ textAlign: 'start', fontSize: 16, fontWeight: 'bold', margin: '12px 0' }}>{t('total')}: {lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount_percent / 100), 0).toLocaleString()} IQD</div>
 <Form.Item label={t('notes')} name="notes"><Input.TextArea rows={2} placeholder={t('placeholder_notes')} /></Form.Item>
 <Space><Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button><Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button></Space>
 </Form>
 </FormDialog>
 <FormDialog
 open={!!viewingOrder}
 onClose={() => setViewingOrder(null)}
 title={viewingOrder?.order_number || t('sales_orders')}
 hideFooter
 >
 {viewingOrder && (
 <Space direction="vertical" style={{ width: '100%' }}>
 <Descriptions column={1} bordered>
 <Descriptions.Item label={t('date')}>{viewingOrder.date?.substring(0, 10) || '-'}</Descriptions.Item>
 <Descriptions.Item label={t('status')}>
 <StatusTag status={viewingOrder.status || 'draft'} label={t(viewingOrder.status || 'draft')} />
 </Descriptions.Item>
 <Descriptions.Item label={t('total')}>{(viewingOrder.total || 0).toLocaleString()}</Descriptions.Item>
 </Descriptions>
 <ChatterWidget entityType="sales_order" entityId={viewingOrder.id} />
 </Space>
 )}
 </FormDialog>
 </div>
 );
};

export default SalesOrders;
