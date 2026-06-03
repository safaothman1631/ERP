import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, Select, DatePicker, InputNumber, Space, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, type ColumnVisibilityItem } from '../design-system';
import KitListCard from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitSearchInput from '../design-system/KitSearchInput';
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

export default function DeliveryChallans() {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [search, setSearch] = useState('');
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [form] = Form.useForm();
 const [editId, setEditId] = useState<string | null>(null);
 const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
 const [contacts, setContacts] = useState<any[]>([]);
 const [items, setItems] = useState<any[]>([]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('challans.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async (page = 1) => {
 setLoading(true);
 try {
 const res = await api.get('/api/challans', { params: { page, page_size: pagination.pageSize } });
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

 const fetchItems = async () => {
 try {
 const res = await api.get('/api/items', { params: { page_size: 500 } });
 setItems(res.data.items || []);
 } catch { /* noop */ }
 };

 useEffect(() => {
 fetchData();
 fetchContacts();
 fetchItems();
 }, []);

 const handleSubmit = async (values: any) => {
 try {
 const payload = {
 ...values,
 date: values.date?.format('YYYY-MM-DD'),
 };
 if (editId) {
 await api.put(`/api/challans/${editId}`, payload);
 message.success(t('updated'));
 } else {
 await api.post('/api/challans', payload);
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
 await api.delete(`/api/challans/${id}`);
 message.success(t('deleted'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleEdit = (record: any) => {
 setEditId(record.id);
 form.setFieldsValue({
 ...record,
 date: record.date ? dayjs(record.date) : null,
 });
 setModalVisible(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const openDuplicate = (record: any) => {
 setEditId(null);
 const { id: _id, challan_number: _cn, ...rest } = record;
 form.setFieldsValue({
 ...rest,
 date: rest.date ? dayjs(rest.date) : null,
 });
 setModalVisible(true);
 };

 const columns = [
 {
 title: t('challan_number'), dataIndex: 'challan_number', key: 'challan_number',
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
 title: t('date'),
 dataIndex: 'date',
 key: 'date',
 render: (d: string) => d
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{d.substring(0, 10)}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (s: string) => s
 ? (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(s)}</span>
 )
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => handleEdit(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => openDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'challan_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('challans.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('delivery_challans')}
 subtitle={t('delivery_challans_subtitle', 'Delivery documents')}
 sectionId="sales.delivery_challans"
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
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPagination((p) => ({ ...p, current: 1 })); }} placeholder={t('search')} />
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('delivery-challans', data, cols);
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
 <Form.Item label={t('contact')} name="contact_id" rules={[{ required: true }]}>
 <Select
 showSearch
 placeholder={t('select')}
 optionFilterProp="children"
 options={contacts.map(c => ({ label: c.name, value: c.id }))}
 />
 </Form.Item>
 <Form.Item label={t('date')} name="date" rules={[{ required: true }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('reference')} name="reference">
 <Input placeholder={t('reference')} />
 </Form.Item>
 <Form.Item label={t('notes')} name="notes">
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.List name="line_items">
 {(fields, { add, remove }) => (
 <>
 {fields.map(({ key, name, ...restField }) => (
 <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
 <Form.Item
 {...restField}
 name={[name, 'item_id']}
 rules={[{ required: true, message: t('required') }]}
 >
 <Select
 placeholder={t('item')}
 style={{ width: 200 }}
 showSearch
 optionFilterProp="children"
 options={items.map(i => ({ label: i.name, value: i.id }))}
 />
 </Form.Item>
 <Form.Item
 {...restField}
 name={[name, 'quantity']}
 rules={[{ required: true, message: t('required') }]}
 >
 <InputNumber placeholder={t('quantity')} min={0} />
 </Form.Item>
 <Button onClick={() => remove(name)} danger>
 {t('remove')}
 </Button>
 </Space>
 ))}
 <Form.Item>
 <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
 {t('add_item')}
 </Button>
 </Form.Item>
 </>
 )}
 </Form.List>
 </Form>
 </FormDialog>
 </div>
 );
}
