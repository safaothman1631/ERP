import React, { useEffect, useState } from 'react';
import { Tabs, Button, Tag, Form, Input, Switch, Space, Popconfirm, Select, InputNumber, DatePicker, Empty, Typography } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { useAddGate } from '../components/AddGate/useAddGate';
const { Text } = Typography;

interface Warehouse {
 id: string;
 name: string;
 address: string;
 is_primary: boolean;
 stock_items?: { item_id: string; item_name: string; quantity: number }[];
}

interface StockTransfer {
 id: string;
 transfer_number: string;
 from_warehouse_name: string;
 to_warehouse_name: string;
 date: string;
 status: string;
}

const Warehouses: React.FC = () => {
 const { t } = useTranslation();

 return (
 <Tabs defaultActiveKey="warehouses" items={[
 { key: 'warehouses', label: t('warehouses'), children: <WarehouseList /> },
 { key: 'transfers', label: t('stockTransfer'), children: <StockTransfers /> },
 ]} />
 );
};

const WarehouseList: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Warehouse[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();

 // AddGate: wire Selective Add for warehouses section (R9.1, R9.5)
 const addGate = useAddGate('inventory.warehouses');
 const [saving, setSaving] = useState(false);

 const fetchData = () => {
 setLoading(true);
 api.get('/api/inventory/warehouses')
 .then(r => setData(r.data.items || r.data || []))
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 useEffect(() => { fetchData(); }, []);

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(data.length); }, [data.length, addGate.setRecordCount]);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 setModalOpen(true);
 };

 const openEdit = (record: Warehouse) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 if (editingId) {
 await api.put(`/api/inventory/warehouses/${editingId}`, values);
 } else {
 await api.post('/api/inventory/warehouses', values);
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
 await api.delete(`/api/inventory/warehouses/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const columns = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('address'), dataIndex: 'address', key: 'address' },
 {
 title: t('primary'), dataIndex: 'is_primary', key: 'is_primary',
 render: (v: boolean) => v ? <Tag color="green" style={{ borderRadius: 12 }}>{t('primary')}</Tag> : null,
 },
 {
 title: t('actions'), key: 'actions',
 render: (_: unknown, r: Warehouse) => (
 <Space>
 <Button onClick={() => openEdit(r)}>{t('edit')}</Button>
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 const stockColumns = [
 { title: t('items'), dataIndex: 'item_name', key: 'item_name' },
 { title: t('quantity'), dataIndex: 'quantity', key: 'quantity' },
 ];

 return (
 <div data-addgate-section="inventory.warehouses">
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew} data-add-action="inventory.warehouses">{t('create')}</Button>
 </div>

 <ResponsiveTableAdapter
 dataSource={data}
 columns={columns}
 rowKey="id"
 loading={loading}
 locale={{
 emptyText: (
 <Empty
 image={<InboxOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
 description={
 <Space orientation="vertical">
 <Text strong>{t('no_warehouses_yet')}</Text>
 <Text type="secondary">{t('no_warehouses_hint')}</Text>
 </Space>
 }
 >
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_warehouse')}</Button>
 </Empty>
 ),
 }}
 expandable={{
 expandedRowRender: (record: Warehouse) => (
 <ResponsiveTableAdapter dataSource={record.stock_items || []} columns={stockColumns} rowKey="item_id" pagination={false} />
 ),
 }}
 />

 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('edit') : t('warehouses')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]}>
 <Input placeholder={t('placeholder_name')} />
 </Form.Item>
 <Form.Item label={t('address')} name="address">
 <Input.TextArea rows={2} placeholder={t('placeholder_address')} />
 </Form.Item>
 <Form.Item label={t('primary')} name="is_primary" valuePropName="checked">
 <Switch />
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

const StockTransfers: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<StockTransfer[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [_warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
 const [items, setItems] = useState<{ id: string; name: string }[]>([]);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [transferItems, setTransferItems] = useState<{ key: number; item_id: string; quantity: number }[]>([]);

 const statusColors: Record<string, string> = { draft: 'default', in_transit: 'blue', completed: 'green', cancelled: 'red' };

 const fetchData = () => {
 setLoading(true);
 api.get('/api/inventory/transfers')
 .then(r => setData(r.data.items || []))
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 useEffect(() => { fetchData(); }, []);

 const openNew = async () => {
 const [w, i] = await Promise.all([
 api.get('/api/inventory/warehouses'),
 api.get('/api/items', { params: { page_size: 200 } }),
 ]);
 setWarehouses(w.data.items || w.data);
 setItems(i.data.items || i.data);
 setTransferItems([]);
 form.resetFields();
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 await api.post('/api/inventory/transfers', {
 from_warehouse_id: values.from_warehouse_id,
 to_warehouse_id: values.to_warehouse_id,
 date: (values.date as dayjs.Dayjs).format('YYYY-MM-DD'),
 items: transferItems.map(ti => ({ item_id: ti.item_id, quantity: ti.quantity })),
 });
 message.success(t('success'));
 setModalOpen(false);
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const updateTransferItem = (key: number, field: string, value: unknown) => {
 setTransferItems(prev => prev.map(ti => ti.key === key ? { ...ti, [field]: value } : ti));
 };

 const columns = [
 { title: '#', dataIndex: 'transfer_number', key: 'transfer_number' },
 { title: t('from'), dataIndex: 'from_warehouse_name', key: 'from_warehouse_name' },
 { title: t('to'), dataIndex: 'to_warehouse_name', key: 'to_warehouse_name' },
 { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (s: string) => <Tag color={statusColors[s] || 'default'} style={{ borderRadius: 12 }}>{t(s)}</Tag>,
 },
 ];

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('create')}</Button>
 </div>

 <ResponsiveTableAdapter
 dataSource={data}
 columns={columns}
 rowKey="id"
 loading={loading}
 locale={{
 emptyText: (
 <Empty
 image={<InboxOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
 description={
 <Space orientation="vertical">
 <Text strong>{t('no_transfers_yet')}</Text>
 <Text type="secondary">{t('no_transfers_hint')}</Text>
 </Space>
 }
 >
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_transfer')}</Button>
 </Empty>
 ),
 }}
 />

 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('stockTransfer')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ date: dayjs() }}>
 <Space wrap>
 <Form.Item label={t('from')} name="from_warehouse_id" rules={[{ required: true, message: t('required_field') }]} style={{ width: 220 }}>
 <SelectWithQuickCreate entity="location" placeholder={t('placeholder_select')} allowClear />
 </Form.Item>
 <Form.Item label={t('to')} name="to_warehouse_id" rules={[{ required: true, message: t('required_field') }]} style={{ width: 220 }}>
 <SelectWithQuickCreate entity="location" placeholder={t('placeholder_select')} allowClear />
 </Form.Item>
 <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}>
 <DatePicker placeholder={t('placeholder_date')} />
 </Form.Item>
 </Space>

 <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('items')}</div>
 <table style={{ width: '100%', marginBottom: 8 }}>
 <thead>
 <tr><th>{t('items')}</th><th>{t('quantity')}</th><th></th></tr>
 </thead>
 <tbody>
 {transferItems.map(ti => (
 <tr key={ti.key}>
 <td style={{ padding: 4 }}>
 <Select
 style={{ width: 300 }}
 value={ti.item_id || undefined}
 onChange={v => updateTransferItem(ti.key, 'item_id', v)}
 options={items.map(i => ({ label: i.name, value: i.id }))}
 showSearch
 optionFilterProp="label"
 placeholder={t('placeholder_select')}
 />
 </td>
 <td style={{ padding: 4 }}>
 <InputNumber min={1} value={ti.quantity} onChange={v => updateTransferItem(ti.key, 'quantity', v || 1)} style={{ width: 120 }} />
 </td>
 <td style={{ padding: 4 }}>
 <Button icon={<DeleteOutlined />} danger onClick={() => setTransferItems(prev => prev.filter(x => x.key !== ti.key))} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <Button type="dashed" onClick={() => setTransferItems(prev => [...prev, { key: Date.now(), item_id: '', quantity: 1 }])} icon={<PlusOutlined />}>
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

export default Warehouses;
