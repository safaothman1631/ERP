import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Button, Form, Input, DatePicker, InputNumber, Space, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../design-system';
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
 const [search, setSearch] = useState('');
 const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('expenseClaims.hiddenCols') || '[]'); } catch { return []; }
 });

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
 {
 title: t('claim_number'),
 dataIndex: 'claim_number',
 key: 'claim_number',
 render: (v: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v || '—'}</span>
 ),
 },
 {
 title: t('employee'),
 dataIndex: 'employee',
 key: 'employee',
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(v)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v || '—'}</span>
 </div>
 ),
 },
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
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {v?.toLocaleString() || '0'}
 </span>
 ),
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
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: any) => {
 const actions: Array<
 | { key: string; label: string; icon: ReactNode; danger?: boolean; onClick: () => void }
 | { type: 'divider' }
 > = [];
 if (record.status === 'draft') {
 actions.push({ key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) });
 actions.push({ key: 'submit', icon: <SendOutlined />, label: t('submit'), onClick: () => handleSubmitClaim(record.id) });
 }
 if (record.status === 'submitted') {
 actions.push({ key: 'approve', icon: <CheckOutlined />, label: t('approve'), onClick: () => handleApproveClaim(record.id) });
 actions.push({ key: 'reject', icon: <CloseOutlined />, label: t('reject'), danger: true, onClick: () => { setSelectedClaim(record.id); setReasonModal(true); } });
 }
 if (record.status === 'draft') {
 if (actions.length > 0) actions.push({ type: 'divider' });
 actions.push({ key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) });
 }
 if (actions.length === 0) return null;
 return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
 },
 },
 ];
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);
 const setPage = (p: number) => setPagination((prev) => ({ ...prev, current: p }));
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
 <KitListCard
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('search')} />
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('expense-claims', data, cols);
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
 pagination={{ ...pagination, total: search ? filteredData.length : pagination.total, onChange: fetchData }}
 />
 </KitListCard>
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
