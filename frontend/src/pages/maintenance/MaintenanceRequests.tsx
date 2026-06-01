import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Select, Space, DatePicker, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, PlayCircleOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import { PageHeader, FilterBar, StatusTag } from '../../design-system';
import type { StatusKind } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface MaintRequest {
 id: string;
 equipment_id: string;
 title: string;
 description?: string;
 type: string;
 priority: string;
 status?: string;
 requested_by?: string;
 assigned_to?: string;
 scheduled_at?: string;
}

interface Equipment {
 id: string;
 name: string;
}

const statusKinds: Record<string, StatusKind> = {
 new: 'default',
 in_progress: 'info',
 done: 'success',
 cancelled: 'error',
};

const priorityKinds: Record<string, StatusKind> = {
 low: 'default',
 medium: 'info',
 high: 'warning',
 urgent: 'error',
};

const MaintenanceRequests: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<MaintRequest[]>([]);
 const [equipment, setEquipment] = useState<Equipment[]>([]);
 const [loading, setLoading] = useState(false);
 const [statusFilter, setStatusFilter] = useState('');
 const [typeFilter, setTypeFilter] = useState('');
 const [priorityFilter, setPriorityFilter] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);

 const fetchData = async () => {
 setLoading(true);
 try {
 const r = await api.get('/api/maintenance/requests', { params: { limit: 500 } });
 let items = r.data.items || [];
 if (statusFilter) items = items.filter((req: MaintRequest) => req.status === statusFilter);
 if (typeFilter) items = items.filter((req: MaintRequest) => req.type === typeFilter);
 if (priorityFilter) items = items.filter((req: MaintRequest) => req.priority === priorityFilter);
 setData(items);
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
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [statusFilter, typeFilter, priorityFilter]);

 useEffect(() => {
 void fetchEquipment();
 }, []);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ type: 'corrective', priority: 'medium' });
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 scheduled_at: values.scheduled_at ? (values.scheduled_at as Dayjs).toISOString() : undefined,
 };
 if (editingId) {
 await api.patch(`/api/maintenance/requests/${editingId}`, payload);
 } else {
 await api.post('/api/maintenance/requests', payload);
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

 const handleStart = async (id: string) => {
 try {
 await api.post(`/api/maintenance/requests/${id}/start`);
 message.success(t('maintenance.request_started'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleComplete = async (id: string) => {
 try {
 await api.post(`/api/maintenance/requests/${id}/complete`, { notes: '' });
 message.success(t('maintenance.request_completed'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleCancel = async (id: string) => {
 try {
 await api.patch(`/api/maintenance/requests/${id}`, { status: 'cancelled' });
 message.success(t('maintenance.request_cancelled'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/maintenance/requests/${id}`);
 message.success(t('success'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const columns = [
 {
 title: t('maintenance.equipment'),
 dataIndex: 'equipment_id',
 key: 'equipment_id',
 width: 150,
 render: (eqId: string) => {
 const eq = equipment.find((e) => e.id === eqId);
 return eq ? eq.name : '—';
 },
 },
 { title: t('maintenance.title'), dataIndex: 'title', key: 'title', width: 200 },
 {
 title: t('maintenance.type'),
 dataIndex: 'type',
 key: 'type',
 width: 120,
 render: (type: string) => t(`maintenance.type_${type}`, type),
 },
 {
 title: t('maintenance.priority'),
 dataIndex: 'priority',
 key: 'priority',
 width: 100,
 render: (priority: string) => (
 <StatusTag status={priorityKinds[priority] || 'default'} label={t(`maintenance.priority_${priority}`, priority)} />
 ),
 },
 {
 title: t('maintenance.status'),
 dataIndex: 'status',
 key: 'status',
 width: 120,
 render: (status: string) => (
 <StatusTag status={statusKinds[status] || 'default'} label={t(`maintenance.status_${status}`, status)} />
 ),
 },
 { title: t('maintenance.requested_by'), dataIndex: 'requested_by', key: 'requested_by', width: 130 },
 { title: t('maintenance.assigned_to'), dataIndex: 'assigned_to', key: 'assigned_to', width: 130 },
 {
 title: t('maintenance.scheduled_at'),
 dataIndex: 'scheduled_at',
 key: 'scheduled_at',
 width: 140,
 render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '—'),
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 220,
 fixed: 'right' as const,
 render: (_: unknown, record: MaintRequest) => (
 <Space>
 {record.status === 'new' && (
 <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStart(record.id)}>
 {t('maintenance.start')}
 </Button>
 )}
 {record.status === 'in_progress' && (
 <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleComplete(record.id)}>
 {t('maintenance.complete')}
 </Button>
 )}
 {record.status !== 'done' && record.status !== 'cancelled' && (
 <Button danger icon={<StopOutlined />} onClick={() => handleCancel(record.id)}>
 {t('cancel')}
 </Button>
 )}
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
 title={t('maintenance.requests')}
 subtitle={t('maintenance.requests_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('maintenance.new_request')}
 </Button>
 }
 />
 <FilterBar
 filters={[
 {
 key: 'status',
 label: t('maintenance.filter_status'),
 options: [
 { value: 'new', label: t('maintenance.status_new') },
 { value: 'in_progress', label: t('maintenance.status_in_progress') },
 { value: 'done', label: t('maintenance.status_done') },
 { value: 'cancelled', label: t('maintenance.status_cancelled') },
 ],
 },
 {
 key: 'type',
 label: t('maintenance.filter_type'),
 options: [
 { value: 'corrective', label: t('maintenance.type_corrective') },
 { value: 'preventive', label: t('maintenance.type_preventive') },
 { value: 'inspection', label: t('maintenance.type_inspection') },
 ],
 },
 {
 key: 'priority',
 label: t('maintenance.filter_priority'),
 options: [
 { value: 'low', label: t('maintenance.priority_low') },
 { value: 'medium', label: t('maintenance.priority_medium') },
 { value: 'high', label: t('maintenance.priority_high') },
 { value: 'urgent', label: t('maintenance.priority_urgent') },
 ],
 },
 ]}
 values={{ status: statusFilter || undefined, type: typeFilter || undefined, priority: priorityFilter || undefined }}
 onChange={(v) => {
 setStatusFilter((v.status as string) || '');
 setTypeFilter((v.type as string) || '');
 setPriorityFilter((v.priority as string) || '');
 }}
 />
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={data}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 50, showSizeChanger: true }}
 scroll={{ x: 1500 }}
 />
 <FormDialog
 open={modalOpen}
 title={editingId ? t('maintenance.edit_request') : t('maintenance.new_request')}
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
 <Form.Item name="title" label={t('maintenance.title')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="description" label={t('description')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="type" label={t('maintenance.type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="corrective">{t('maintenance.type_corrective')}</Select.Option>
 <Select.Option value="preventive">{t('maintenance.type_preventive')}</Select.Option>
 <Select.Option value="inspection">{t('maintenance.type_inspection')}</Select.Option>
 </Select>
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="priority" label={t('maintenance.priority')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="low">{t('maintenance.priority_low')}</Select.Option>
 <Select.Option value="medium">{t('maintenance.priority_medium')}</Select.Option>
 <Select.Option value="high">{t('maintenance.priority_high')}</Select.Option>
 <Select.Option value="urgent">{t('maintenance.priority_urgent')}</Select.Option>
 </Select>
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="assigned_to" label={t('maintenance.assigned_to')}>
 <Input />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="scheduled_at" label={t('maintenance.scheduled_at')}>
 <DatePicker showTime style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 </Form>
 </FormDialog>
 </>
 );
};

export default MaintenanceRequests;
