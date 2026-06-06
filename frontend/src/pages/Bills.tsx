import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, InputNumber, DatePicker, Table, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import ExportButton from '../components/ExportButton';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';

type BillTab = 'all' | 'draft' | 'open' | 'paid' | 'overdue';

const Bills: React.FC = () => {
 const { t } = useTranslation();
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [tab, setTab] = useState<BillTab>('all');
 const [modal, setModal] = useState(false);
 const [form] = Form.useForm();
 const [_vendors, setVendors] = useState<any[]>([]);
 const [_accounts, setAccounts] = useState<any[]>([]);
 const [lines, setLines] = useState([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('bills.hiddenCols') || '[]'); } catch { return []; }
 });

 // AddGate: wire Selective Add for bills section (R9.1, R9.5)
 const addGate = useAddGate('purchases.bills');

 const statusFilter = tab === 'all' ? '' : tab;
 const billsQuery = useListQuery<any, { items?: any[]; total?: number }>({
 queryKey: listQueryKeys.bills({ page, status: statusFilter, page_size: 20 }),
 queryFn: () => api.get('/api/bills', { params: { page, status: statusFilter, page_size: 20 } }),
 });
 const data = billsQuery.data?.items ?? [];
 const total = billsQuery.data?.total ?? 0;
 const loading = billsQuery.isLoading || billsQuery.isFetching;

 // Client-side search across all visible string fields (backend has no search param).
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }, [data, search]);

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

 // Kit list tabs (All / Draft / Open / Paid / Overdue) — server-side filtered via status param.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'draft', label: t('draft', 'Draft') },
 { key: 'open', label: t('open', 'Open') },
 { key: 'paid', label: t('paid', 'Paid') },
 { key: 'overdue', label: t('overdue', 'Overdue') },
 ];

 // Kit cell renderers — mono bill #, mono money, StatusTag for status.
 const allColumns = [
 {
 title: '#', dataIndex: 'bill_number', key: 'bill_number',
 render: (v: string) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
 {v || '—'}
 </span>
 ),
 },
 {
 title: t('date'), dataIndex: 'date', key: 'date',
 render: (d: string) => (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
 {d?.substring(0, 10) || '—'}
 </span>
 ),
 },
 {
 title: t('due_date'), dataIndex: 'due_date', key: 'due_date',
 render: (d: string) => d
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{d.substring(0, 10)}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('total'), dataIndex: 'total', key: 'total', align: 'end' as const,
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {v?.toLocaleString() || '0'}
 </span>
 ),
 },
 {
 title: t('balance_due'), dataIndex: 'balance_due', key: 'balance_due', align: 'end' as const,
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {v?.toLocaleString() || '0'}
 </span>
 ),
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (s: string) => <StatusTag status={s} label={t(s)} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => {
 const actions = [];
 if (record.status === 'draft') {
 actions.push({
 key: 'approve',
 icon: <CheckOutlined />,
 label: t('approve', 'Approve'),
 onClick: () => handleApprove(record.id),
 });
 }
 if (actions.length === 0) return null;
 return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
 },
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
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
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as BillTab); setPage(1); }}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPage(1); }}
 placeholder={t('search')}
 />
 {/* Group Filters + Status in a single flex unit so they ALWAYS wrap
 together to the same line — never one stranded on a row by itself. */}
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => { setTab('all'); setPage(1); }}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => { setTab(e.target.value); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="draft">{t('draft', 'Draft')}</Radio>
 <Radio value="open">{t('open', 'Open')}</Radio>
 <Radio value="paid">{t('paid', 'Paid')}</Radio>
 <Radio value="overdue">{t('overdue', 'Overdue')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as BillTab); setPage(1); }}
 options={[
 { value: 'draft', label: t('draft', 'Draft') },
 { value: 'open', label: t('open', 'Open') },
 { value: 'paid', label: t('paid', 'Paid') },
 { value: 'overdue', label: t('overdue', 'Overdue') },
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
 downloadCsv('bills', filteredData, cols);
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
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ current: page, total: search ? filteredData.length : total, pageSize: 20, onChange: setPage }}
 />
 </KitListCard>

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
