import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tabs, Button, Space, Form, Input, Tag } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, LoadingSkeleton } from '../../design-system';
import { message } from '../../utils/message';
import { FormDialog } from '../../components/responsive/FormDialog';
import { useLoadingState } from '../../hooks/useLoadingState';
import { ComingSoon } from '../../components/feedback/ComingSoon';

interface ServiceOrder {
 id: string;
 order_number?: string;
 customer_name: string;
 address?: string;
 scheduled_at?: string;
 assigned_worker_id?: string;
 assigned_worker_name?: string;
 status: string;
 priority: string;
 description?: string;
 started_at?: string;
 completed_at?: string;
 completion_notes?: string;
 cancel_reason?: string;
 latitude?: number;
 longitude?: number;
}

const ServiceOrderDetail: React.FC = () => {
 const { t } = useTranslation();
 const { id } = useParams<{ id: string }>();
 const _navigate = useNavigate();
 const [loading, setLoading] = useState(false);
 const { showSkeleton } = useLoadingState(loading);
 const [order, setOrder] = useState<ServiceOrder | null>(null);
 const [showCompleteModal, setShowCompleteModal] = useState(false);
 const [showCancelModal, setShowCancelModal] = useState(false);
 const [completeForm] = Form.useForm();
 const [cancelForm] = Form.useForm();

 const fetchOrder = async () => {
 if (!id) return;
 setLoading(true);
 try {
 const [orderRes, workersRes] = await Promise.all([
 api.get(`/api/field-service/orders/${id}`),
 api.get('/api/field-service/workers', { params: { limit: 100 } }),
 ]);
 
 const orderData = orderRes.data;
 const workers = workersRes.data.items || [];
 const worker = workers.find((w: Record<string, unknown>) => w.id === orderData.assigned_worker_id);
 
 setOrder({
 ...orderData,
 assigned_worker_name: worker?.name,
 });
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchOrder();
 }, [id]);

 const handleStart = async () => {
 if (!id) return;
 try {
 await api.post(`/api/field-service/orders/${id}/start`, {});
 message.success(t('field_service.order_started'));
 void fetchOrder();
 } catch {
 message.error(t('error'));
 }
 };

 const handleComplete = async (values: Record<string, unknown>) => {
 if (!id) return;
 try {
 await api.post(`/api/field-service/orders/${id}/complete`, { notes: values.notes });
 message.success(t('field_service.order_completed'));
 setShowCompleteModal(false);
 completeForm.resetFields();
 void fetchOrder();
 } catch {
 message.error(t('error'));
 }
 };

 const handleCancel = async (values: Record<string, unknown>) => {
 if (!id) return;
 try {
 await api.post(`/api/field-service/orders/${id}/cancel`, { reason: values.reason });
 message.success(t('field_service.order_cancelled'));
 setShowCancelModal(false);
 cancelForm.resetFields();
 void fetchOrder();
 } catch {
 message.error(t('error'));
 }
 };

 if (showSkeleton || !order) {
 return <LoadingSkeleton variant="card" />;
 }

 const statusColors: Record<string, string> = {
 draft: 'default',
 scheduled: 'blue',
 in_progress: 'orange',
 done: 'green',
 cancelled: 'red',
 };

 const priorityColors: Record<string, string> = {
 low: 'default',
 normal: 'blue',
 high: 'orange',
 urgent: 'red',
 };

 const canStart = order.status === 'scheduled';
 const canComplete = order.status === 'in_progress';
 const canCancel = order.status !== 'done' && order.status !== 'cancelled';

 const tabItems = [
 {
 key: 'details',
 label: t('field_service.order_details'),
 children: (
 <Descriptions bordered column={2}>
 <Descriptions.Item label={t('field_service.order_number')}>
 {order.order_number || order.id.slice(0, 8)}
 </Descriptions.Item>
 <Descriptions.Item label={t('field_service.status')}>
 <Tag color={statusColors[order.status]}>{t(`field_service.status_${order.status}`)}</Tag>
 </Descriptions.Item>
 <Descriptions.Item label={t('field_service.customer_name')}>
 {order.customer_name}
 </Descriptions.Item>
 <Descriptions.Item label={t('field_service.priority')}>
 <Tag color={priorityColors[order.priority]}>{t(`field_service.priority_${order.priority}`)}</Tag>
 </Descriptions.Item>
 <Descriptions.Item label={t('field_service.address')} span={2}>
 {order.address || '-'}
 </Descriptions.Item>
 <Descriptions.Item label={t('field_service.scheduled_at')}>
 {order.scheduled_at ? dayjs(order.scheduled_at).format('YYYY-MM-DD HH:mm') : '-'}
 </Descriptions.Item>
 <Descriptions.Item label={t('field_service.technician')}>
 {order.assigned_worker_name || '-'}
 </Descriptions.Item>
 <Descriptions.Item label={t('field_service.description')} span={2}>
 {order.description || '-'}
 </Descriptions.Item>
 {order.latitude && (
 <Descriptions.Item label={t('field_service.latitude')}>{order.latitude}</Descriptions.Item>
 )}
 {order.longitude && (
 <Descriptions.Item label={t('field_service.longitude')}>{order.longitude}</Descriptions.Item>
 )}
 {order.started_at && (
 <Descriptions.Item label={t('field_service.started_at')} span={2}>
 {dayjs(order.started_at).format('YYYY-MM-DD HH:mm')}
 </Descriptions.Item>
 )}
 {order.completed_at && (
 <Descriptions.Item label={t('field_service.completed_at')} span={2}>
 {dayjs(order.completed_at).format('YYYY-MM-DD HH:mm')}
 </Descriptions.Item>
 )}
 {order.completion_notes && (
 <Descriptions.Item label={t('field_service.completion_notes')} span={2}>
 {order.completion_notes}
 </Descriptions.Item>
 )}
 {order.cancel_reason && (
 <Descriptions.Item label={t('field_service.cancel_reason')} span={2}>
 {order.cancel_reason}
 </Descriptions.Item>
 )}
 </Descriptions>
 ),
 },
 {
 key: 'time',
 label: t('field_service.time_log'),
 children: (
 <Card>
 <ComingSoon featureNameKey="field_service.time_log" />
 </Card>
 ),
 },
 {
 key: 'parts',
 label: t('field_service.parts_used'),
 children: (
 <Card>
 <ComingSoon featureNameKey="field_service.parts_used" />
 </Card>
 ),
 },
 {
 key: 'signature',
 label: t('field_service.customer_signature'),
 children: (
 <Card>
 <ComingSoon featureNameKey="field_service.customer_signature" />
 </Card>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={`${t('field_service.order_number')}: ${order.order_number || order.id.slice(0, 8)}`}
 subtitle={order.customer_name}
 breadcrumb={[
 { label: t('dashboard'), to: '/' },
 { label: t('field_service.title') },
 { label: t('field_service.service_orders'), to: '/field-service/orders' },
 { label: order.order_number || order.id.slice(0, 8) },
 ]}
 extra={
 <Space>
 {canStart && (
 <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>
 {t('field_service.start_order')}
 </Button>
 )}
 {canComplete && (
 <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setShowCompleteModal(true)}>
 {t('field_service.complete_order')}
 </Button>
 )}
 {canCancel && (
 <Button danger icon={<CloseCircleOutlined />} onClick={() => setShowCancelModal(true)}>
 {t('field_service.cancel_order')}
 </Button>
 )}
 </Space>
 }
 />

 <Card>
 <Tabs items={tabItems} />
 </Card>

 <FormDialog
 title={t('field_service.complete_order')}
 open={showCompleteModal}
 onClose={() => {
 setShowCompleteModal(false);
 completeForm.resetFields();
 }}
 onOk={() => completeForm.submit()}
 >
 <Form form={completeForm} layout="vertical" onFinish={handleComplete}>
 <Form.Item name="notes" label={t('field_service.completion_notes')}>
 <Input.TextArea rows={4} />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('field_service.cancel_order')}
 open={showCancelModal}
 onClose={() => {
 setShowCancelModal(false);
 cancelForm.resetFields();
 }}
 onOk={() => cancelForm.submit()}
 >
 <Form form={cancelForm} layout="vertical" onFinish={handleCancel}>
 <Form.Item name="reason" label={t('field_service.cancel_reason')} rules={[{ required: true }]}>
 <Input.TextArea rows={3} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default ServiceOrderDetail;
