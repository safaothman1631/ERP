import React, { useEffect, useState } from 'react';
import { Tabs, Button, Space, Form, Input } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, LoadingSkeleton, DetailLayout, SectionCard, KeyValueGrid, StatusTag } from '../../design-system';
import type { StatusKind, KeyValueItem } from '../../design-system';
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

 const statusKinds: Record<string, StatusKind> = {
 draft: 'default',
 scheduled: 'info',
 in_progress: 'warning',
 done: 'success',
 cancelled: 'error',
 };

 const priorityKinds: Record<string, StatusKind> = {
 low: 'default',
 normal: 'info',
 high: 'warning',
 urgent: 'error',
 };

 const canStart = order.status === 'scheduled';
 const canComplete = order.status === 'in_progress';
 const canCancel = order.status !== 'done' && order.status !== 'cancelled';

 const detailItems: KeyValueItem[] = [
 { label: t('field_service.order_number'), value: order.order_number || order.id.slice(0, 8) },
 { label: t('field_service.status'), value: <StatusTag status={statusKinds[order.status] || 'default'} label={t(`field_service.status_${order.status}`)} /> },
 { label: t('field_service.customer_name'), value: order.customer_name },
 { label: t('field_service.priority'), value: <StatusTag status={priorityKinds[order.priority] || 'default'} label={t(`field_service.priority_${order.priority}`)} /> },
 { label: t('field_service.address'), value: order.address || '-', span: 2 },
 { label: t('field_service.scheduled_at'), value: order.scheduled_at ? dayjs(order.scheduled_at).format('YYYY-MM-DD HH:mm') : '-' },
 { label: t('field_service.technician'), value: order.assigned_worker_name || '-' },
 { label: t('field_service.description'), value: order.description || '-', span: 2 },
 ...(order.latitude ? [{ label: t('field_service.latitude'), value: order.latitude } as KeyValueItem] : []),
 ...(order.longitude ? [{ label: t('field_service.longitude'), value: order.longitude } as KeyValueItem] : []),
 ...(order.started_at ? [{ label: t('field_service.started_at'), value: dayjs(order.started_at).format('YYYY-MM-DD HH:mm'), span: 2 } as KeyValueItem] : []),
 ...(order.completed_at ? [{ label: t('field_service.completed_at'), value: dayjs(order.completed_at).format('YYYY-MM-DD HH:mm'), span: 2 } as KeyValueItem] : []),
 ...(order.completion_notes ? [{ label: t('field_service.completion_notes'), value: order.completion_notes, span: 2 } as KeyValueItem] : []),
 ...(order.cancel_reason ? [{ label: t('field_service.cancel_reason'), value: order.cancel_reason, span: 2 } as KeyValueItem] : []),
 ];

 const tabItems = [
 {
 key: 'details',
 label: t('field_service.order_details'),
 children: <KeyValueGrid columns={2} items={detailItems} />,
 },
 {
 key: 'time',
 label: t('field_service.time_log'),
 children: <ComingSoon featureNameKey="field_service.time_log" />,
 },
 {
 key: 'parts',
 label: t('field_service.parts_used'),
 children: <ComingSoon featureNameKey="field_service.parts_used" />,
 },
 {
 key: 'signature',
 label: t('field_service.customer_signature'),
 children: <ComingSoon featureNameKey="field_service.customer_signature" />,
 },
 ];

 return (
 <DetailLayout
 header={
 <PageHeader
 title={`${t('field_service.order_number')}: ${order.order_number || order.id.slice(0, 8)}`}
 subtitle={order.customer_name}
 tag={<StatusTag status={statusKinds[order.status] || 'default'} label={t(`field_service.status_${order.status}`)} />}
 breadcrumb={[
 { label: t('dashboard'), to: '/' },
 { label: t('field_service.title') },
 { label: t('field_service.service_orders'), to: '/field-service/orders' },
 { label: order.order_number || order.id.slice(0, 8) },
 ]}
 />
 }
 toolbar={
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
 >
 <SectionCard>
 <Tabs items={tabItems} />
 </SectionCard>

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
 </DetailLayout>
 );
};

export default ServiceOrderDetail;
