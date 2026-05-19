import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Select, DatePicker, Tag, InputNumber, Input, Popconfirm, Empty, Typography } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EyeOutlined, DeleteOutlined, InboxOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

const { Text } = Typography;

interface CycleCount {
 id: string;
 warehouse_id: string;
 warehouse_name?: string;
 location_id?: string;
 location_name?: string;
 status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
 scheduled_date: string;
 completed_at?: string;
 lines?: CycleCountLine[];
}

interface CycleCountLine {
 id: string;
 count_id: string;
 item_id: string;
 item_name?: string;
 lot_id?: string;
 expected_qty: number;
 counted_qty?: number;
 variance?: number;
 notes?: string;
}

interface Warehouse {
 id: string;
 name: string;
}

interface Item {
 id: string;
 name: string;
}

interface Location {
 id: string;
 code: string;
 name: string;
}

const CycleCounts: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<CycleCount[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [selectedCount, setSelectedCount] = useState<CycleCount | null>(null);
 const [form] = Form.useForm();
 const [lineForm] = Form.useForm();
 const [saving, setSaving] = useState(false);
 
 const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
 const [items, setItems] = useState<Item[]>([]);
 const [locations, setLocations] = useState<Location[]>([]);
 const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>();

 useEffect(() => {
 fetchWarehouses();
 fetchItems();
 fetchData();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 const fetchWarehouses = () => {
 api.get('/api/inventory/warehouses')
 .then(r => setWarehouses(r.data.items || r.data || []))
 .catch(() => message.error(t('error')));
 };

 const fetchItems = () => {
 api.get('/api/items', { params: { limit: 1000 } })
 .then(r => setItems(r.data.items || r.data || []))
 .catch(() => message.error(t('error')));
 };

 const fetchLocations = (warehouseId: string) => {
 api.get('/api/locations/stock-locations', { params: { warehouse_id: warehouseId } })
 .then(r => setLocations(r.data.items || []))
 .catch(() => message.error(t('error')));
 };

 const fetchData = () => {
 setLoading(true);
 api.get('/api/locations/cycle-counts')
 .then(r => {
 const counts = r.data.items || r.data || [];
 // Enrich with warehouse names
 const enriched = counts.map((cc: CycleCount) => {
 const wh = warehouses.find(w => w.id === cc.warehouse_id);
 return { ...cc, warehouse_name: wh?.name };
 });
 setData(enriched);
 })
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 const openNew = () => {
 form.resetFields();
 form.setFieldsValue({
 status: 'draft',
 scheduled_date: dayjs(),
 });
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 scheduled_date: values.scheduled_date ? dayjs(values.scheduled_date as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
 };
 await api.post('/api/locations/cycle-counts', payload);
 message.success(t('success'));
 setModalOpen(false);
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const openDetail = async (record: CycleCount) => {
 try {
 const res = await api.get(`/api/locations/cycle-counts/${record.id}`);
 const cc = res.data;
 // Enrich lines with item names
 cc.lines = (cc.lines || []).map((line: CycleCountLine) => {
 const item = items.find(i => i.id === line.item_id);
 return { ...line, item_name: item?.name };
 });
 setSelectedCount(cc);
 setDrawerOpen(true);
 } catch {
 message.error(t('error'));
 }
 };

 const handleStart = async (id: string) => {
 try {
 await api.post(`/api/locations/cycle-counts/${id}/start`);
 message.success(t('cycle_count_started'));
 fetchData();
 if (selectedCount?.id === id) {
 openDetail({ ...selectedCount, status: 'in_progress' } as CycleCount);
 }
 } catch {
 message.error(t('error'));
 }
 };

 const handleComplete = async (id: string) => {
 try {
 await api.post(`/api/locations/cycle-counts/${id}/complete`);
 message.success(t('cycle_count_completed'));
 fetchData();
 setDrawerOpen(false);
 } catch {
 message.error(t('error'));
 }
 };

 const handleAddLine = async (values: Record<string, unknown>) => {
 if (!selectedCount) return;
 try {
 await api.post(`/api/locations/cycle-counts/${selectedCount.id}/lines`, [values]);
 message.success(t('line_added'));
 lineForm.resetFields();
 openDetail(selectedCount); // Refresh
 } catch {
 message.error(t('error'));
 }
 };

 const statusColors: Record<string, string> = {
 draft: 'default',
 in_progress: 'processing',
 completed: 'success',
 cancelled: 'error',
 };

 const columns = [
 { title: t('warehouse'), dataIndex: 'warehouse_name', key: 'warehouse_name' },
 { title: t('scheduled_date'), dataIndex: 'scheduled_date', key: 'scheduled_date' },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (v: string) => <Tag color={statusColors[v]}>{t(v)}</Tag>,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: unknown, r: CycleCount) => (
 <Space>
 <Button icon={<EyeOutlined />} onClick={() => openDetail(r)}>
 {t('view')}
 </Button>
 {r.status === 'draft' && (
 <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStart(r.id)}>
 {t('start')}
 </Button>
 )}
 </Space>
 ),
 },
 ];

 const lineColumns = [
 { title: t('items'), dataIndex: 'item_name', key: 'item_name' },
 { title: t('expected_qty'), dataIndex: 'expected_qty', key: 'expected_qty' },
 {
 title: t('counted_qty'),
 dataIndex: 'counted_qty',
 key: 'counted_qty',
 render: (v: number | null) => (v !== null && v !== undefined ? v : <Text type="secondary">—</Text>),
 },
 {
 title: t('variance'),
 dataIndex: 'variance',
 key: 'variance',
 render: (v: number | null) => {
 if (v === null || v === undefined) return <Text type="secondary">—</Text>;
 const color = v === 0 ? 'default' : v > 0 ? 'success' : 'error';
 return <Tag color={color}>{v > 0 ? `+${v}` : v}</Tag>;
 },
 },
 { title: t('notes'), dataIndex: 'notes', key: 'notes' },
 ];

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('new_cycle_count')}
 </Button>
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
 <Space direction="vertical">
 <Text strong>{t('no_cycle_counts')}</Text>
 <Text type="secondary">{t('no_cycle_counts_hint')}</Text>
 </Space>
 }
 >
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('new_cycle_count')}
 </Button>
 </Empty>
 ),
 }}
 />

 <FormDialog
 open={modalOpen}
 title={t('new_cycle_count')}
 onClose={() => setModalOpen(false)} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="warehouse_id" label={t('warehouse')} rules={[{ required: true }]}>
 <Select onChange={(val: string) => {
 setSelectedWarehouse(val);
 fetchLocations(val);
 }}>
 {warehouses.map(w => (
 <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item name="location_id" label={t('location')} extra={t('cycle_count_location_hint')}>
 <Select allowClear placeholder={t('all_locations')} disabled={!selectedWarehouse}>
 {locations.map(loc => (
 <Select.Option key={loc.id} value={loc.id}>
 {loc.code} - {loc.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item name="scheduled_date" label={t('scheduled_date')} rules={[{ required: true }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>

 <Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>
 {t('save')}
 </Button>
 <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 open={drawerOpen}
 title={t('cycle_count_detail')}
 onClose={() => setDrawerOpen(false)}
 extra={
 selectedCount?.status === 'in_progress' && (
 <Button
 type="primary"
 icon={<CheckCircleOutlined />}
 onClick={() => selectedCount && handleComplete(selectedCount.id)}
 >
 {t('complete_count')}
 </Button>
 )
 }
 >
 {selectedCount && (
 <div>
 <Space direction="vertical" style={{ width: '100%' }}>
 <div>
 <Text strong>{t('status')}: </Text>
 <Tag color={statusColors[selectedCount.status]}>{t(selectedCount.status)}</Tag>
 </div>
 <div>
 <Text strong>{t('scheduled_date')}: </Text>
 <Text>{selectedCount.scheduled_date}</Text>
 </div>
 {selectedCount.completed_at && (
 <div>
 <Text strong>{t('completed_at')}: </Text>
 <Text>{selectedCount.completed_at}</Text>
 </div>
 )}

 <div>
 <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
 {t('lines')}
 </Text>
 <ResponsiveTableAdapter
 dataSource={selectedCount.lines || []}
 columns={lineColumns}
 rowKey="id"
 pagination={false}
 />
 </div>

 {selectedCount.status !== 'completed' && selectedCount.status !== 'cancelled' && (
 <div>
 <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
 {t('add_line')}
 </Text>
 <Form form={lineForm} layout="inline" onFinish={handleAddLine}>
 <Form.Item name="item_id" rules={[{ required: true }]}>
 <Select placeholder={t('select_item')} style={{ width: 200 }}>
 {items.map(i => (
 <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="expected_qty" rules={[{ required: true }]}>
 <InputNumber placeholder={t('expected_qty')} min={0} style={{ width: 120 }} />
 </Form.Item>
 <Form.Item name="counted_qty">
 <InputNumber placeholder={t('counted_qty')} min={0} style={{ width: 120 }} />
 </Form.Item>
 <Form.Item name="notes">
 <Input placeholder={t('notes')} style={{ width: 150 }} />
 </Form.Item>
 <Form.Item>
 <Button type="primary" htmlType="submit">
 {t('add')}
 </Button>
 </Form.Item>
 </Form>
 </div>
 )}
 </Space>
 </div>
 )}
 </FormDialog>
 </div>
 );
};

export default CycleCounts;
