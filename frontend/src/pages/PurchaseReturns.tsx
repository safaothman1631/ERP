import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, Select, DatePicker, Space, Tag, Modal } from 'antd';
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

export default function PurchaseReturns() {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [form] = Form.useForm();
 const [editId, setEditId] = useState<string | null>(null);
 const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
 const [contacts, setContacts] = useState<any[]>([]);
 const [bills, setBills] = useState<any[]>([]);
 const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('purchaseReturns.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchData = async (page = 1) => {
 setLoading(true);
 try {
 const params: any = { page, page_size: pagination.pageSize };
 if (filterStatus) params.status = filterStatus;
 const res = await api.get('/api/returns/purchases', { params });
 setData(res.data.items || []);
 setPagination(p => ({ ...p, total: res.data.total || 0, current: page }));
 } catch {
 message.error(t('error'));
 }
 setLoading(false);
 };

 const fetchContacts = async () => {
 try {
 const res = await api.get('/api/contacts', { params: { contact_type: 'vendor', page_size: 500 } });
 setContacts(res.data.items || []);
 } catch { /* noop */ }
 };

 const fetchBills = async () => {
 try {
 const res = await api.get('/api/bills', { params: { page_size: 200 } });
 setBills(res.data.items || []);
 } catch { /* noop */ }
 };

 useEffect(() => {
 fetchData();
 fetchContacts();
 fetchBills();
 }, [filterStatus]);

 const handleSubmit = async (values: any) => {
 try {
 const payload = {
 ...values,
 date: values.date?.format('YYYY-MM-DD'),
 };
 if (editId) {
 await api.put(`/api/returns/purchases/${editId}`, payload);
 message.success(t('updated'));
 } else {
 await api.post('/api/returns/purchases', payload);
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
 await api.delete(`/api/returns/purchases/${id}`);
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

 const statusColors: Record<string, string> = {
 draft: 'default',
 open: 'blue',
 closed: 'green',
 };

 const columns = [
 { title: t('return_number'), dataIndex: 'return_number', key: 'return_number' },
 {
 title: t('vendor'),
 dataIndex: 'contact_id',
 key: 'contact',
 render: (contactId: string) => {
 const contact = contacts.find(c => c.id === contactId);
 return contact?.name || '-';
 },
 },
 {
 title: t('bill'),
 dataIndex: 'bill_id',
 key: 'bill',
 render: (billId: string) => {
 const bill = bills.find(b => b.id === billId);
 return bill?.bill_number || '-';
 },
 },
 {
 title: t('date'),
 dataIndex: 'date',
 key: 'date',
 render: (d: string) => d?.substring(0, 10) || '-',
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
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 render: (v: number) => v?.toLocaleString() || '0',
 },
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
 pinned: c.key === 'return_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('purchaseReturns.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('purchase_returns')}
 subtitle={t('purchase_returns_subtitle', 'Purchase returns')}
 sectionId="purchases.returns"
 extra={
 <Space>
 <Select
 placeholder={t('filter_status')}
 allowClear
 style={{ width: 160 }}
 onChange={setFilterStatus}
 options={[
 { label: t('draft'), value: 'draft' },
 { label: t('open'), value: 'open' },
 { label: t('closed'), value: 'closed' },
 ]}
 />
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
 downloadCsv('purchase-returns', data, cols);
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
 <Form.Item label={t('vendor')} name="contact_id" rules={[{ required: true }]}>
 <Select
 showSearch
 placeholder={t('select')}
 optionFilterProp="children"
 options={contacts.map(c => ({ label: c.name, value: c.id }))}
 />
 </Form.Item>
 <Form.Item label={t('bill')} name="bill_id">
 <Select
 showSearch
 placeholder={t('select')}
 optionFilterProp="children"
 options={bills.map(bill => ({
 label: `${bill.bill_number} - ${bill.total?.toLocaleString()}`,
 value: bill.id,
 }))}
 />
 </Form.Item>
 <Form.Item label={t('date')} name="date" rules={[{ required: true }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('reason')} name="reason">
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item label={t('notes')} name="notes">
 <Input.TextArea rows={2} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
