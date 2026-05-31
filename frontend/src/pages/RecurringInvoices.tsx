import React, { useEffect, useMemo, useState } from 'react';
import { Button, Tag, Dropdown, Form, Input, InputNumber, DatePicker, Space, Select, Divider } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, MoreOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

const statusColors: Record<string, string> = { active: 'green', paused: 'orange', expired: 'grey' };
const freqOptions = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

const RecurringInvoices: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
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
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchData = async () => {
 setLoading(true);
 try { const r = await api.get('/api/recurring-invoices', { params: { page, page_size: 20 } }); setData(r.data.items); setTotal(r.data.total); }
 catch { message.error(t('error')); } finally { setLoading(false); }
 };

 useEffect(() => { fetchData(); }, [page]);

 useEffect(() => {
 api.get('/api/contacts', { params: { page_size: 200 } }).then(r => {
 const map: Record<string, string> = {};
 (r.data.items || []).forEach((c: any) => { map[c.id] = c.display_name || c.company_name || c.first_name || c.id.substring(0, 8); });
 setContactMap(map);
 }).catch(() => {});
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

 const columns = [
 { title: t('customer'), dataIndex: 'contact_id', key: 'contact_id', render: (v: string) => contactMap[v] || v?.substring(0, 8) + '...' },
 { title: t('frequency'), dataIndex: 'frequency', key: 'frequency', render: (f: string) => t(f) },
 { title: t('next_date'), dataIndex: 'next_invoice_date', key: 'next_invoice_date', render: (d: string) => d?.substring(0, 10) },
 { title: t('total'), dataIndex: 'total', key: 'total', render: (v: number) => v?.toLocaleString() },
 { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s]}>{t(s)}</Tag> },
 {
 title: t('actions'), key: 'actions',
 render: (_: any, r: any) => {
 const menuitems = [];
 if (r.status === 'active') {
 menuitems.push({ key: 'pause', label: t('pause'), onClick: () => handleAction(r.id, 'pause') });
 menuitems.push({ key: 'gen', label: t('generate_invoice'), onClick: () => handleAction(r.id, 'generate-invoice') });
 }
 if (r.status === 'paused') menuitems.push({ key: 'resume', label: t('resume'), onClick: () => handleAction(r.id, 'resume') });
 menuitems.push({ key: 'del', label: t('delete'), danger: true, onClick: () => handleDelete(r.id) });
 return <Dropdown menu={{ items: menuitems }} trigger={['click']}><Button icon={<MoreOutlined />} /></Dropdown>;
 },
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'contact_id' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('recurringInvoices.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('recurring-invoices', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_recurring_invoice')}</Button>
 </div>
 <ResponsiveTableAdapter dataSource={data} columns={visibleColumns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
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
