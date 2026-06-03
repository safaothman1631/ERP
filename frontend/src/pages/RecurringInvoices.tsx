import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, DatePicker, Space, Select, Divider, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, type StatusKind, type ColumnVisibilityItem } from '../design-system';
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

const statusKinds: Record<string, StatusKind> = { active: 'active', paused: 'warning', expired: 'default' };
const freqOptions = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const RecurringInvoices: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [status, setStatus] = useState('');
 const [search, setSearch] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [_contacts, setContacts] = useState<any[]>([]);
 const [contactMap, setContactMap] = useState<Record<string, string>>({});
 const [items, setItems] = useState<any[]>([]);
 const [form] = Form.useForm();
 const [lines, setLines] = useState<any[]>([{ key: 0, item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
 const [saving, setSaving] = useState(false);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('recurringInvoices.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try { const r = await api.get('/api/recurring-invoices', { params: { page, page_size: 20, ...(status ? { status } : {}) } }); setData(r.data.items); setTotal(r.data.total); }
 catch { message.error(t('error')); } finally { setLoading(false); }
 };

 useEffect(() => { fetchData(); }, [page, status]);

 useEffect(() => {
 api.get('/api/contacts', { params: { page_size: 200 } }).then(r => {
 const map: Record<string, string> = {};
 (r.data.items || []).forEach((c: any) => { map[c.id] = c.display_name || c.company_name || c.first_name || c.id.substring(0, 8); });
 setContactMap(map);
 }).catch((e) => console.error(e));
 }, []);

 const openNew = async () => {
 const [c, i] = await Promise.all([
 api.get('/api/contacts', { params: { page_size: 100, contact_type: 'customer' } }),
 api.get('/api/items', { params: { page_size: 100 } }),
 ]);
 setContacts(c.data.items || []); setItems(i.data.items || []);
 setLines([{ key: 0, item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
 form.resetFields(); setModalOpen(true);
 };

 const handleAction = async (id: string, action: string) => {
 try { await api.post(`/api/recurring-invoices/${id}/${action}`); message.success(t('success')); fetchData(); } catch { message.error(t('error')); }
 };

 const handleDelete = async (id: string) => {
 try { await api.delete(`/api/recurring-invoices/${id}`); message.success(t('success')); fetchData(); } catch { message.error(t('error')); }
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
 await api.post('/api/recurring-invoices', {
 contact_id: values.contact_id, frequency: values.frequency,
 start_date: values.start_date.format('YYYY-MM-DD'),
 end_date: values.end_date?.format('YYYY-MM-DD') || null,
 payment_terms_days: values.payment_terms_days || 30,
 currency_code: 'IQD', notes: values.notes || '',
 lines: lines.map(l => ({ item_id: l.item_id || null, description: l.description, quantity: l.quantity, unit_price: l.unit_price, discount_percent: l.discount_percent || 0, tax_id: null, account_id: null })),
 });
 message.success(t('success')); setModalOpen(false); fetchData();
 } catch { message.error(t('error')); } finally { setSaving(false); }
 };

 // Kit list tabs (All / Active / Paused / Expired) — server-side filtered via `status`.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'active', label: t('active', 'Active') },
 { key: 'paused', label: t('paused', 'Paused') },
 { key: 'expired', label: t('expired', 'Expired') },
 ];
 const statusOptions = [
 { value: 'active', label: t('active', 'Active') },
 { value: 'paused', label: t('paused', 'Paused') },
 { value: 'expired', label: t('expired', 'Expired') },
 ];

 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);

 const allColumns = [
 {
 title: t('customer'), dataIndex: 'contact_id', key: 'contact_id',
 render: (v: string) => {
 const name = contactMap[v] || (v?.substring(0, 8) + '...');
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
 title: t('frequency'), dataIndex: 'frequency', key: 'frequency',
 render: (f: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(f)}</span>
 ),
 },
 {
 title: t('next_date'), dataIndex: 'next_invoice_date', key: 'next_invoice_date',
 render: (d: string) => d
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{d.substring(0, 10)}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('total'), dataIndex: 'total', key: 'total',
 render: (v: number) => <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v?.toLocaleString()}</span>,
 },
 { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={statusKinds[s] || 'default'} label={t(s)} /> },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, r: any) => {
 const actions: any[] = [];
 if (r.status === 'active') {
 actions.push({ key: 'pause', icon: <PauseCircleOutlined />, label: t('pause'), onClick: () => handleAction(r.id, 'pause') });
 actions.push({ key: 'gen', icon: <ThunderboltOutlined />, label: t('generate_invoice'), onClick: () => handleAction(r.id, 'generate-invoice') });
 }
 if (r.status === 'paused') actions.push({ key: 'resume', icon: <PlayCircleOutlined />, label: t('resume'), onClick: () => handleAction(r.id, 'resume') });
 actions.push({ type: 'divider' });
 actions.push({ key: 'del', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(r.id) });
 return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
 },
 },
 ];
 const visibleColumns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, contactMap, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' && c.title ? c.title : (c.key as string),
 pinned: c.key === 'contact_id' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('recurringInvoices.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('recurring_invoices', 'Recurring Invoices')}
 subtitle={t('recurring_invoices_subtitle', 'Automatically generated invoices')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_recurring_invoice')}</Button>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={status || 'all'}
 onTabChange={(k) => { setStatus(k === 'all' ? '' : k); setPage(1); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('search')} />
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
 <Radio value="active">{t('active', 'Active')}</Radio>
 <Radio value="paused">{t('paused', 'Paused')}</Radio>
 <Radio value="expired">{t('expired', 'Expired')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
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
 downloadCsv('recurring-invoices', filteredData, cols);
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
 <ResponsiveTableAdapter dataSource={filteredData} columns={visibleColumns} rowKey="id" loading={loading} pagination={{ current: page, total: search ? filteredData.length : total, pageSize: 20, onChange: setPage }} />
 </KitListCard>
 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('new_recurring_invoice')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ start_date: dayjs(), frequency: 'monthly', payment_terms_days: 30 }}>
 <Space wrap>
 <Form.Item label={t('customer')} name="contact_id" rules={[{ required: true, message: t('required_contact') }]} style={{ width: 250 }}>
 <SelectWithQuickCreate entity="customer" showSearch placeholder={t('placeholder_customer')} allowClear />
 </Form.Item>
 <Form.Item label={t('frequency')} name="frequency" rules={[{ required: true, message: t('required_field') }]}>
 <Select placeholder={t('placeholder_select')} options={freqOptions.map(f => ({ label: t(f), value: f }))} style={{ width: 150 }} />
 </Form.Item>
 <Form.Item label={t('start_date')} name="start_date" rules={[{ required: true, message: t('required_date') }]}><DatePicker placeholder={t('placeholder_start_date')} /></Form.Item>
 <Form.Item label={t('end_date')} name="end_date"><DatePicker placeholder={t('placeholder_end_date')} /></Form.Item>
 <Form.Item label={t('payment_terms_days')} name="payment_terms_days"><InputNumber min={0} placeholder={t('placeholder_amount')} /></Form.Item>
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
 </div>
 );
};

export default RecurringInvoices;
