import React, { useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, DatePicker, Space, Select, Divider, Tabs, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, FilePdfOutlined, CheckOutlined, LinkOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { formatCurrency } from '../utils/formatters';
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

const CreditNotes: React.FC = () => {
 const { t } = useTranslation();
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [status, setStatus] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [_contacts, setContacts] = useState<any[]>([]);
 const [items, setItems] = useState<any[]>([]);
 const [form] = Form.useForm();
 const [lines, setLines] = useState<any[]>([{ key: 0, item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
 const [saving, setSaving] = useState(false);
 // Apply to invoice state
 const [applyModal, setApplyModal] = useState<string | null>(null);
 const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
 const [appliedInvoices, setAppliedInvoices] = useState<any[]>([]);
 const [applyForm] = Form.useForm();
 const [applyingSaving, setApplyingSaving] = useState(false);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('creditNotes.hiddenCols') || '[]'); } catch { return []; }
 });

 const creditNotesQuery = useListQuery<any, { items?: any[]; total?: number }>({
 queryKey: listQueryKeys.creditNotes({ page, page_size: 20, status }),
 queryFn: () => api.get('/api/credit-notes', { params: { page, page_size: 20, ...(status ? { status } : {}) } }),
 });
 const data = creditNotesQuery.data?.items ?? [];
 const total = creditNotesQuery.data?.total ?? 0;
 const loading = creditNotesQuery.isLoading || creditNotesQuery.isFetching;
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);

 // Kit list tabs (All / Draft / Open / Void) — server-side filtered via `status`.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'draft', label: t('draft', 'Draft') },
 { key: 'open', label: t('open', 'Open') },
 { key: 'void', label: t('void', 'Void') },
 ];
 const statusOptions = [
 { value: 'draft', label: t('draft', 'Draft') },
 { value: 'open', label: t('open', 'Open') },
 { value: 'void', label: t('void', 'Void') },
 ];

 const openNew = async () => {
 const [c, i] = await Promise.all([
 api.get('/api/contacts', { params: { page_size: 100, contact_type: 'customer' } }),
 api.get('/api/items', { params: { page_size: 100 } }),
 ]);
 setContacts(c.data.items); setItems(i.data.items);
 setLines([{ key: 0, item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
 form.resetFields(); setModalOpen(true);
 };

 const handleAction = async (id: string, action: string) => {
 try { await api.post(`/api/credit-notes/${id}/${action}`); message.success(t('success')); void creditNotesQuery.refetch(); } catch { message.error(t('error')); }
 };

 const handleDownloadPdf = async (id: string) => {
 try {
 const res = await api.get(`/api/credit-notes/${id}/pdf`, { responseType: 'blob' });
 const url = window.URL.createObjectURL(new Blob([res.data]));
 const link = document.createElement('a');
 link.href = url;
 link.download = `credit-note-${id}.pdf`;
 link.click();
 window.URL.revokeObjectURL(url);
 } catch { message.error(t('error')); }
 };

 const updateLine = (key: number, field: string, value: any) => {
 setLines(lines.map(l => {
 if (l.key !== key) return l;
 const u = { ...l, [field]: value };
 if (field === 'item_id') { const it = items.find(i => i.id === value); if (it) { u.description = it.description || it.name; u.unit_price = it.selling_price || 0; } }
 return u;
 }));
 };

 const handleSave = async (values: any) => {
 setSaving(true);
 try {
 await api.post('/api/credit-notes', {
 contact_id: values.contact_id, date: values.date.format('YYYY-MM-DD'),
 reference: values.reference || '', currency_code: 'IQD', notes: values.notes || '',
 lines: lines.map(l => ({ item_id: l.item_id || null, description: l.description, quantity: l.quantity, unit_price: l.unit_price, discount_percent: l.discount_percent || 0, tax_id: null, account_id: null })),
 });
 message.success(t('success')); setModalOpen(false); void creditNotesQuery.refetch();
 } catch { message.error(t('error')); } finally { setSaving(false); }
 };

 // Apply to Invoice
 const openApply = async (creditNoteId: string) => {
 try {
 const [avail, applied] = await Promise.all([
 api.get(`/api/credit-notes/${creditNoteId}/available-invoices`),
 api.get(`/api/credit-notes/${creditNoteId}/applications`),
 ]);
 setAvailableInvoices(avail.data.items || avail.data);
 setAppliedInvoices(applied.data.items || applied.data);
 applyForm.resetFields();
 setApplyModal(creditNoteId);
 } catch { message.error(t('error')); }
 };

 const handleApply = async (values: any) => {
 if (!applyModal) return;
 setApplyingSaving(true);
 try {
 await api.post(`/api/credit-notes/${applyModal}/apply`, {
 invoice_id: values.invoice_id,
 amount: values.amount,
 });
 message.success(t('success'));
 // Refresh applied list
 const [avail, applied] = await Promise.all([
 api.get(`/api/credit-notes/${applyModal}/available-invoices`),
 api.get(`/api/credit-notes/${applyModal}/applications`),
 ]);
 setAvailableInvoices(avail.data.items || avail.data);
 setAppliedInvoices(applied.data.items || applied.data);
 applyForm.resetFields();
 void creditNotesQuery.refetch();
 } catch { message.error(t('error')); } finally { setApplyingSaving(false); }
 };

 const handleRemoveApplication = async (applicationId: string) => {
 if (!applyModal) return;
 try {
 await api.delete(`/api/credit-notes/${applyModal}/applications/${applicationId}`);
 message.success(t('success'));
 const [avail, applied] = await Promise.all([
 api.get(`/api/credit-notes/${applyModal}/available-invoices`),
 api.get(`/api/credit-notes/${applyModal}/applications`),
 ]);
 setAvailableInvoices(avail.data.items || avail.data);
 setAppliedInvoices(applied.data.items || applied.data);
 void creditNotesQuery.refetch();
 } catch { message.error(t('error')); }
 };

 // Kit cell renderers — mono number, avatar+number primary, money with IQD suffix, StatusTag.
 const allColumns = [
 {
 title: '#', dataIndex: 'credit_note_number', key: 'credit_note_number',
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(v)}</span>
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 </div>
 ),
 },
 {
 title: t('date'), dataIndex: 'date', key: 'date',
 render: (d: string) => d
 ? <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{d.substring(0, 10)}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('total'), dataIndex: 'total', key: 'total',
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {(v || 0).toLocaleString()} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
 </span>
 ),
 },
 {
 title: t('creditBalance'), dataIndex: 'balance', key: 'balance',
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {(v || 0).toLocaleString()} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
 </span>
 ),
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (s: string) => <StatusTag status={s} label={t(s)} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, r: any) => {
 const actions: any[] = [];
 if (r.status === 'draft') actions.push({ key: 'approve', icon: <CheckOutlined />, label: t('approve'), onClick: () => handleAction(r.id, 'approve') });
 if (r.status === 'approved') actions.push({ key: 'apply', icon: <LinkOutlined />, label: t('applyToInvoice'), onClick: () => openApply(r.id) });
 actions.push({ key: 'pdf', icon: <FilePdfOutlined />, label: 'PDF', onClick: () => handleDownloadPdf(r.id) });
 if (r.status !== 'void') {
 actions.push({ type: 'divider' });
 actions.push({ key: 'void', icon: <StopOutlined />, label: t('void'), danger: true, onClick: () => handleAction(r.id, 'void') });
 }
 return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
 },
 },
 ];
 const visibleColumns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' && c.title ? c.title : (c.key as string),
 pinned: c.key === 'credit_note_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('creditNotes.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('credit_notes', 'Credit Notes')}
 subtitle={t('credit_notes_subtitle', 'Customer credit notes')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_credit_note')}</Button>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={status || 'all'}
 onTabChange={(k) => { setStatus(k === 'all' ? '' : k); setPage(1); }}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPage(1); }}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={status ? 1 : 0}
 onClear={() => { setStatus(''); setPage(1); }}
 >
 <Radio.Group
 value={status || 'all'}
 onChange={(e) => { setStatus(e.target.value === 'all' ? '' : e.target.value); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="draft">{t('draft', 'Draft')}</Radio>
 <Radio value="open">{t('open', 'Open')}</Radio>
 <Radio value="void">{t('void', 'Void')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 value={status}
 onChange={(v) => { setStatus(v); setPage(1); }}
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
 downloadCsv('credit-notes', data, cols);
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

 {/* Create Credit Note Modal */}
 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('new_credit_note')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ date: dayjs() }}>
 <Space wrap>
 <Form.Item label={t('customer')} name="contact_id" rules={[{ required: true, message: t('required_contact') }]} style={{ width: 250 }}>
 <SelectWithQuickCreate entity="customer" showSearch placeholder={t('placeholder_customer')} allowClear />
 </Form.Item>
 <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}><DatePicker placeholder={t('placeholder_date')} /></Form.Item>
 <Form.Item label={t('reference')} name="reference"><Input placeholder={t('placeholder_reference')} /></Form.Item>
 </Space>
 <Divider>{t('items')}</Divider>
 <table style={{ width: '100%', marginBottom: 8 }}>
 <thead><tr><th>{t('items')}</th><th>{t('description')}</th><th>{t('quantity')}</th><th>{t('unit_price')}</th><th>{t('discount')}%</th><th>{t('total')}</th><th></th></tr></thead>
 <tbody>{lines.map(l => (
 <tr key={l.key}>
 <td style={{ padding: 4 }}><SelectWithQuickCreate entity="item" style={{ width: 180 }} value={l.item_id || undefined} onChange={(v: any) => updateLine(l.key, 'item_id', v)} allowClear /></td>
 <td style={{ padding: 4 }}><Input value={l.description} onChange={e => updateLine(l.key, 'description', e.target.value)} /></td>
 <td style={{ padding: 4 }}><InputNumber min={1} value={l.quantity} onChange={v => updateLine(l.key, 'quantity', v || 1)} style={{ width: 80 }} /></td>
 <td style={{ padding: 4 }}><InputNumber min={0} value={l.unit_price} onChange={v => updateLine(l.key, 'unit_price', v || 0)} style={{ width: 120 }} /></td>
 <td style={{ padding: 4 }}><InputNumber min={0} max={100} value={l.discount_percent} onChange={v => updateLine(l.key, 'discount_percent', v || 0)} style={{ width: 80 }} /></td>
 <td style={{ padding: 4, textAlign: 'center' }}>{(l.quantity * l.unit_price * (1 - l.discount_percent / 100)).toLocaleString()}</td>
 <td style={{ padding: 4 }}><Button icon={<DeleteOutlined />} danger onClick={() => setLines(lines.filter(x => x.key !== l.key))} /></td>
 </tr>
 ))}</tbody>
 </table>
 <Button type="dashed" onClick={() => setLines([...lines, { key: Date.now(), item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }])} icon={<PlusOutlined />}>{t('add_line')}</Button>
 <div style={{ textAlign: 'start', fontSize: 16, fontWeight: 'bold', margin: '12px 0' }}>{t('total')}: {lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount_percent / 100), 0).toLocaleString()} IQD</div>
 <Form.Item label={t('notes')} name="notes"><Input.TextArea rows={2} placeholder={t('placeholder_notes')} /></Form.Item>
 <Space><Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button><Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button></Space>
 </Form>
 </FormDialog>

 {/* Apply to Invoice Modal */}
 <FormDialog open={!!applyModal} onClose={() => setApplyModal(null)} title={t('applyToInvoice')} hideFooter>
 <Tabs items={[
 {
 key: 'apply',
 label: t('applyToInvoice'),
 children: (
 <Form form={applyForm} layout="vertical" onFinish={handleApply}>
 <Form.Item label={t('invoice')} name="invoice_id" rules={[{ required: true, message: t('required_field') }]}>
 <Select
 showSearch
 optionFilterProp="label"
 placeholder={t('placeholder_select')}
 options={availableInvoices.map((inv: any) => ({
 label: `${inv.invoice_number} — ${t('balance_due')}: ${formatCurrency(inv.balance_due || 0, 'IQD')}`,
 value: inv.id,
 }))}
 />
 </Form.Item>
 <Form.Item label={t('amount')} name="amount" rules={[{ required: true, message: t('required_amount') }]}>
 <InputNumber min={0} style={{ width: '100%' }} placeholder={t('placeholder_amount')} />
 </Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={applyingSaving}>{t('confirm')}</Button>
 <Button onClick={() => setApplyModal(null)}>{t('cancel')}</Button>
 </Space>
 </Form>
 ),
 },
 {
 key: 'applied',
 label: t('applied_invoices'),
 children: (
 <ResponsiveTableAdapter
 dataSource={appliedInvoices}
 columns={[
 { title: '#', dataIndex: 'invoice_number', key: 'invoice_number' },
 { title: t('amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => formatCurrency(v || 0, 'IQD') },
 { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
 {
 title: t('actions'), key: 'actions',
 render: (_: any, r: any) => (
 <Button danger icon={<DeleteOutlined />} onClick={() => handleRemoveApplication(r.id)} />
 ),
 },
 ]}
 rowKey="id"
 pagination={false}
 />
 ),
 },
 ]} />
 </FormDialog>
 </div>
 );
};

export default CreditNotes;
