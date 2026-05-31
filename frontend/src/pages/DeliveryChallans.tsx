import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, Select, DatePicker, InputNumber, Space, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space as spaceTk } from '../theme/tokens';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

export default function DeliveryChallans() {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
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
 const isDark = useAuthStore((s) => s.theme === 'dark');

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

 const columns = [
 { title: t('challan_number'), dataIndex: 'challan_number', key: 'challan_number' },
 {
 title: t('contact'),
 dataIndex: 'contact_id',
 key: 'contact',
 render: (contactId: string) => {
 const contact = contacts.find(c => c.id === contactId);
 return contact?.name || '-';
 },
 },
 {
 title: t('date'),
 dataIndex: 'date',
 key: 'date',
 render: (d: string) => d?.substring(0, 10) || '-',
 },
 { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => t(s) },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
 <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
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
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spaceTk.md }}>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('delivery-challans', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </div>
 <ResponsiveTableAdapter
 dataSource={data}
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 pagination={{ ...pagination, onChange: fetchData }}
 />
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
