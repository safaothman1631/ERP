import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, InputNumber, Popconfirm, Empty, Typography } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
// EP-3 — Class B `location` selector.
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';

const { Text } = Typography;

interface PutawayRule {
 id: string;
 warehouse_id: string;
 warehouse_name?: string;
 item_id?: string;
 item_name?: string;
 category_id?: string;
 category_name?: string;
 target_location_id: string;
 target_location_name?: string;
 priority: number;
 active: boolean;
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

const PutawayRules: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<PutawayRule[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 
 const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
 const [items, setItems] = useState<Item[]>([]);
 const [locations, setLocations] = useState<Location[]>([]);
 const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>();

 useEffect(() => {
 fetchWarehouses();
 fetchItems();
 }, []);

 useEffect(() => {
 if (selectedWarehouse) {
 fetchLocations(selectedWarehouse);
 }
 }, [selectedWarehouse]);

 useEffect(() => {
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
 api.get('/api/locations/putaway-rules')
 .then(r => {
 const rules = r.data.items || r.data || [];
 // Enrich with warehouse/item/location names (simple lookup)
 const enriched = rules.map((rule: PutawayRule) => {
 const wh = warehouses.find(w => w.id === rule.warehouse_id);
 const item = items.find(i => i.id === rule.item_id);
 return {
 ...rule,
 warehouse_name: wh?.name,
 item_name: item?.name,
 };
 });
 setData(enriched);
 })
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ active: true, priority: 10 });
 setModalOpen(true);
 };

 const openEdit = (record: PutawayRule) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setSelectedWarehouse(record.warehouse_id);
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 if (editingId) {
 await api.put(`/api/locations/putaway-rules/${editingId}`, values);
 } else {
 await api.post('/api/locations/putaway-rules', values);
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
 await api.delete(`/api/locations/putaway-rules/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const columns = [
 { title: t('warehouse'), dataIndex: 'warehouse_name', key: 'warehouse_name' },
 { title: t('items'), dataIndex: 'item_name', key: 'item_name', render: (v: string) => v || <Text type="secondary">{t('any')}</Text> },
 { title: t('target_location'), dataIndex: 'target_location_id', key: 'target_location_id' },
 { title: t('priority'), dataIndex: 'priority', key: 'priority' },
 {
 title: t('status'),
 dataIndex: 'active',
 key: 'active',
 render: (v: boolean) => (v ? t('active') : t('inactive')),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: unknown, r: PutawayRule) => (
 <Space>
 <Button onClick={() => openEdit(r)}>{t('edit')}</Button>
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('new_putaway_rule')}
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
 <Text strong>{t('no_putaway_rules')}</Text>
 <Text type="secondary">{t('no_putaway_rules_hint')}</Text>
 </Space>
 }
 >
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('new_putaway_rule')}
 </Button>
 </Empty>
 ),
 }}
 />

 <FormDialog
 open={modalOpen}
 title={editingId ? t('edit_putaway_rule') : t('new_putaway_rule')}
 onClose={() => setModalOpen(false)} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="warehouse_id" label={t('warehouse')} rules={[{ required: true }]}>
 <Select
 onChange={(val: string) => {
 setSelectedWarehouse(val);
 form.setFieldsValue({ target_location_id: undefined });
 }}
 >
 {warehouses.map(w => (
 <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item name="item_id" label={t('items')} extra={t('putaway_rule_item_hint')}>
 <Select allowClear placeholder={t('any')}>
 {items.map(i => (
 <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item name="target_location_id" label={t('target_location')} rules={[{ required: true }]}>
 {/* EP-3 — Class B location quick-create. */}
 <SelectWithQuickCreate
 entity="location"
 placeholder={t('select_location')}
 disabled={!selectedWarehouse}
 options={locations.map((loc) => ({ value: loc.id, label: `${loc.code} - ${loc.name}` }))}
 />
 </Form.Item>

 <Form.Item name="priority" label={t('priority')} rules={[{ required: true }]} extra={t('priority_hint')}>
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>

 <Form.Item name="active" label={t('active')} valuePropName="checked">
 <Select>
 <Select.Option value={true}>{t('active')}</Select.Option>
 <Select.Option value={false}>{t('inactive')}</Select.Option>
 </Select>
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
 </div>
 );
};

export default PutawayRules;
