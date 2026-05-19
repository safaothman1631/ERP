import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, Select, DatePicker, Tag, Space, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space as spaceTk } from '../theme/tokens';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

export default function Shipments() {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [form] = Form.useForm();
 const [editId, setEditId] = useState<string | null>(null);
 const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('shipments.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');
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
 } catch {}
 };

 const fetchInvoices = async () => {
 try {
 const res = await api.get('/api/invoices', { params: { page_size: 200 } });
 setInvoices(res.data.items || []);
 } catch {}
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

 const statusColors: Record<string, string> = {
 pending: 'blue',
 shipped: 'orange',
 delivered: 'green',
 };

 const columns = [
 { title: t('shipment_number'), dataIndex: 'shipment_number', key: 'shipment_number' },
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
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => (
 <Tag color={statusColors[status] || 'default'}>{t(status)}</Tag>
 ),
 },
 {
 title: t('ship_date'),
 dataIndex: 'ship_date',
 key: 'ship_date',
 render: (d: string) => d?.substring(0, 10) || '-',
 },
 { title: t('carrier'), dataIndex: 'carrier', key: 'carrier' },
 { title: t('tracking'), dataIndex: 'tracking_number', key: 'tracking_number' },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 {record.status !== 'delivered' && (
 <Button
 icon={<CheckOutlined />}
 onClick={() => handleMarkDelivered(record.id)}
 >
 {t('mark_delivered')}
 </Button>
 )}
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
 pinned: c.key === 'shipment_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('shipments.hiddenCols', JSON.stringify(next)); } catch {}
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
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spaceTk.md }}>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('shipments', data, cols);
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
