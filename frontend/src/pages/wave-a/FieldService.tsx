import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Tag, message, Card, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, UserAddOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { TextArea } = Input;

const FieldService: React.FC = () => {
 const { t } = useTranslation();
 const [orders, setOrders] = useState<any[]>([]);
 const [workers, setWorkers] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [assignModalOpen, setAssignModalOpen] = useState(false);
 const [selectedOrder, setSelectedOrder] = useState<any>(null);
 const [form] = Form.useForm();
 const [assignForm] = Form.useForm();
 const [editing, setEditing] = useState<any>(null);

 const fetchOrders = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/field-service/service-orders', { params: { limit: 100 } });
 setOrders(res.data.items || []);
 } catch (_error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchWorkers = async () => {
 try {
 const res = await api.get('/api/field-service/workers', { params: { limit: 100 } });
 setWorkers(res.data.items || []);
 } catch { /* noop */ }
 };

 useEffect(() => {
 void fetchOrders();
 void fetchWorkers();
 }, []);

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.patch(`/api/field-service/service-orders/${editing.id}`, values);
 } else {
 await api.post('/api/field-service/service-orders', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditing(null);
 void fetchOrders();
 } catch {
 message.error(t('error'));
 }
 };

 const handleAssign = async (values: any) => {
 if (!selectedOrder) return;
 try {
 await api.patch(`/api/field-service/service-orders/${selectedOrder.id}`, {
 assigned_worker_id: values.worker_id,
 });
 message.success(t('field_service.worker_assigned'));
 setAssignModalOpen(false);
 assignForm.resetFields();
 setSelectedOrder(null);
 void fetchOrders();
 } catch {
 message.error(t('error'));
 }
 };

 const handleComplete = async (id: string) => {
 try {
 await api.patch(`/api/field-service/service-orders/${id}`, { status: 'done' });
 message.success(t('success'));
 void fetchOrders();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/field-service/service-orders/${id}`);
 message.success(t('success'));
 void fetchOrders();
 },
 });
 };

 const openAssign = (record: any) => {
 setSelectedOrder(record);
 assignForm.setFieldsValue({ worker_id: record.assigned_worker_id });
 setAssignModalOpen(true);
 };

 const statusColors: Record<string, string> = {
 draft: 'default',
 scheduled: 'blue',
 in_progress: 'orange',
 done: 'green',
 cancelled: 'red',
 };

 const columns = [
 { title: t('field_service.order_id'), dataIndex: 'id', key: 'id', width: 120 },
 { title: t('field_service.customer'), dataIndex: 'customer_name', key: 'customer_name' },
 { title: t('field_service.address'), dataIndex: 'address', key: 'address' },
 { title: t('field_service.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v] || 'default'}>{t(`field_service.status_${v}`)}</Tag> },
 { title: t('field_service.worker'), dataIndex: 'assigned_worker_id', key: 'assigned_worker_id', render: (v: string) => v || t('field_service.unassigned') },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<UserAddOutlined />} onClick={() => openAssign(record)} title={t('field_service.assign_worker')} />
 {record.status !== 'done' && (
 <Button icon={<CheckCircleOutlined />} type="primary" onClick={() => handleComplete(record.id)} />
 )}
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('field_service.title')}
 subtitle={t('field_service.subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
 {t('field_service.new_order')}
 </Button>
 }
 />
 <Card style={{ marginTop: space.md }}>
 <ResponsiveTableAdapter dataSource={orders} columns={columns} loading={loading} rowKey="id" />
 </Card>

 <FormDialog
 title={editing ? t('field_service.edit_order') : t('field_service.new_order')}
 open={modalOpen}
 onClose={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="customer_name" label={t('field_service.customer')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="address" label={t('field_service.address')}>
 <Input />
 </Form.Item>
 <Form.Item name="description" label={t('field_service.description')}>
 <TextArea rows={3} />
 </Form.Item>
 <Form.Item name="priority" label={t('field_service.priority')} initialValue="normal">
 <Select>
 <Select.Option value="low">{t('priority_low')}</Select.Option>
 <Select.Option value="normal">{t('priority_medium')}</Select.Option>
 <Select.Option value="high">{t('priority_high')}</Select.Option>
 <Select.Option value="urgent">{t('priority_urgent')}</Select.Option>
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('field_service.assign_worker')}
 open={assignModalOpen}
 onClose={() => { setAssignModalOpen(false); assignForm.resetFields(); setSelectedOrder(null); }}
 onOk={() => assignForm.submit()}
 >
 <Form form={assignForm} layout="vertical" onFinish={handleAssign}>
 <Form.Item name="worker_id" label={t('field_service.worker')} rules={[{ required: true }]}>
 <Select placeholder={t('field_service.select_worker')}>
 {workers.map((w) => (
 <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default FieldService;
