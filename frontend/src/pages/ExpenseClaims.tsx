import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, DatePicker, InputNumber, Space, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat, FilterBar } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

export default function ExpenseClaims() {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [reasonModal, setReasonModal] = useState(false);
 const [form] = Form.useForm();
 const [reasonForm] = Form.useForm();
 const [editId, setEditId] = useState<string | null>(null);
 const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
 const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('expenseClaims.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchData = async (page = 1) => {
 setLoading(true);
 try {
 const res = await api.get('/api/expense-claims', { params: { page, page_size: pagination.pageSize } });
 setData(res.data.items || []);
 setPagination(p => ({ ...p, total: res.data.total || 0, current: page }));
 } catch {
 message.error(t('error'));
 }
 setLoading(false);
 };

 useEffect(() => {
 fetchData();
 }, []);

 const handleSubmit = async (values: any) => {
 try {
 const payload = {
 ...values,
 date: values.date?.format('YYYY-MM-DD'),
 };
 if (editId) {
 await api.put(`/api/expense-claims/${editId}`, payload);
 message.success(t('updated'));
 } else {
 await api.post('/api/expense-claims', payload);
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
 await api.delete(`/api/expense-claims/${id}`);
 message.success(t('deleted'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleSubmitClaim = async (id: string) => {
 try {
 await api.put(`/api/expense-claims/${id}`, { status: 'submitted' });
 message.success(t('submitted'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 };

 const handleApproveClaim = async (id: string) => {
 try {
 await api.put(`/api/expense-claims/${id}`, { status: 'approved' });
 message.success(t('approved'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 };

 const handleRejectClaim = async (values: any) => {
 try {
 await api.put(`/api/expense-claims/${selectedClaim}`, {
 status: 'rejected',
 rejection_reason: values.reason,
 });
 message.success(t('rejected'));
 setReasonModal(false);
 reasonForm.resetFields();
 setSelectedClaim(null);
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (record: any) => {
 setEditId(record.id);
 form.setFieldsValue({
 ...record,
 date: record.date ? dayjs(record.date) : null,
 });
 setModalVisible(true);
 };

 const statusKinds: Record<string, 'draft' | 'sent' | 'approved' | 'rejected'> = {
 draft: 'draft',
 submitted: 'sent',
 approved: 'approved',
 rejected: 'rejected',
 };

 const columns = [
 { title: t('claim_number'), dataIndex: 'claim_number', key: 'claim_number' },
 { title: t('employee'), dataIndex: 'employee', key: 'employee' },
 {
 title: t('date'),
 dataIndex: 'date',
 key: 'date',
 render: (d: string) => d?.substring(0, 10) || '-',
 },
 {
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 render: (v: number) => v?.toLocaleString() || '0',
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => (
 <StatusTag status={statusKinds[status] || 'default'} label={t(status)} />
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 {record.status === 'draft' && (
 <>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
 <Button
 type="primary"
 icon={<SendOutlined />}
 onClick={() => handleSubmitClaim(record.id)}
 >
 {t('submit')}
 </Button>
 </>
 )}
 {record.status === 'submitted' && (
 <>
 <Button
 type="primary"
 icon={<CheckOutlined />}
 onClick={() => handleApproveClaim(record.id)}
 >
 {t('approve')}
 </Button>
 <Button
 danger
 icon={<CloseOutlined />}
 onClick={() => {
 setSelectedClaim(record.id);
 setReasonModal(true);
 }}
 >
 {t('reject')}
 </Button>
 </>
 )}
 {record.status === 'draft' && (
 <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
 )}
 </Space>
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'claim_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('expenseClaims.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('expense_claims')}
 subtitle={t('expense_claims_subtitle', 'Expense claims')}
 sectionId="purchases.expense_claims"
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
 <FilterBar
 extra={
 <>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('expense-claims', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </>
 }
 />
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
 <Form.Item label={t('employee')} name="employee" rules={[{ required: true, message: t('required_name') }]}>
 <Input placeholder={t('placeholder_name')} />
 </Form.Item>
 <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}>
 <DatePicker style={{ width: '100%' }} placeholder={t('placeholder_date')} />
 </Form.Item>
 <Form.Item label={t('description')} name="description">
 <Input.TextArea rows={2} placeholder={t('placeholder_description')} />
 </Form.Item>
 <Form.List name="line_items">
 {(fields, { add, remove }) => (
 <>
 {fields.map(({ key, name, ...restField }) => (
 <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
 <Form.Item
 {...restField}
 name={[name, 'description']}
 rules={[{ required: true, message: t('required_description') }]}
 >
 <Input placeholder={t('placeholder_description')} style={{ width: 200 }} />
 </Form.Item>
 <Form.Item
 {...restField}
 name={[name, 'amount']}
 rules={[{ required: true, message: t('required_amount') }]}
 >
 <InputNumber placeholder={t('placeholder_amount')} min={0} />
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

 <FormDialog
 title={t('reject_reason')}
 open={reasonModal}
 onClose={() => {
 setReasonModal(false);
 reasonForm.resetFields();
 setSelectedClaim(null);
 }}
 onOk={() => reasonForm.submit()}
 >
 <Form form={reasonForm} layout="vertical" onFinish={handleRejectClaim}>
 <Form.Item label={t('reason')} name="reason" rules={[{ required: true, message: t('required_field') }]}>
 <Input.TextArea rows={3} placeholder={t('placeholder_description')} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
