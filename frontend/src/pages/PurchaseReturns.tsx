import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, Select, DatePicker, Space, Radio, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import StatusTag from '../design-system/StatusTag';
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
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('purchaseReturns.hiddenCols') || '[]'); } catch { return []; }
 });

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

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: any) => {
 setEditId(null);
 const { id: _id, return_number: _rn, ...rest } = record;
 form.setFieldsValue({
 ...rest,
 date: record.date ? dayjs(record.date) : null,
 });
 setModalVisible(true);
 };

 // Kit list tabs (All / Draft / Open / Closed) — wired to the server `status` param.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'draft', label: t('draft') },
 { key: 'open', label: t('open') },
 { key: 'closed', label: t('closed') },
 ];
 const activeTab = filterStatus ?? 'all';

 const statusOptions = [
 { value: 'draft', label: t('draft') },
 { value: 'open', label: t('open') },
 { value: 'closed', label: t('closed') },
 ];

 const columns = [
 {
 title: t('return_number'), dataIndex: 'return_number', key: 'return_number',
 render: (v: string) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v || '—'}</span>
 ),
 },
 {
 title: t('vendor'),
 dataIndex: 'contact_id',
 key: 'contact',
 render: (contactId: string) => {
 const contact = contacts.find(c => c.id === contactId);
 const name = contact?.name;
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
 title: t('bill'),
 dataIndex: 'bill_id',
 key: 'bill',
 render: (billId: string) => {
 const bill = bills.find(b => b.id === billId);
 return bill?.bill_number
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{bill.bill_number}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>;
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
 render: (status: string) => <StatusTag status={status} label={t(status)} />,
 },
 {
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {v?.toLocaleString() || '0'}
 </span>
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => handleEdit(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);
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
 activeTab={activeTab}
 onTabChange={(k) => { setFilterStatus(k === 'all' ? undefined : k); setPagination(p => ({ ...p, current: 1 })); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={filterStatus ? 1 : 0}
 onClear={() => { setFilterStatus(undefined); setPagination(p => ({ ...p, current: 1 })); }}
 >
 <Radio.Group
 value={activeTab}
 onChange={(e) => { setFilterStatus(e.target.value === 'all' ? undefined : e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="draft">{t('draft')}</Radio>
 <Radio value="open">{t('open')}</Radio>
 <Radio value="closed">{t('closed')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={filterStatus ?? ''}
 onChange={(v) => { setFilterStatus(v || undefined); setPagination(p => ({ ...p, current: 1 })); }}
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
 downloadCsv('purchase-returns', data, cols);
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
