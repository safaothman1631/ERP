import React, { useEffect, useMemo, useState } from 'react';
import { Button, Tag, Form, Input, Select, DatePicker, Space } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../api';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface Serial {
 id: string;
 item_id: string;
 serial_number: string;
 status: string;
 batch_number?: string;
 expiry_date?: string;
 purchase_date?: string;
 notes?: string;
}

interface Item {
 id: string;
 name: string;
 sku?: string;
}

const STATUS_COLORS: Record<string, string> = {
 in_stock: 'green',
 sold: 'blue',
 reserved: 'orange',
 damaged: 'red',
 returned: 'purple',
};

const SerialNumbers: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Serial[]>([]);
 const [items, setItems] = useState<Item[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [filterItem, setFilterItem] = useState<string | undefined>();
 const [filterStatus, setFilterStatus] = useState<string | undefined>();
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('serialNumbers.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchItems = () => {
 api.get('/api/items', { params: { page_size: 500 } })
 .then(r => setItems(r.data.items || r.data || []))
 .catch(() => {});
 };

 const fetchData = () => {
 setLoading(true);
 const params: Record<string, unknown> = { page_size: 500 };
 if (filterItem) params.item_id = filterItem;
 if (filterStatus) params.status = filterStatus;
 api.get('/api/inventory/serials', { params })
 .then(r => setData(r.data.items || []))
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 useEffect(() => { fetchItems(); }, []);
 useEffect(() => { fetchData(); }, [filterItem, filterStatus]);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 setModalOpen(true);
 };

 const openEdit = (record: Serial) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 expiry_date: record.expiry_date ? dayjs(record.expiry_date) : undefined,
 purchase_date: record.purchase_date ? dayjs(record.purchase_date) : undefined,
 });
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 expiry_date: values.expiry_date ? (values.expiry_date as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
 purchase_date: values.purchase_date ? (values.purchase_date as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
 };
 if (editingId) {
 await api.put(`/api/inventory/serials/${editingId}`, payload);
 } else {
 await api.post('/api/inventory/serials', payload);
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

 const itemNameById = (id: string) => items.find(i => i.id === id)?.name || id;

 const columns = [
 { title: t('serial_number'), dataIndex: 'serial_number', key: 'serial_number' },
 { title: t('item'), dataIndex: 'item_id', key: 'item_id', render: (v: string) => itemNameById(v) },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'} style={{ borderRadius: 12 }}>{t(v) || v}</Tag>,
 },
 { title: t('batch_number'), dataIndex: 'batch_number', key: 'batch_number' },
 { title: t('expiry_date'), dataIndex: 'expiry_date', key: 'expiry_date', render: (d?: string) => d?.substring(0, 10) },
 {
 title: t('actions'), key: 'actions',
 render: (_: unknown, r: Serial) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openEdit(r)}>{t('edit')}</Button>
 </Space>
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'serial_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('serialNumbers.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('serial_numbers')}
 helpKey="serial_numbers"
 sectionId="inventory.serial_numbers"
 extra={<Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_serial')}</Button>}
 />

 <Space style={{ marginBottom: 16 }} wrap>
 <Select
 allowClear
 showSearch
 optionFilterProp="label"
 placeholder={t('filter_by_item')}
 style={{ width: 240 }}
 value={filterItem}
 onChange={setFilterItem}
 options={items.map(i => ({ label: `${i.sku || ''} ${i.name}`.trim(), value: i.id }))}
 />
 <Select
 allowClear
 placeholder={t('filter_by_status')}
 style={{ width: 180 }}
 value={filterStatus}
 onChange={setFilterStatus}
 options={Object.keys(STATUS_COLORS).map(s => ({ label: t(s) || s, value: s }))}
 />
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('serial-numbers', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </Space>

 <ResponsiveTableAdapter rowKey="id" columns={visibleColumns} dataSource={data} loading={loading} pagination={{ pageSize: 50 }} />

 <FormDialog
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 title={editingId ? t('edit_serial') : t('new_serial')} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item label={t('item')} name="item_id" rules={[{ required: true, message: t('required_field') }]}>
 <Select
 showSearch
 optionFilterProp="label"
 placeholder={t('placeholder_select')}
 options={items.map(i => ({ label: `${i.sku || ''} ${i.name}`.trim(), value: i.id }))}
 disabled={!!editingId}
 />
 </Form.Item>
 <Form.Item label={t('serial_number')} name="serial_number" rules={[{ required: true, message: t('required_field') }]}>
 <Input placeholder="SN-0001" disabled={!!editingId} />
 </Form.Item>
 {editingId && (
 <Form.Item label={t('status')} name="status">
 <Select options={Object.keys(STATUS_COLORS).map(s => ({ label: t(s) || s, value: s }))} />
 </Form.Item>
 )}
 <Form.Item label={t('batch_number')} name="batch_number">
 <Input />
 </Form.Item>
 <Form.Item label={t('purchase_date')} name="purchase_date">
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('expiry_date')} name="expiry_date">
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('notes')} name="notes">
 <Input.TextArea rows={2} />
 </Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button>
 <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
 </Space>
 </Form>
 </FormDialog>
 </div>
 );
};

export default SerialNumbers;
