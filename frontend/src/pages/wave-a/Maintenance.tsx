import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Tag, message, Card, InputNumber, DatePicker, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const Maintenance: React.FC = () => {
 const { t } = useTranslation();
 const [requests, setRequests] = useState<any[]>([]);
 const [equipment, setEquipment] = useState<any[]>([]);
 const [schedules, setSchedules] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [editing, setEditing] = useState<any>(null);

 const fetchRequests = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/maintenance/requests', { params: { limit: 100 } });
 setRequests(res.data.items || []);
 } catch (error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchEquipment = async () => {
 try {
 const res = await api.get('/api/maintenance/equipment', { params: { limit: 100 } });
 setEquipment(res.data.items || []);
 } catch {}
 };

 const fetchSchedules = async () => {
 try {
 const res = await api.get('/api/maintenance/schedules', { params: { limit: 100 } });
 setSchedules(res.data.items || []);
 } catch {}
 };

 useEffect(() => {
 void fetchRequests();
 void fetchEquipment();
 void fetchSchedules();
 }, []);

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.patch(`/api/maintenance/requests/${editing.id}`, values);
 } else {
 await api.post('/api/maintenance/requests', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditing(null);
 void fetchRequests();
 } catch {
 message.error(t('error'));
 }
 };

 const handleExecute = async (id: string) => {
 try {
 await api.patch(`/api/maintenance/requests/${id}`, { status: 'completed' });
 message.success(t('maintenance.executed'));
 void fetchRequests();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/maintenance/requests/${id}`);
 message.success(t('success'));
 void fetchRequests();
 },
 });
 };

 const statusColors: Record<string, string> = {
 pending: 'default',
 scheduled: 'blue',
 in_progress: 'orange',
 completed: 'green',
 cancelled: 'red',
 };

 const columns = [
 { title: t('maintenance.request_id'), dataIndex: 'id', key: 'id', width: 120 },
 { title: t('maintenance.equipment'), dataIndex: 'equipment_id', key: 'equipment_id' },
 { title: t('maintenance.title'), dataIndex: 'title', key: 'title' },
 { title: t('maintenance.type'), dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{t(`maintenance.type_${v}`)}</Tag> },
 { title: t('maintenance.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v] || 'default'}>{t(`maintenance.status_${v}`)}</Tag> },
 { title: t('maintenance.priority'), dataIndex: 'priority', key: 'priority', render: (v: string) => <Tag color={v === 'urgent' ? 'red' : v === 'high' ? 'orange' : 'default'}>{t(`priority_${v}`)}</Tag> },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 {record.status !== 'completed' && (
 <Button icon={<PlayCircleOutlined />} type="primary" onClick={() => handleExecute(record.id)} title={t('maintenance.execute')} />
 )}
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('maintenance.title')}
 subtitle={t('maintenance.subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
 {t('maintenance.new_request')}
 </Button>
 }
 />
 <Card style={{ marginTop: space.md }}>
 <ResponsiveTableAdapter dataSource={requests} columns={columns} loading={loading} rowKey="id" />
 </Card>

 <FormDialog
 title={editing ? t('maintenance.edit_request') : t('maintenance.new_request')}
 open={modalOpen}
 onClose={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="equipment_id" label={t('maintenance.equipment')} rules={[{ required: true }]}>
 <Select placeholder={t('maintenance.select_equipment')}>
 {equipment.map((e) => (
 <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="title" label={t('maintenance.title')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="type" label={t('maintenance.type')} initialValue="corrective">
 <Select>
 <Select.Option value="corrective">{t('maintenance.type_corrective')}</Select.Option>
 <Select.Option value="preventive">{t('maintenance.type_preventive')}</Select.Option>
 <Select.Option value="inspection">{t('maintenance.type_inspection')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="priority" label={t('maintenance.priority')} initialValue="medium">
 <Select>
 <Select.Option value="low">{t('priority_low')}</Select.Option>
 <Select.Option value="medium">{t('priority_medium')}</Select.Option>
 <Select.Option value="high">{t('priority_high')}</Select.Option>
 <Select.Option value="urgent">{t('priority_urgent')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="description" label={t('maintenance.description')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Maintenance;
