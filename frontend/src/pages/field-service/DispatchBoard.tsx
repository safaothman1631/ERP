import React, { useEffect, useState } from 'react';
import { Card, Tag, Button, List, Select, Space, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, StatusTag } from '../../design-system';
import { space } from '../../theme/tokens';
import { message } from '../../utils/message';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Worker {
 id: string;
 name: string;
 is_active: boolean;
}

interface ServiceOrder {
 id: string;
 order_number?: string;
 customer_name: string;
 scheduled_at?: string;
 assigned_worker_id?: string;
 status: string;
 priority: string;
}

interface ScheduleRow {
 worker_id: string;
 worker_name: string;
 orders: ServiceOrder[];
}

const DispatchBoard: React.FC = () => {
 const { t } = useTranslation();
 const [loading, setLoading] = useState(false);
 const [workers, setWorkers] = useState<Worker[]>([]);
 const [orders, setOrders] = useState<ServiceOrder[]>([]);
 const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
 const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
 const [showDrawer, setShowDrawer] = useState(false);
 const [unassignedOrders, setUnassignedOrders] = useState<ServiceOrder[]>([]);
 const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
 const [selectedWorkerId, setSelectedWorkerId] = useState<string | undefined>();

 const fetchData = async () => {
 setLoading(true);
 try {
 const [workersRes, ordersRes] = await Promise.all([
 api.get('/api/field-service/workers', { params: { limit: 100 } }),
 api.get('/api/field-service/orders', { params: { limit: 500 } }),
 ]);

 const workersData: Worker[] = workersRes.data.items || [];
 const ordersData: ServiceOrder[] = ordersRes.data.items || [];

 setWorkers(workersData.filter((w) => w.is_active));
 setOrders(ordersData);

 buildSchedule(workersData, ordersData, selectedDate);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const buildSchedule = (workersData: Worker[], ordersData: ServiceOrder[], date: Dayjs) => {
 const dateStr = date.format('YYYY-MM-DD');
 const dayOrders = ordersData.filter((o) => {
 const sched = o.scheduled_at;
 return sched && sched.startsWith(dateStr);
 });

 const unassigned = dayOrders.filter((o) => !o.assigned_worker_id);
 setUnassignedOrders(unassigned);

 const rows: ScheduleRow[] = workersData
 .filter((w) => w.is_active)
 .map((w) => ({
 worker_id: w.id,
 worker_name: w.name,
 orders: dayOrders.filter((o) => o.assigned_worker_id === w.id),
 }));

 setSchedules(rows);
 };

 useEffect(() => {
 void fetchData();
 }, []);

 useEffect(() => {
 if (workers.length > 0 && orders.length > 0) {
 buildSchedule(workers, orders, selectedDate);
 }
 }, [selectedDate]);

 const handleDateChange = (date: Dayjs | null) => {
 if (date) {
 setSelectedDate(date);
 }
 };

 const handleAssign = async () => {
 if (!assigningOrderId || !selectedWorkerId) {
 message.warning(t('field_service.select_technician'));
 return;
 }
 try {
 await api.patch(`/api/field-service/orders/${assigningOrderId}`, {
 assigned_worker_id: selectedWorkerId,
 status: 'scheduled',
 });
 message.success(t('field_service.order_updated'));
 setAssigningOrderId(null);
 setSelectedWorkerId(undefined);
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const statusKinds: Record<string, string> = {
 draft: 'draft',
 scheduled: 'info',
 in_progress: 'warning',
 done: 'success',
 cancelled: 'cancelled',
 };

 const columns: ColumnsType<ScheduleRow> = [
 {
 title: t('field_service.technician'),
 dataIndex: 'worker_name',
 key: 'worker_name',
 width: 200,
 fixed: 'left',
 },
 {
 title: `${t('field_service.todays_schedule')} (${selectedDate.format('YYYY-MM-DD')})`,
 key: 'orders',
 render: (_: unknown, record: ScheduleRow) => (
 <Space direction="vertical" style={{ width: '100%' }}>
 {record.orders.length === 0 ? (
 <Tag>No orders</Tag>
 ) : (
 record.orders.map((o) => (
 <Card
 key={o.id}
 size="small"
 style={{
 background: 'var(--surface-2)',
 borderRadius: 'var(--radius-md)',
 }}
 >
 <Space style={{ justifyContent: 'space-between', width: '100%' }}>
 <div style={{ fontSize: 12 }}>
 <strong>{o.order_number || o.id.slice(0, 8)}</strong> - {o.customer_name}
 </div>
 <StatusTag
 status={statusKinds[o.status] || 'default'}
 label={t(`field_service.status_${o.status}`)}
 />
 </Space>
 <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
 {o.scheduled_at ? dayjs(o.scheduled_at).format('HH:mm') : '-'}
 </div>
 </Card>
 ))
 )}
 </Space>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('field_service.dispatch_board')}
 subtitle={t('field_service.title')}
 breadcrumb={[
 { label: t('dashboard'), to: '/' },
 { label: t('field_service.title') },
 { label: t('field_service.dispatch_board') },
 ]}
 extra={
 <Space>
 <DatePicker value={selectedDate} onChange={handleDateChange} />
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowDrawer(true)}>
 {t('field_service.unassigned_orders')} ({unassignedOrders.length})
 </Button>
 </Space>
 }
 />

 <Card>
 <ResponsiveTableAdapter
 dataSource={schedules}
 columns={columns}
 rowKey="worker_id"
 loading={loading}
 pagination={false}
 scroll={{ x: 800 }}
 />
 </Card>

 <FormDialog
 title={t('field_service.unassigned_orders')}
 open={showDrawer}
 onClose={() => {
 setShowDrawer(false);
 setAssigningOrderId(null);
 setSelectedWorkerId(undefined);
 }}
 >
 {unassignedOrders.length === 0 ? (
 <p>{t('no_data')}</p>
 ) : (
 <List
 dataSource={unassignedOrders}
 renderItem={(order) => (
 <List.Item
 actions={[
 assigningOrderId === order.id ? (
 <Space>
 <Select
 placeholder={t('field_service.select_technician')}
 style={{ width: 150 }}
 value={selectedWorkerId}
 onChange={setSelectedWorkerId}
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {workers.map((w) => (
 <Select.Option key={w.id} value={w.id}>
 {w.name}
 </Select.Option>
 ))}
 </Select>
 <Button type="primary" onClick={handleAssign}>
 {t('assign')}
 </Button>
 <Button onClick={() => setAssigningOrderId(null)}>
 {t('cancel')}
 </Button>
 </Space>
 ) : (
 <Button type="link" onClick={() => setAssigningOrderId(order.id)}>
 {t('field_service.assign_order')}
 </Button>
 ),
 ]}
 >
 <List.Item.Meta
 title={`${order.order_number || order.id.slice(0, 8)} - ${order.customer_name}`}
 description={
 <>
 <StatusTag
 status={statusKinds[order.status] || 'default'}
 label={t(`field_service.status_${order.status}`)}
 />
 {order.scheduled_at && (
 <span style={{ marginInlineStart: space.sm }}>
 {dayjs(order.scheduled_at).format('HH:mm')}
 </span>
 )}
 </>
 }
 />
 </List.Item>
 )}
 />
 )}
 </FormDialog>
 </>
 );
};

export default DispatchBoard;
