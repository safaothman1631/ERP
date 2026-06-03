import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, DatePicker, Space, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard from '../design-system/KitListCard';
import KitSearchInput from '../design-system/KitSearchInput';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';
const Expenses: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [modal, setModal] = useState(false);
 const [form] = Form.useForm();
 const [_accounts, setAccounts] = useState<any[]>([]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('expenses.hiddenCols') || '[]'); } catch { return []; }
 });

 // AddGate: wire Selective Add for expenses section (R9.1, R9.5)
 const addGate = useAddGate('purchases.expenses');

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/expenses', { params: { page, page_size: 20 } });
 setData(res.data.items); setTotal(res.data.total);
 } catch { message.error(t('error')); } finally { setLoading(false); }
 };

 useEffect(() => { fetchData(); }, [page]);

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(total); }, [total, addGate.setRecordCount]);

 useEffect(() => {
 // Load all accounts - user can pick any expense account (operating_expense, other_expense, etc.)
 api.get('/api/accounts').then(r => {
 const expenseTypes = ['expense', 'operating_expense', 'other_expense', 'cost_of_goods_sold'];
 setAccounts(r.data.filter((a: any) => expenseTypes.includes(a.account_type)));
 }).catch(() => {
 // fallback: load all accounts
 api.get('/api/accounts').then(r => setAccounts(r.data));
 });
 }, []);

 const handleSave = async (values: any) => {
 try {
 await api.post('/api/expenses', {
 ...values,
 date: values.date.format('YYYY-MM-DD'),
 });
 message.success(t('success'));
 setModal(false); form.resetFields(); fetchData();
 } catch { message.error(t('error')); }
 };

 // Duplicate: open the create form pre-filled with this record's values (no id),
 // converting the stored ISO date back into a dayjs value for the DatePicker.
 const openDuplicate = (record: any) => {
 const { id: _id, expense_number: _en, ...rest } = record;
 form.resetFields();
 form.setFieldsValue({
 ...rest,
 date: record.date ? dayjs(record.date) : dayjs(),
 });
 setModal(true);
 };

 // Delete: void the expense via the existing DELETE endpoint, then refresh.
 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 okButtonProps: { danger: true },
 onOk: async () => {
 try {
 await api.delete(`/api/expenses/${id}`);
 message.success(t('success'));
 fetchData();
 } catch { message.error(t('error')); }
 },
 });
 };

 // Kit cell renderers — mono ref/number, muted date, mono amount + IQD unit, StatusTag.
 const columns = [
 {
 title: '#', dataIndex: 'expense_number', key: 'expense_number',
 render: (v: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 ),
 },
 {
 title: t('date'), dataIndex: 'date', key: 'date',
 render: (d: string) => (
 <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{d?.substring(0, 10) || '—'}</span>
 ),
 },
 {
 title: t('description'), dataIndex: 'description', key: 'description',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('amount'), dataIndex: 'amount', key: 'amount',
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {v?.toLocaleString()} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
 </span>
 ),
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (s: string) => <StatusTag status={s} label={t(s)} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
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
 pinned: c.key === 'expense_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('expenses.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div data-addgate-section="purchases.expenses">
 <PageHeader
 title={t('expenses')}
 subtitle={t('expenses_subtitle', 'Record expenses')}
 helpKey="expenses"
 sectionId="purchases.expenses"
 extra={
 <Space>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }} data-add-action="purchases.expenses">{t('new_expense')}</Button>
 </Space>
 }
 />

 <KitListCard
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPage(1); }}
 placeholder={t('search')}
 />
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('expenses', data, cols);
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
 <ResponsiveTableAdapter dataSource={filteredData} columns={visibleColumns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
 </KitListCard>

 <FormDialog title={t('new_expense')} open={modal} onClose={() => setModal(false)} onOk={() => form.submit()}>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ date: dayjs(), currency_code: 'IQD', exchange_rate: 1 }}>
 <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}><DatePicker style={{ width: '100%' }} placeholder={t('placeholder_date')} /></Form.Item>
 <Form.Item label={t('amount')} name="amount" rules={[{ required: true, message: t('required_amount') }]}><InputNumber min={0} style={{ width: '100%' }} placeholder={t('placeholder_amount')} /></Form.Item>
 <Form.Item label={t('account')} name="account_id" rules={[{ required: true, message: t('required_account') }]}>
 <SelectWithQuickCreate entity="account" showSearch placeholder={t('placeholder_select')} allowClear />
 </Form.Item>
 <Form.Item label={t('description')} name="description"><Input.TextArea rows={2} placeholder={t('placeholder_description')} /></Form.Item>
 <Form.Item name="currency_code" hidden><Input /></Form.Item>
 <Form.Item name="exchange_rate" hidden><InputNumber /></Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Expenses;
