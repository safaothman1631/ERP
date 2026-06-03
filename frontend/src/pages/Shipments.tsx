import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, Select, DatePicker, Space, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitSearchInput from '../design-system/KitSearchInput';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function Shipments() {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [form] = Form.useForm();
 const [editId, setEditId] = useState<string | null>(null);
 const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
 const [tab, setTab] = useState<'all' | 'pending' | 'shipped' | 'delivered'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('shipments.hiddenCols') || '[]'); } catch { return []; }
 });
 const [contacts, setContacts] = useState<any[]>([]);
 const [invoices, setInvoices] = useState<any[]>([]);

 const fetchData = async (page = 1) => {
 setLoading(true);
 try {
 const res = await api.get('/api/shipments', { params: { page, page_size: pagination.pageSize } });
 setData(res.data.items || []);
 setPagination(p => ({ ...p, total: res.data.total || 0, current: page }));
 } catch {
 message.error(t('error'));
 }
 setLoading(false);
 };

 const fetchContacts = async () => {
 try {
 const res = await api.get('/api/contacts', { params: { page_size: 500 } });
 setContacts(res.data.items || []);
 } catch { /* noop */ }
 };

 const fetchInvoices = async () => {
 try {
 const res = await api.get('/api/invoices', { params: { page_size: 200 } });
 setInvoices(res.data.items || []);
 } catch { /* noop */ }
 };

 useEffect(() => {
 fetchData();
 fetchContacts();
 fetchInvoices();
 }, []);

 const handleSubmit = async (values: any) => {
 try {
 const payload = {
 ...values,
 ship_date: values.ship_date?.format('YYYY-MM-DD'),
 };
 if (editId) {
 await api.put(`/api/shipments/${editId}`, payload);
 message.success(t('updated'));
 } else {
 await api.post('/api/shipments', payload);
 message.success(t('created'));
 }
 setModalVisible(false);
 form.resetFields();
 setEditId(null);
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('confirmDelete'),
 onOk: async () => {
 try {
 await api.delete(`/api/shipments/${id}`);
 message.success(t('deleted'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleMarkDelivered = async (id: string) => {
 try {
 await api.put(`/api/shipments/${id}`, { status: 'delivered' });
 message.success(t('updated'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (record: any) => {
 setEditId(record.id);
 form.setFieldsValue({
 ...record,
 ship_date: record.ship_date ? dayjs(record.ship_date) : null,
 });
 setModalVisible(true);
 };

 // Kit list tabs — shipment status segments (client-side filter; API has no status param).
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'pending', label: t('pending', 'Pending') },
 { key: 'shipped', label: t('shipped', 'Shipped') },
 { key: 'delivered', label: t('delivered', 'Delivered') },
 ];

 // Client-side filter by current tab + search (does NOT change the server query).
 const filteredData = useMemo(() => {
 const byTab = tab === 'all' ? data : data.filter((d) => d.status === tab);
 if (!search) return byTab;
 const q = search.toLowerCase();
 return byTab.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, tab, search]);

 // Status → kit StatusTag kind mapping (pending → warning; shipped → info; delivered → success).
 const statusKindOf = (status: string): 'pending' | 'sent' | 'success' | 'default' => {
 if (status === 'pending') return 'pending';
 if (status === 'shipped') return 'sent';
 if (status === 'delivered') return 'success';
 return 'default';
 };

 const allColumns = [
 {
 title: t('shipment_number'),
 dataIndex: 'shipment_number',
 key: 'shipment_number',
 render: (v: string) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
 {v || '—'}
 </span>
 ),
 },
 {
 title: t('contact'),
 dataIndex: 'contact_id',
 key: 'contact',
 render: (contactId: string) => {
 const contact = contacts.find(c => c.id === contactId);
 const name = contact?.name || '';
 if (!name) return <span style={{ color: 'var(--ink-400)' }}>—</span>;
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(name)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{name}</span>
 </div>
 );
 },
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => (
 <StatusTag status={statusKindOf(status)} label={t(status)} />
 ),
 },
 {
 title: t('ship_date'),
 dataIndex: 'ship_date',
 key: 'ship_date',
 render: (d: string) => d
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{d.substring(0, 10)}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('carrier'),
 dataIndex: 'carrier',
 key: 'carrier',
 render: (v: string) => v
 ? <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('tracking'),
 dataIndex: 'tracking_number',
 key: 'tracking_number',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: any) => {
 const actions: any[] = [
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => handleEdit(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 ];
 if (record.status !== 'delivered') {
 actions.push({ key: 'mark_delivered', icon: <CheckOutlined />, label: t('mark_delivered'), onClick: () => handleMarkDelivered(record.id) });
 }
 actions.push({ type: 'divider' });
 actions.push({ key: 'delete', icon: <DeleteOutlined />, label: t('delete', 'Delete'), danger: true, onClick: () => handleDelete(record.id) });
 return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
 },
 },
 ];
 const visibleColumns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, allColumns]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'shipment_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('shipments.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('shipments')}
 subtitle={t('shipments_subtitle', 'Shipments')}
 sectionId="inventory.shipments"
 extra={
 <Space>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditId(null);
 form.resetFields();
 setModalVisible(true);
 }}
 >
 {t('add')}
 </Button>
 </Space>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as typeof tab); setPagination(p => ({ ...p, current: 1 })); }}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }}
 placeholder={t('search')}
 />
 {/* Group Filters + Status in a single flex unit so they ALWAYS wrap
 together to the same line — never one stranded on a row by itself. */}
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => { setTab('all'); setPagination(p => ({ ...p, current: 1 })); }}
 >
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as typeof tab); setPagination(p => ({ ...p, current: 1 })); }}
 options={[
 { value: 'pending', label: t('pending', 'Pending') },
 { value: 'shipped', label: t('shipped', 'Shipped') },
 { value: 'delivered', label: t('delivered', 'Delivered') },
 ]}
 />
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as typeof tab); setPagination(p => ({ ...p, current: 1 })); }}
 options={[
 { value: 'pending', label: t('pending', 'Pending') },
 { value: 'shipped', label: t('shipped', 'Shipped') },
 { value: 'delivered', label: t('delivered', 'Delivered') },
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
 downloadCsv('shipments', filteredData, cols);
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
 pagination={{ ...pagination, onChange: fetchData }}
 />
 </KitListCard>
 <FormDialog
 title={editId ? t('edit') : t('add')}
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item label={t('invoice')} name="invoice_id">
 <Select
 showSearch
 placeholder={t('select')}
 optionFilterProp="children"
 options={invoices.map(inv => ({
 label: `${inv.invoice_number} - ${inv.total?.toLocaleString()}`,
 value: inv.id,
 }))}
 />
 </Form.Item>
 <Form.Item label={t('contact')} name="contact_id" rules={[{ required: true }]}>
 <Select
 showSearch
 placeholder={t('select')}
 optionFilterProp="children"
 options={contacts.map(c => ({ label: c.name, value: c.id }))}
 />
 </Form.Item>
 <Form.Item label={t('ship_date')} name="ship_date" rules={[{ required: true }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('carrier')} name="carrier">
 <Input placeholder={t('carrier')} />
 </Form.Item>
 <Form.Item label={t('tracking_number')} name="tracking_number">
 <Input placeholder={t('tracking_number')} />
 </Form.Item>
 <Form.Item label={t('status')} name="status" initialValue="pending">
 <Select>
 <Select.Option value="pending">{t('pending')}</Select.Option>
 <Select.Option value="shipped">{t('shipped')}</Select.Option>
 <Select.Option value="delivered">{t('delivered')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item label={t('notes')} name="notes">
 <Input.TextArea rows={3} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
