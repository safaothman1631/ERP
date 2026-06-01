import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, InputNumber, DatePicker, Table } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import ExportButton from '../components/ExportButton';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat, FilterBar } from '../design-system';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTable, type ResponsiveColumn, type RowAction } from '../components/responsive/ResponsiveTable';
import { asTranslationKey } from '../i18n/types';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';
const Bills: React.FC = () => {
 const { t } = useTranslation();
 const [page, setPage] = useState(1);
 const [statusFilter, setStatusFilter] = useState('');
 const [modal, setModal] = useState(false);
 const [form] = Form.useForm();
 const [_vendors, setVendors] = useState<any[]>([]);
 const [_accounts, setAccounts] = useState<any[]>([]);
 const [lines, setLines] = useState([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('bills.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 // AddGate: wire Selective Add for bills section (R9.1, R9.5)
 const addGate = useAddGate('purchases.bills');

 const billsQuery = useListQuery<any, { items?: any[]; total?: number }>({
 queryKey: listQueryKeys.bills({ page, status: statusFilter, page_size: 20 }),
 queryFn: () => api.get('/api/bills', { params: { page, status: statusFilter, page_size: 20 } }),
 });
 const data = billsQuery.data?.items ?? [];
 const total = billsQuery.data?.total ?? 0;
 const loading = billsQuery.isLoading || billsQuery.isFetching;

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(total); }, [total, addGate.setRecordCount]);

 useEffect(() => {
 api.get('/api/contacts', { params: { contact_type: 'vendor', page_size: 200 } }).then(r => setVendors(r.data.items || []));
 api.get('/api/accounts').then(r => setAccounts(r.data || []));
 }, []);

 const updateLine = (idx: number, field: string, value: any) => {
 const newLines = [...lines];
 newLines[idx] = { ...newLines[idx], [field]: value };
 if (field === 'quantity' || field === 'rate') {
 const q = field === 'quantity' ? value : newLines[idx].quantity;
 const r2 = field === 'rate' ? value : newLines[idx].rate;
 newLines[idx].amount = (q || 0) * (r2 || 0);
 }
 setLines(newLines);
 };

 const handleSave = async (values: any) => {
 if (lines.every(l => !l.description && !l.rate)) {
 message.error(t('error')); return;
 }
 const payload = {
 ...values,
 date: values.date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
 due_date: values.due_date?.format('YYYY-MM-DD'),
 lines: lines.filter(l => l.description || l.rate > 0).map(l => ({
 ...l,
 amount: (l.quantity || 1) * (l.rate || 0),
 })),
 };
 // Convert empty strings to null
 Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
 try {
 await api.post('/api/bills', payload);
 message.success(t('success'));
 setModal(false);
 form.resetFields();
 setLines([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
 void billsQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const handleApprove = async (id: string) => {
 try {
 await api.post(`/api/bills/${id}/approve`);
 message.success(t('success'));
 void billsQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const responsiveColumns: ResponsiveColumn<any>[] = [
 { id: 'bill_number', headerKey: asTranslationKey('bill_number'), priority: 'high', render: (row) => row.bill_number || '-' },
 { id: 'date', headerKey: asTranslationKey('date'), priority: 'medium', render: (row) => row.date?.substring(0, 10) || '-' },
 { id: 'due_date', headerKey: asTranslationKey('due_date'), priority: 'medium', render: (row) => row.due_date?.substring(0, 10) || '-' },
 { id: 'total', headerKey: asTranslationKey('total'), priority: 'high', align: 'end', render: (row) => row.total?.toLocaleString() || '0' },
 { id: 'balance_due', headerKey: asTranslationKey('balance_due'), priority: 'high', align: 'end', render: (row) => row.balance_due?.toLocaleString() || '0' },
 { id: 'status', headerKey: asTranslationKey('status'), priority: 'high', render: (row) => <StatusTag status={row.status} label={t(row.status)} /> },
 ];

 const rowActions = (row: any): RowAction[] => {
 const actions: RowAction[] = [];
 if (row.status === 'draft') {
 actions.push({ id: 'approve', labelKey: asTranslationKey('approve'), onClick: () => handleApprove(row.id) });
 }
 return actions;
 };

 const columns = [
 { title: '#', dataIndex: 'bill_number', key: 'bill_number' },
 { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
 { title: t('due_date'), dataIndex: 'due_date', key: 'due_date', render: (d: string) => d?.substring(0, 10) },
 { title: t('total'), dataIndex: 'total', key: 'total', render: (v: number) => v?.toLocaleString() },
 { title: t('balance_due'), dataIndex: 'balance_due', key: 'balance_due', render: (v: number) => v?.toLocaleString() },
 { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={s} label={t(s)} /> },
 {
 title: t('actions'), key: 'actions',
 render: (_: any, r: any) => (
 <Space>
 {r.status === 'draft' && <Button onClick={() => handleApprove(r.id)}>{t('approve')}</Button>}
 </Space>
 ),
 },
 ];
 const _visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'bill_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('bills.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div data-addgate-section="purchases.bills">
 <PageHeader
 title={t('bills')}
 subtitle={t('bills_subtitle', 'Vendor bills')}
 helpKey="bills"
 sectionId="purchases.bills"
 extra={
 <Space>
 <ExportButton endpoint="/api/export/bills" filename="bills" />
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }} data-add-action="purchases.bills">{t('new_bill')}</Button>
 </Space>
 }
 />
 <FilterBar
 filters={[{
 key: 'status',
 label: t('status'),
 options: [
 { label: t('draft'), value: 'draft' },
 { label: t('open'), value: 'open' },
 { label: t('paid'), value: 'paid' },
 { label: t('overdue'), value: 'overdue' },
 ],
 }]}
 values={{ status: statusFilter || undefined }}
 onChange={(v) => { setStatusFilter((v.status as string) || ''); setPage(1); }}
 extra={
 <>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('bills', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </>
 }
 />

 <ResponsiveTable
 columns={responsiveColumns}
 data={data}
 rowActions={rowActions}
 loading={loading}
 getRowKey={(row) => row.id}
 pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
 />

 <FormDialog title={t('new_bill')} open={modal} onClose={() => setModal(false)} onOk={() => form.submit()}>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ date: dayjs(), currency_code: 'IQD' }}>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
 <Form.Item label={t('vendor')} name="contact_id" rules={[{ required: true, message: t('required_contact') }]}>
 <SelectWithQuickCreate entity="vendor" showSearch placeholder={t('placeholder_vendor')} allowClear />
 </Form.Item>
 <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}>
 <DatePicker style={{ width: '100%' }} placeholder={t('placeholder_date')} />
 </Form.Item>
 <Form.Item label={t('due_date')} name="due_date">
 <DatePicker style={{ width: '100%' }} placeholder={t('placeholder_due_date')} />
 </Form.Item>
 <Form.Item label={t('account')} name="account_id">
 <SelectWithQuickCreate entity="account" showSearch placeholder={t('placeholder_select')} allowClear />
 </Form.Item>
 </div>
 <Form.Item label={t('notes')} name="notes"><Input.TextArea rows={2} placeholder={t('placeholder_notes')} /></Form.Item>

 {/* Line items */}
 <div style={{ marginTop: 8 }}>
 <strong>{t('items')}</strong>
 <Table
 pagination={false}
 dataSource={lines}
 rowKey={(_, i) => String(i)}
 columns={[
 {
 title: t('description'), dataIndex: 'description', key: 'desc',
 render: (_, __, i) => <Input value={lines[i].description} onChange={e => updateLine(i, 'description', e.target.value)} />,
 },
 {
 title: t('quantity'), dataIndex: 'quantity', key: 'qty', width: 100,
 render: (_, __, i) => <InputNumber min={0} value={lines[i].quantity} onChange={v => updateLine(i, 'quantity', v || 0)} style={{ width: '100%' }} />,
 },
 {
 title: t('rate'), dataIndex: 'rate', key: 'rate', width: 120,
 render: (_, __, i) => <InputNumber min={0} value={lines[i].rate} onChange={v => updateLine(i, 'rate', v || 0)} style={{ width: '100%' }} />,
 },
 {
 title: t('amount'), dataIndex: 'amount', key: 'amt', width: 120,
 render: (_, __, i) => <span>{lines[i].amount.toLocaleString()}</span>,
 },
 {
 title: '', key: 'del', width: 40,
 render: (_, __, i) => lines.length > 1 ? <Button danger icon={<DeleteOutlined />} onClick={() => setLines(lines.filter((_, j) => j !== i))} /> : null,
 },
 ]}
 footer={() => (
 <Button onClick={() => setLines([...lines, { description: '', quantity: 1, rate: 0, amount: 0 }])}>{t('add_line')}</Button>
 )}
 />
 </div>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Bills;
