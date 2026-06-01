import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, InputNumber, Select, Row, Col, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag } from '../../design-system';
import type { StatusKind } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

// Map POS table states → StatusTag semantic kinds (auto-flip tokens).
const TABLE_STATE_KIND: Record<string, StatusKind> = {
 available: 'active',
 occupied: 'error',
 reserved: 'warning',
 paying: 'info',
};

const POSFloors: React.FC = () => {
 const { t } = useTranslation();
 const [floors, setFloors] = useState<any[]>([]);
 const [configs, setConfigs] = useState<any[]>([]);
 const [selectedConfigId, setSelectedConfigId] = useState<string>('');
 const [loading, setLoading] = useState(false);
 const [floorModalVisible, setFloorModalVisible] = useState(false);
 const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
 const [floorForm] = Form.useForm();
 
 const [editorDrawerVisible, setEditorDrawerVisible] = useState(false);
 const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
 const [tables, setTables] = useState<any[]>([]);
 const [tableModalVisible, setTableModalVisible] = useState(false);
 const [editingTableId, setEditingTableId] = useState<string | null>(null);
 const [tableForm] = Form.useForm();

 const fetchConfigs = async () => {
 try {
 const res = await api.get('/api/pos/configs', { params: { page_size: 100 } });
 setConfigs(res.data.items || []);
 if (res.data.items?.length > 0) {
 setSelectedConfigId(res.data.items[0].id);
 }
 } catch {
 message.error(t('error'));
 }
 };

 const fetchFloors = async () => {
 if (!selectedConfigId) return;
 setLoading(true);
 try {
 const res = await api.get('/api/pos/floors', { params: { config_id: selectedConfigId } });
 setFloors(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchTables = async (floorId: string) => {
 try {
 const res = await api.get(`/api/pos/floors/${floorId}/tables`);
 setTables(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 useEffect(() => {
 fetchConfigs();
 }, []);

 useEffect(() => {
 fetchFloors();
 }, [selectedConfigId]);

 const openFloorModal = (record?: any) => {
 if (record) {
 setEditingFloorId(record.id);
 floorForm.setFieldsValue(record);
 } else {
 setEditingFloorId(null);
 floorForm.resetFields();
 floorForm.setFieldsValue({
 config_id: selectedConfigId,
 sequence: 0,
 is_active: true,
 });
 }
 setFloorModalVisible(true);
 };

 const handleFloorSubmit = async (values: any) => {
 try {
 if (editingFloorId) {
 await api.put(`/api/pos/floors/${editingFloorId}`, values);
 } else {
 await api.post('/api/pos/floors', values);
 }
 message.success(t('success'));
 setFloorModalVisible(false);
 fetchFloors();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDeleteFloor = (id: string) => {
 Modal.confirm({
 title: t('pos.delete_floor_confirm'),
 onOk: async () => {
 try {
 await api.delete(`/api/pos/floors/${id}`);
 message.success(t('success'));
 fetchFloors();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const openFloorEditor = (floorId: string) => {
 setSelectedFloorId(floorId);
 setEditorDrawerVisible(true);
 fetchTables(floorId);
 };

 const openTableModal = (record?: any) => {
 if (record) {
 setEditingTableId(record.id);
 tableForm.setFieldsValue(record);
 } else {
 setEditingTableId(null);
 tableForm.resetFields();
 tableForm.setFieldsValue({
 floor_id: selectedFloorId,
 config_id: selectedConfigId,
 seats: 4,
 shape: 'square',
 width: 100,
 height: 100,
 position_x: 0,
 position_y: 0,
 color: '#7B61FF',
 is_active: true,
 });
 }
 setTableModalVisible(true);
 };

 const handleTableSubmit = async (values: any) => {
 try {
 if (editingTableId) {
 await api.put(`/api/pos/tables/${editingTableId}`, values);
 } else {
 await api.post('/api/pos/tables', values);
 }
 message.success(t('success'));
 setTableModalVisible(false);
 if (selectedFloorId) fetchTables(selectedFloorId);
 } catch {
 message.error(t('error'));
 }
 };

 const handleDeleteTable = (id: string) => {
 Modal.confirm({
 title: t('pos.delete_table_confirm'),
 onOk: async () => {
 try {
 await api.delete(`/api/pos/tables/${id}`);
 message.success(t('success'));
 if (selectedFloorId) fetchTables(selectedFloorId);
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const floorColumns = [
 { title: t('pos.name'), dataIndex: 'name', key: 'name' },
 { title: t('pos.name_ku'), dataIndex: 'name_ku', key: 'name_ku' },
 { title: t('pos.sequence'), dataIndex: 'sequence', key: 'sequence' },
 {
 title: t('pos.status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (val: boolean) => <StatusTag status={val ? 'active' : 'inactive'} label={val ? t('active') : t('inactive')} />,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<SettingOutlined />} onClick={() => openFloorEditor(record.id)}>
 {t('pos.edit_floor_plan')}
 </Button>
 <Button icon={<EditOutlined />} onClick={() => openFloorModal(record)} />
 <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteFloor(record.id)} />
 </Space>
 ),
 },
 ];

 const tableColumns = [
 { title: t('pos.table_name'), dataIndex: 'name', key: 'name' },
 { title: t('pos.seats'), dataIndex: 'seats', key: 'seats' },
 { title: t('pos.shape'), dataIndex: 'shape', key: 'shape' },
 {
 title: t('pos.state'),
 dataIndex: 'state',
 key: 'state',
 render: (val: string) => (
 <StatusTag status={TABLE_STATE_KIND[val] ?? 'default'} label={t(`pos.table_state_${val}`)} />
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openTableModal(record)} />
 <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteTable(record.id)} />
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('pos.floors')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openFloorModal()}>
 {t('pos.new_floor')}
 </Button>
 }
 />
 <div
 style={{
 display: 'flex',
 gap: 'var(--space-sm)',
 flexWrap: 'wrap',
 alignItems: 'center',
 marginBlockEnd: 'var(--space-lg)',
 paddingBlock: 'var(--space-sm)',
 paddingInline: 'var(--space-md)',
 background: 'var(--surface)',
 border: '1px solid var(--border)',
 borderRadius: 'var(--radius-lg)',
 boxShadow: 'var(--shadow-sm)',
 }}
 >
 <Select
 style={{ width: 200 }}
 value={selectedConfigId}
 onChange={setSelectedConfigId}
 placeholder={t('pos.select_config')}
 >
 {configs.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </div>
 <ResponsiveTableAdapter
 dataSource={floors}
 columns={floorColumns}
 rowKey="id"
 loading={loading}
 pagination={false}
 />

 <FormDialog
 title={editingFloorId ? t('pos.edit_floor') : t('pos.new_floor')}
 open={floorModalVisible}
 onClose={() => setFloorModalVisible(false)}
 onOk={() => floorForm.submit()}
 >
 <Form form={floorForm} layout="vertical" onFinish={handleFloorSubmit}>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="name" label={t('pos.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="name_ku" label={t('pos.name_ku')}>
 <Input />
 </Form.Item>
 </Col>
 </Row>
 <Form.Item name="config_id" label={t('pos.config')} rules={[{ required: true }]}>
 <Select disabled={!!editingFloorId}>
 {configs.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="sequence" label={t('pos.sequence')}>
 <InputNumber style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="background_image_url" label={t('pos.background_image_url')}>
 <Input placeholder="https://..." />
 </Form.Item>
 <Form.Item name="is_active" valuePropName="checked">
 <Select>
 <Select.Option value={true}>{t('active')}</Select.Option>
 <Select.Option value={false}>{t('inactive')}</Select.Option>
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('pos.floor_plan_editor')}
 onClose={() => setEditorDrawerVisible(false)}
 open={editorDrawerVisible}
 >
 <Space orientation="vertical" style={{ width: '100%' }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openTableModal()}>
 {t('pos.add_table')}
 </Button>
 <ResponsiveTableAdapter
 dataSource={tables}
 columns={tableColumns}
 rowKey="id"
 pagination={false}
 />
 </Space>
 </FormDialog>

 <FormDialog
 title={editingTableId ? t('pos.edit_table') : t('pos.add_table')}
 open={tableModalVisible}
 onClose={() => setTableModalVisible(false)}
 onOk={() => tableForm.submit()}
 >
 <Form form={tableForm} layout="vertical" onFinish={handleTableSubmit}>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="name" label={t('pos.table_name')} rules={[{ required: true }]}>
 <Input placeholder="T1" />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="seats" label={t('pos.seats')} rules={[{ required: true }]}>
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={8}>
 <Form.Item name="shape" label={t('pos.shape')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="square">{t('pos.square')}</Select.Option>
 <Select.Option value="round">{t('pos.round')}</Select.Option>
 <Select.Option value="rectangle">{t('pos.rectangle')}</Select.Option>
 </Select>
 </Form.Item>
 </Col>
 <Col span={8}>
 <Form.Item name="width" label={t('pos.width')} rules={[{ required: true }]}>
 <InputNumber min={50} max={500} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={8}>
 <Form.Item name="height" label={t('pos.height')} rules={[{ required: true }]}>
 <InputNumber min={50} max={500} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="position_x" label={t('pos.position_x')}>
 <InputNumber min={0} max={1200} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="position_y" label={t('pos.position_y')}>
 <InputNumber min={0} max={800} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Form.Item name="color" label={t('pos.color')}>
 <Input type="color" style={{ width: 100 }} />
 </Form.Item>
 <Form.Item name="floor_id" hidden>
 <Input />
 </Form.Item>
 <Form.Item name="config_id" hidden>
 <Input />
 </Form.Item>
 <Form.Item name="is_active" hidden initialValue={true}>
 <Input />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default POSFloors;
