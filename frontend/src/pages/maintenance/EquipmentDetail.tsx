import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Descriptions, Tabs, Button, Form, Input, InputNumber, Space, Tag } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import dayjs from 'dayjs';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { RelatedDataPanel } from '../../design-system/empty/RelatedDataPanel';

interface Equipment {
 id: string;
 name: string;
 serial_no?: string;
 category_id?: string;
 location?: string;
 purchase_date?: string;
 purchase_value: number;
 warranty_until?: string;
 is_active: boolean;
 status?: string;
}

interface Category {
 id: string;
 name: string;
}

const EquipmentDetail: React.FC = () => {
 const { t } = useTranslation();
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const [equipment, setEquipment] = useState<Equipment | null>(null);
 const [category, setCategory] = useState<Category | null>(null);
 const [loading, setLoading] = useState(false);
 const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
 const [schedules, setSchedules] = useState<Record<string, unknown>[]>([]);
 const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
 const [logModalOpen, setLogModalOpen] = useState(false);
 const [logForm] = Form.useForm();
 const [savingLog, setSavingLog] = useState(false);

 const fetchEquipment = async () => {
 if (!id) return;
 setLoading(true);
 try {
 const r = await api.get(`/api/maintenance/equipment/${id}`);
 setEquipment(r.data);
 if (r.data.category_id) {
 const catR = await api.get(`/api/maintenance/categories/${r.data.category_id}`);
 setCategory(catR.data);
 }
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchRequests = async () => {
 if (!id) return;
 try {
 const r = await api.get('/api/maintenance/requests', { params: { limit: 500 } });
 const items = (r.data.items || []).filter((req: Record<string, unknown>) => req.equipment_id === id);
 setRequests(items);
 } catch {
 // Ignore
 }
 };

 const fetchSchedules = async () => {
 if (!id) return;
 try {
 const r = await api.get('/api/maintenance/schedules', { params: { limit: 500 } });
 const items = (r.data.items || []).filter((sch: Record<string, unknown>) => sch.equipment_id === id);
 setSchedules(items);
 } catch {
 // Ignore
 }
 };

 const fetchLogs = async () => {
 if (!id) return;
 try {
 const r = await api.get('/api/maintenance/logs', { params: { limit: 500 } });
 const items = (r.data.items || []).filter((log: Record<string, unknown>) => log.equipment_id === id);
 setLogs(items);
 } catch {
 // Ignore
 }
 };

 useEffect(() => {
 void fetchEquipment();
 void fetchRequests();
 void fetchSchedules();
 void fetchLogs();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [id]);

 const handleSaveLog = async (values: Record<string, unknown>) => {
 if (!id) return;
 setSavingLog(true);
 try {
 await api.post('/api/maintenance/logs', {
 equipment_id: id,
 action: values.action,
 notes: values.notes,
 duration_minutes: values.duration_minutes,
 });
 message.success(t('success'));
 setLogModalOpen(false);
 logForm.resetFields();
 void fetchLogs();
 } catch {
 message.error(t('error'));
 } finally {
 setSavingLog(false);
 }
 };

 const requestColumns = [
 { title: t('maintenance.title'), dataIndex: 'title', key: 'title' },
 { title: t('maintenance.type'), dataIndex: 'type', key: 'type', render: (type: string) => t(`maintenance.type_${type}`, type) },
 {
 title: t('maintenance.status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => <Tag>{t(`maintenance.status_${status}`, status)}</Tag>,
 },
 ];

 const scheduleColumns = [
 {
 title: t('maintenance.interval_days'),
 dataIndex: 'interval_days',
 key: 'interval_days',
 render: (days: number) => `${days} ${t('days')}`,
 },
 { title: t('description'), dataIndex: 'description', key: 'description' },
 {
 title: t('maintenance.next_due_date'),
 dataIndex: 'next_due_date',
 key: 'next_due_date',
 render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD') : '—'),
 },
 ];

 const logColumns = [
 { title: t('maintenance.action'), dataIndex: 'action', key: 'action' },
 { title: t('maintenance.notes'), dataIndex: 'notes', key: 'notes' },
 {
 title: t('maintenance.duration_minutes'),
 dataIndex: 'duration_minutes',
 key: 'duration_minutes',
 render: (mins: number) => (mins ? `${mins} min` : '—'),
 },
 {
 title: t('date'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '—'),
 },
 ];

 if (!equipment) {
 return null;
 }

 const statusColors: Record<string, string> = {
 idle: 'default',
 in_use: 'blue',
 maintenance: 'orange',
 broken: 'red',
 };

 return (
 <>
 <PageHeader
 title={equipment.name}
 subtitle={`${t('maintenance.equipment')} ${t('details')}`}
 extra={
 <Space>
 <Tag color={statusColors[equipment.status || 'idle']}>
 {t(`maintenance.status_${equipment.status || 'idle'}`, equipment.status || 'idle')}
 </Tag>
 <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/maintenance/equipment')}>
 {t('back')}
 </Button>
 </Space>
 }
 />
 <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
 <Descriptions.Item label={t('maintenance.serial_no')}>{equipment.serial_no || '—'}</Descriptions.Item>
 <Descriptions.Item label={t('maintenance.category')}>{category?.name || '—'}</Descriptions.Item>
 <Descriptions.Item label={t('maintenance.location')}>{equipment.location || '—'}</Descriptions.Item>
 <Descriptions.Item label={t('maintenance.purchase_date')}>
 {equipment.purchase_date ? dayjs(equipment.purchase_date).format('YYYY-MM-DD') : '—'}
 </Descriptions.Item>
 <Descriptions.Item label={t('maintenance.purchase_value')}>
 {equipment.purchase_value?.toLocaleString() || '0'}
 </Descriptions.Item>
 <Descriptions.Item label={t('maintenance.warranty_until')}>
 {equipment.warranty_until ? dayjs(equipment.warranty_until).format('YYYY-MM-DD') : '—'}
 </Descriptions.Item>
 <Descriptions.Item label={t('status')}>
 {equipment.is_active ? t('active') : t('inactive')}
 </Descriptions.Item>
 </Descriptions>

 <Tabs
 defaultActiveKey="requests"
 items={[
 {
 key: 'requests',
 label: t('maintenance.requests'),
 children: (
 <RelatedDataPanel
 entity="maintenance_request"
 data={requests}
 loading={loading}
 emptyTitleKey="maintenance.no_requests_title"
 emptyDescriptionKey="maintenance.no_requests_description"
 >
 <ResponsiveTableAdapter
 columns={requestColumns}
 dataSource={requests}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 loading={loading}
 />
 </RelatedDataPanel>
 ),
 },
 {
 key: 'schedules',
 label: t('maintenance.schedules'),
 children: (
 <RelatedDataPanel
 entity="maintenance_schedule"
 data={schedules}
 loading={loading}
 emptyTitleKey="maintenance.no_schedules_title"
 emptyDescriptionKey="maintenance.no_schedules_description"
 >
 <ResponsiveTableAdapter
 columns={scheduleColumns}
 dataSource={schedules}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 loading={loading}
 />
 </RelatedDataPanel>
 ),
 },
 {
 key: 'logs',
 label: t('maintenance.logs'),
 children: (
 <>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => setLogModalOpen(true)}
 style={{ marginBottom: 16 }}
 >
 {t('maintenance.new_log')}
 </Button>
 <RelatedDataPanel
 entity="maintenance_log"
 data={logs}
 loading={loading}
 emptyTitleKey="maintenance.no_logs_title"
 emptyDescriptionKey="maintenance.no_logs_description"
 >
 <ResponsiveTableAdapter
 columns={logColumns}
 dataSource={logs}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 loading={loading}
 />
 </RelatedDataPanel>
 </>
 ),
 },
 ]}
 />

 <FormDialog
 open={logModalOpen}
 title={t('maintenance.new_log')}
 onClose={() => {
 setLogModalOpen(false);
 logForm.resetFields();
 }}
 onOk={() => logForm.submit()}
 confirmLoading={savingLog}
 >
 <Form form={logForm} layout="vertical" onFinish={handleSaveLog}>
 <Form.Item name="action" label={t('maintenance.action')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="notes" label={t('maintenance.notes')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="duration_minutes" label={t('maintenance.duration_minutes')}>
 <InputNumber style={{ width: '100%' }} min={0} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default EquipmentDetail;
