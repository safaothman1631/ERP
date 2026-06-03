import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, DatePicker, Space, Divider, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
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
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';

const VendorCredits: React.FC = () => {
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
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('vendorCredits.hiddenCols') || '[]'); } catch { return []; }
 });
 const _isDark = useAuthStore((s) => s.theme === 'dark');

 // AddGate: wire Selective Add for vendor credits section (R9.1, R9.5)
 const addGate = useAddGate('purchases.vendor_credits');

 const vendorCreditsQuery = useListQuery<any, { items?: any[]; total?: number }>({
 queryKey: listQueryKeys.vendorCredits({ page, page_size: 20, status }),
 queryFn: () => api.get('/api/vendor-credits', { params: { page, page_size: 20, ...(status ? { status } : {}) } }),
 });
 const data = vendorCreditsQuery.data?.items ?? [];
 const total = vendorCreditsQuery.data?.total ?? 0;
 const loading = vendorCreditsQuery.isLoading || vendorCreditsQuery.isFetching;

 // Client-side search over the loaded page (presentation only — backend list has no search param).
 const visibleData = useMemo(() => {
 const q = search.trim().toLowerCase();
 if (!q) return data;
 return data.filter((r: any) =>
 String(r.vendor_credit_number ?? r.credit_number ?? '').toLowerCase().includes(q) ||
 String(r.reference ?? '').toLowerCase().includes(q) ||
 String(r.notes ?? '').toLowerCase().includes(q)
 );
 }, [data, search]);

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(total); }, [total, addGate.setRecordCount]);

 // Kit list tabs (All / Draft / Open) — wired to the real server `status` filter.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'draft', label: t('draft', 'Draft') },
 { key: 'open', label: t('open', 'Open') },
 ];

 const statusOptions = [
 { value: 'draft', label: t('draft', 'Draft') },
 { value: 'open', label: t('open', 'Open') },
 ];

 const openNew = async () => {
 const [c, i] = await Promise.all([
 api.get('/api/contacts', { params: { page_size: 100, contact_type: 'vendor' } }),
 api.get('/api/items', { params: { page_size: 100 } }),
 ]);
 setContacts(c.data.items); setItems(i.data.items);
 setLines([{ key: 0, item_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
 form.resetFields(); setModalOpen(true);
 };

 const handleAction = async (id: string, action: string) => {
 try { await api.post(`/api/vendor-credits/${id}/${action}`); message.success(t('success')); void vendorCreditsQuery.refetch(); } catch { message.error(t('error')); }
 };

 const updateLine = (key: number, field: string, value: any) => {
 setLines(lines.map(l => {
 if (l.key !== key) return l;
 const u = { ...l, [field]: value };
 if (field === 'item_id') { const it = items.find(i => i.id === value); if (it) { u.description = it.description || it.name; u.unit_price = it.cost_price || 0; } }
 return u;
 }));
 };

 const handleSave = async (values: any) => {
 setSaving(true);
 try {
 await api.post('/api/vendor-credits', {
 contact_id: values.contact_id, date: values.date.format('YYYY-MM-DD'),
 reference: values.reference || '', currency_code: 'IQD', notes: values.notes || '',
 lines: lines.map(l => ({ item_id: l.item_id || null, description: l.description, quantity: l.quantity, unit_price: l.unit_price, discount_percent: l.discount_percent || 0, tax_id: null, account_id: null })),
 });
 message.success(t('success')); setModalOpen(false); void vendorCreditsQuery.refetch();
 } catch { message.error(t('error')); } finally { setSaving(false); }
 };

 // Kit cell renderers — mono number, money + IQD, StatusTag chip (no antd color tags).
 const allColumns = [
 {
 title: '#', dataIndex: 'vendor_credit_number', key: 'vendor_credit_number',
 render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v || '—'}</span>,
 },
 {
 title: t('date'), dataIndex: 'date', key: 'date',
 render: (d: string) => <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{d?.substring(0, 10) || '—'}</span>,
 },
 {
 title: t('total'), dataIndex: 'total', key: 'total',
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
 render: (_: any, r: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 {
 key: 'approve',
 icon: <CheckOutlined />,
 label: t('approve'),
 disabled: r.status !== 'draft',
 onClick: () => handleAction(r.id, 'approve'),
 },
 ]}
 />
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'vendor_credit_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('vendorCredits.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div data-addgate-section="purchases.vendor_credits">
 <PageHeader
 title={t('vendor_credits', 'Vendor Credits')}
 subtitle={t('vendor_credits_subtitle', 'Vendor credit notes')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew} data-add-action="purchases.vendor_credits">{t('new_vendor_credit')}</Button>
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
 value={status}
 onChange={(e) => { setStatus(e.target.value); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 <Radio value="draft">{t('draft', 'Draft')}</Radio>
 <Radio value="open">{t('open', 'Open')}</Radio>
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
 downloadCsv('vendor-credits', visibleData, cols);
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
 <ResponsiveTableAdapter dataSource={visibleData} columns={columns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
 </KitListCard>
 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('new_vendor_credit')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ date: dayjs() }}>
 <Space wrap>
 <Form.Item label={t('vendor')} name="contact_id" rules={[{ required: true, message: t('required_contact') }]} style={{ width: 250 }}>
 <SelectWithQuickCreate entity="vendor" showSearch placeholder={t('placeholder_vendor')} allowClear />
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
 </div>
 );
};

export default VendorCredits;
