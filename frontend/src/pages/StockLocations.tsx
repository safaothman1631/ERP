import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Tree, Popconfirm, Card, Empty, Typography } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, InboxOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import type { DataNode } from 'antd/es/tree';
import { FormDialog } from '../components/responsive/FormDialog';

const { Text } = Typography;

interface Location {
 id: string;
 warehouse_id: string;
 code: string;
 name: string;
 parent_id?: string;
 location_type: 'zone' | 'aisle' | 'bin' | 'staging';
 barcode?: string;
 active: boolean;
 children?: Location[];
}

interface Warehouse {
 id: string;
 name: string;
}

const StockLocations: React.FC = () => {
 const { t } = useTranslation();
 const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
 const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>();
 const [locations, setLocations] = useState<Location[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 // Fetch warehouses
 api.get('/api/inventory/warehouses')
 .then(r => {
 const wh = r.data.items || r.data || [];
 setWarehouses(wh);
 if (wh.length > 0) setSelectedWarehouse(wh[0].id);
 })
 .catch(() => message.error(t('error')));
 }, [t]);

 useEffect(() => {
 if (selectedWarehouse) fetchLocations();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [selectedWarehouse]);

 const fetchLocations = () => {
 if (!selectedWarehouse) return;
 setLoading(true);
 api.get(`/api/locations/stock-locations/tree/${selectedWarehouse}`)
 .then(r => setLocations(r.data.tree || []))
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ warehouse_id: selectedWarehouse, active: true, location_type: 'bin' });
 setModalOpen(true);
 };

 const openEdit = (record: Location) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 if (editingId) {
 await api.put(`/api/locations/stock-locations/${editingId}`, values);
 } else {
 await api.post('/api/locations/stock-locations', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 fetchLocations();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/locations/stock-locations/${id}`);
 message.success(t('success'));
 fetchLocations();
 } catch {
 message.error(t('error'));
 }
 };

 // Convert locations to tree data for Ant Design Tree
 const buildTreeData = (locs: Location[]): DataNode[] => {
 return locs.map(loc => ({
 key: loc.id,
 title: (
 <Space>
 <Text strong>{loc.code}</Text>
 <Text type="secondary">{loc.name}</Text>
 <Text type="secondary">({t(loc.location_type)})</Text>
 <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(loc)} />
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(loc.id)}>
 <Button type="text" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 children: loc.children ? buildTreeData(loc.children) : undefined,
 }));
 };

 const treeData = buildTreeData(locations);

 // Flatten for parent selector
 const flattenLocations = (locs: Location[]): Location[] => {
 let result: Location[] = [];
 for (const loc of locs) {
 result.push(loc);
 if (loc.children) result = result.concat(flattenLocations(loc.children));
 }
 return result;
 };

 const flatLocations = flattenLocations(locations);

 return (
 <div>
 <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
 <Select
 style={{ width: 300 }}
 value={selectedWarehouse}
 onChange={setSelectedWarehouse}
 placeholder={t('select_warehouse')}
 >
 {warehouses.map(w => (
 <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
 ))}
 </Select>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('new_location')}
 </Button>
 </div>

 <Card loading={loading}>
 {treeData.length === 0 ? (
 <Empty
 image={<InboxOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
 description={
 <Space direction="vertical">
 <Text strong>{t('no_locations')}</Text>
 <Text type="secondary">{t('no_locations_hint')}</Text>
 </Space>
 }
 >
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('new_location')}
 </Button>
 </Empty>
 ) : (
 <Tree
 showLine
 defaultExpandAll
 treeData={treeData}
 />
 )}
 </Card>

 <FormDialog
 open={modalOpen}
 title={editingId ? t('edit_location') : t('new_location')}
 onClose={() => setModalOpen(false)} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="warehouse_id" label={t('warehouse')} rules={[{ required: true }]}>
 <Select disabled={!!editingId}>
 {warehouses.map(w => (
 <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item name="code" label={t('code')} rules={[{ required: true }]}>
 <Input placeholder={t('code')} />
 </Form.Item>

 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input placeholder={t('name')} />
 </Form.Item>

 <Form.Item name="location_type" label={t('location_type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="zone">{t('zone')}</Select.Option>
 <Select.Option value="aisle">{t('aisle')}</Select.Option>
 <Select.Option value="bin">{t('bin')}</Select.Option>
 <Select.Option value="staging">{t('staging')}</Select.Option>
 </Select>
 </Form.Item>

 <Form.Item name="parent_id" label={t('parent_location')}>
 <Select allowClear placeholder={t('none')}>
 {flatLocations
 .filter(loc => loc.id !== editingId)
 .map(loc => (
 <Select.Option key={loc.id} value={loc.id}>
 {loc.code} - {loc.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item name="barcode" label={t('barcode')}>
 <Input placeholder={t('barcode')} />
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

export default StockLocations;
