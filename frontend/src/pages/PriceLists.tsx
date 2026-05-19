import React, { useEffect, useMemo, useState } from 'react';
import { Button, Tag, Form, Input, Select, Space, Popconfirm, InputNumber } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface PriceListItem {
 item_id: string;
 item_name: string;
 custom_rate: number;
}

interface PriceList {
 id: string;
 name: string;
 type: string;
 currency_code: string;
 is_default: boolean;
 items: PriceListItem[];
}

const PriceLists: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<PriceList[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [items, setItems] = useState<{ id: string; name: string; selling_price: number }[]>([]);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [priceItems, setPriceItems] = useState<{ key: number; item_id: string; custom_rate: number }[]>([]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('priceLists.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchData = () => {
 setLoading(true);
 api.get('/api/inventory/price-lists')
 .then(r => setData(r.data.items || []))
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 useEffect(() => { fetchData(); }, []);

 const openNew = async () => {
 const i = await api.get('/api/items', { params: { page_size: 200 } });
 setItems(i.data.items || i.data);
 setEditingId(null);
 setPriceItems([]);
 form.resetFields();
 setModalOpen(true);
 };

 const openEdit = async (record: PriceList) => {
 const i = await api.get('/api/items', { params: { page_size: 200 } });
 setItems(i.data.items || i.data);
 setEditingId(record.id);
 form.setFieldsValue({ name: record.name, type: record.type, currency_code: record.currency_code, is_default: record.is_default });
 setPriceItems((record.items || []).map((pi, idx) => ({ key: idx, item_id: pi.item_id, custom_rate: pi.custom_rate })));
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 items: priceItems.map(p => ({ item_id: p.item_id, custom_rate: p.custom_rate })),
 };
 if (editingId) {
 await api.put(`/api/inventory/price-lists/${editingId}`, payload);
 } else {
 await api.post('/api/inventory/price-lists', payload);
 }
 message.success(t('success'));
 setModalOpen(false);
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/inventory/price-lists/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const updatePriceItem = (key: number, field: string, value: unknown) => {
 setPriceItems(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p));
 };

 const fmtIQD = (v: number) => `${new Intl.NumberFormat('en-US').format(v || 0)} IQD`;

 const columns = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 {
 title: t('type'), dataIndex: 'type', key: 'type',
 render: (v: string) => <Tag color={v === 'markdown' ? 'orange' : 'blue'}>{v}</Tag>,
 },
 { title: t('currency'), dataIndex: 'currency_code', key: 'currency_code' },
 {
 title: t('default'), dataIndex: 'is_default', key: 'is_default',
 render: (v: boolean) => v ? <Tag color="green">{t('default')}</Tag> : null,
 },
 {
 title: t('actions'), key: 'actions',
 render: (_: unknown, r: PriceList) => (
 <Space>
 <Button onClick={() => openEdit(r)}>{t('edit')}</Button>
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('priceLists.hiddenCols', JSON.stringify(next)); } catch {}
 };

 const nestedColumns = [
 { title: t('items'), dataIndex: 'item_name', key: 'item_name' },
 { title: t('custom_rate'), dataIndex: 'custom_rate', key: 'custom_rate', render: (v: number) => fmtIQD(v) },
 ];

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('price-lists', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('create')}</Button>
 </div>

 <ResponsiveTableAdapter
 dataSource={data}
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 expandable={{
 expandedRowRender: (record: PriceList) => (
 <ResponsiveTableAdapter dataSource={record.items || []} columns={nestedColumns} rowKey="item_id" pagination={false} />
 ),
 }}
 />

 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('edit') : t('priceLists')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ currency_code: 'IQD', type: 'fixed' }}>
 <Space wrap>
 <Form.Item label={t('name')} name="name" rules={[{ required: true }]} style={{ width: 220 }}>
 <Input />
 </Form.Item>
 <Form.Item label={t('type')} name="type" rules={[{ required: true }]} style={{ width: 160 }}>
 <Select options={[
 { label: 'Fixed', value: 'fixed' },
 { label: 'Markdown', value: 'markdown' },
 ]} />
 </Form.Item>
 <Form.Item label={t('currency')} name="currency_code" style={{ width: 120 }}>
 <Input />
 </Form.Item>
 </Space>

 <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('items')}</div>
 <table style={{ width: '100%', marginBottom: 8 }}>
 <thead>
 <tr><th>{t('items')}</th><th>{t('custom_rate')}</th><th></th></tr>
 </thead>
 <tbody>
 {priceItems.map(p => (
 <tr key={p.key}>
 <td style={{ padding: 4 }}>
 <Select
 style={{ width: 280 }}
 value={p.item_id || undefined}
 onChange={v => updatePriceItem(p.key, 'item_id', v)}
 options={items.map(i => ({ label: i.name, value: i.id }))}
 showSearch
 optionFilterProp="label"
 />
 </td>
 <td style={{ padding: 4 }}>
 <InputNumber min={0} value={p.custom_rate} onChange={v => updatePriceItem(p.key, 'custom_rate', v || 0)} style={{ width: 160 }} />
 </td>
 <td style={{ padding: 4 }}>
 <Button icon={<DeleteOutlined />} danger onClick={() => setPriceItems(prev => prev.filter(x => x.key !== p.key))} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <Button type="dashed" onClick={() => setPriceItems(prev => [...prev, { key: Date.now(), item_id: '', custom_rate: 0 }])} icon={<PlusOutlined />}>
 {t('add_line')}
 </Button>

 <div style={{ marginTop: 16 }}>
 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button>
 <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
 </Space>
 </div>
 </Form>
 </FormDialog>
 </div>
 );
};

export default PriceLists;
