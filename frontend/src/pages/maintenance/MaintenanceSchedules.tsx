import React, { useEffect, useState } from 'react';
import { Button, Form, InputNumber, Input, Select, Space, DatePicker, Popconfirm, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Schedule {
 id: string;
 equipment_id: string;
 interval_days: number;
 description?: string;
 next_due_date?: string;
}

interface Equipment {
 id: string;
 name: string;
}

const MaintenanceSchedules: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Schedule[]>([]);
 const [equipment, setEquipment] = useState<Equipment[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);

 const fetchData = async () => {
 setLoading(true);
 try {
 const r = await api.get('/api/maintenance/schedules', { params: { limit: 500 } });
 setData(r.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchEquipment = async () => {
 try {
 const r = await api.get('/api/maintenance/equipment', { params: { limit: 500 } });
 setEquipment(r.data.items || []);
 } catch {
 // Ignore
 }
 };

 useEffect(() => {
 void fetchData();
 void fetchEquipment();
 }, []);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ interval_days: 30 });
 setModalOpen(true);
 };

 const openEdit = (record: Schedule) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 next_due_date: record.next_due_date ? dayjs(record.next_due_date) : undefined,
 });
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 next_due_date: values.next_due_date ? (values.next_due_date as Dayjs).format('YYYY-MM-DD') : undefined,
 };
 if (editingId) {
 await api.patch(`/api/maintenance/schedules/${editingId}`, payload);
 } else {
 await api.post('/api/maintenance/schedules', payload);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditingId(null);
 void fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/maintenance/schedules/${id}`);
 message.success(t('success'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleGenerateRequest = async (schedule: Schedule) => {
 try {
 await api.post('/api/maintenance/requests', {
 equipment_id: schedule.equipment_id,
 title: `${t('maintenance.scheduled_maintenance')} - ${schedule.description || ''}`,
 description: schedule.description,
 type: 'preventive',
 priority: 'medium',
 });
 message.success(t('maintenance.request_created'));
 } catch {
 message.error(t('error'));
 }
 };

 const overdueCount = data.filter(
 (s) => s.next_due_date && dayjs(s.next_due_date).isBefore(dayjs(), 'day')
 ).length;

 const columns = [
 {
 title: t('maintenance.equipment'),
 dataIndex: 'equipment_id',
 key: 'equipment_id',
 width: 200,
 render: (eqId: string) => {
 const eq = equipment.find((e) => e.id === eqId);
 return eq ? eq.name : '—';
 },
 },
 {
 title: t('maintenance.interval_days'),
 dataIndex: 'interval_days',
 key: 'interval_days',
 width: 140,
 render: (days: number) => `${days} ${t('days')}`,
 },
 { title: t('description'), dataIndex: 'description', key: 'description' },
 {
 title: t('maintenance.next_due_date'),
 dataIndex: 'next_due_date',
 key: 'next_due_date',
 width: 140,
 render: (date: string) => {
 if (!date) return '—';
 const isOverdue = dayjs(date).isBefore(dayjs(), 'day');
 return (
 <span style={{ color: isOverdue ? 'red' : undefined, fontWeight: isOverdue ? 'bold' : undefined }}>
 {dayjs(date).format('YYYY-MM-DD')}
 {isOverdue && ' ⚠️'}
 </span>
 );
 },
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 260,
 fixed: 'right' as const,
 render: (_: unknown, record: Schedule) => (
 <Space>
 <Button
 type="primary"
 icon={<ThunderboltOutlined />}
 onClick={() => handleGenerateRequest(record)}
 >
 {t('maintenance.generate_request')}
 </Button>
 <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(record.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('maintenance.schedules')}
 subtitle={t('maintenance.schedules_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('maintenance.new_schedule')}
 </Button>
 }
 />
 {overdueCount > 0 && (
 <Alert
 message={t('maintenance.overdue_warning', { count: overdueCount })}
 description={t('maintenance.overdue_description')}
 type="warning"
 showIcon
 style={{ marginBottom: 16 }}
 />
 )}
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={data}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 50, showSizeChanger: true }}
 scroll={{ x: 1100 }}
 />
 <FormDialog
 open={modalOpen}
 title={editingId ? t('maintenance.edit_schedule') : t('maintenance.new_schedule')}
 onClose={() => {
 setModalOpen(false);
 form.resetFields();
 setEditingId(null);
 }}
 onOk={() => form.submit()}
 confirmLoading={saving}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="equipment_id" label={t('maintenance.equipment')} rules={[{ required: true }]}>
 <Select placeholder={t('maintenance.select_equipment')}>
 {equipment.map((eq) => (
 <Select.Option key={eq.id} value={eq.id}>
 {eq.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item
 name="interval_days"
 label={t('maintenance.interval_days')}
 rules={[{ required: true, type: 'number', min: 1, max: 3650 }]}
 >
 <InputNumber style={{ width: '100%' }} min={1} max={3650} />
 </Form.Item>
 <Form.Item name="description" label={t('description')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="next_due_date" label={t('maintenance.next_due_date')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default MaintenanceSchedules;
