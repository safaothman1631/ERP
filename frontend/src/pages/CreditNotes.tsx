import React, { useMemo, useState } from 'react';
import { Button, Tag, Dropdown, Form, Input, InputNumber, DatePicker, Space, Select, Divider, Tabs } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, MoreOutlined, DeleteOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import dayjs from 'dayjs';
import { ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

const statusColors: Record<string, string> = { draft: 'default', approved: 'green', void: 'red' };

const CreditNotes: React.FC = () => {
 const { t } = useTranslation();
 const [page, setPage] = useState(1);
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
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const creditNotesQuery = useListQuery<any, { items?: any[]; total?: number }>({
 queryKey: listQueryKeys.creditNotes({ page, page_size: 20 }),
 queryFn: () => api.get('/api/credit-notes', { params: { page, page_size: 20 } }),
 });
 const data = creditNotesQuery.data?.items ?? [];
 const total = creditNotesQuery.data?.total ?? 0;
 const loading = creditNotesQuery.isLoading || creditNotesQuery.isFetching;

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

 const columns = [
 { title: '#', dataIndex: 'credit_note_number', key: 'credit_note_number' },
 { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
 { title: t('total'), dataIndex: 'total', key: 'total', render: (v: number) => v?.toLocaleString() },
 { title: t('creditBalance'), dataIndex: 'balance', key: 'balance', render: (v: number) => (v || 0).toLocaleString() },
 { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s]}>{t(s)}</Tag> },
 {
 title: t('actions'), key: 'actions',
 render: (_: any, r: any) => {
 const menuitems = [];
 if (r.status === 'draft') menuitems.push({ key: 'approve', label: t('approve'), onClick: () => handleAction(r.id, 'approve') });
 if (r.status === 'approved') menuitems.push({ key: 'apply', label: t('applyToInvoice'), onClick: () => openApply(r.id) });
 if (r.status !== 'void') menuitems.push({ key: 'void', label: t('void'), onClick: () => handleAction(r.id, 'void') });
 menuitems.push({ key: 'pdf', icon: <FilePdfOutlined />, label: 'PDF', onClick: () => handleDownloadPdf(r.id) });
 return <Dropdown menu={{ items: menuitems }} trigger={['click']}><Button icon={<MoreOutlined />} /></Dropdown>;
 },
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'credit_note_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('creditNotes.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('credit-notes', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_credit_note')}</Button>
 </div>
 <ResponsiveTableAdapter dataSource={data} columns={visibleColumns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />

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
 label: `${inv.invoice_number} — ${t('balance_due')}: ${(inv.balance_due || 0).toLocaleString()} ?.?`,
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
 { title: t('amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => (v || 0).toLocaleString() + ' ?.?' },
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
