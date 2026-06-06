import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Select, DatePicker, Form, Input, InputNumber, Modal, Radio } from 'antd';
import { PlusOutlined, SendOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import type { StatusKind } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { message } from '../../utils/message';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { RangePicker } = DatePicker;

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
}

interface Worker {
 id: string;
 name: string;
 is_active: boolean;
}

const STATUS_VALUES = ['draft', 'scheduled', 'in_progress', 'done', 'cancelled'];

const ServiceOrders: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [loading, setLoading] = useState(false);
 const [orders, setOrders] = useState<ServiceOrder[]>([]);
 const [workers, setWorkers] = useState<Worker[]>([]);
 const [search, setSearch] = useState('');
 const [filterStatus, setFilterStatus] = useState<string | undefined>();
 const [filterTechnician, setFilterTechnician] = useState<string | undefined>();
 const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
 const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [form] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('service_orders.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchOrders = async () => {
 setLoading(true);
 try {
 const [ordersRes, workersRes] = await Promise.all([
 api.get('/api/field-service/orders', { params: { limit: 500 } }),
 api.get('/api/field-service/workers', { params: { limit: 100 } }),
 ]);

 const ordersData = ordersRes.data.items || [];
 const workersData = workersRes.data.items || [];

 // Enrich orders with worker names
 const enriched = ordersData.map((o: Record<string, unknown>) => ({
 ...o,
 assigned_worker_name: workersData.find(
 (w: Record<string, unknown>) => w.id === o.assigned_worker_id
 )?.name,
 }));

 setOrders(enriched);
 setWorkers(workersData);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchOrders();
 }, []);

 const handleCreate = async (values: Record<string, unknown>) => {
 try {
 await api.post('/api/field-service/orders', values);
 message.success(t('field_service.order_created'));
 setShowCreateModal(false);
 form.resetFields();
 void fetchOrders();
 } catch {
 message.error(t('error'));
 }
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const openDuplicate = (record: ServiceOrder) => {
 const { id: _id, assigned_worker_name: _wn, scheduled_at, ...rest } = record;
 form.setFieldsValue({ ...rest, scheduled_at: scheduled_at ? dayjs(scheduled_at) : undefined });
 setShowCreateModal(true);
 };

 const handleBulkDispatch = () => {
 if (selectedRowKeys.length === 0) {
 message.warning(t('select_items'));
 return;
 }
 Modal.confirm({
 title: t('field_service.bulk_dispatch'),
 content: t('confirm'),
 onOk: async () => {
 try {
 // For simplicity, set status to 'scheduled' for selected orders
 await Promise.all(
 selectedRowKeys.map((id) =>
 api.patch(`/api/field-service/orders/${id}`, { status: 'scheduled' })
 )
 );
 message.success(t('success'));
 setSelectedRowKeys([]);
 void fetchOrders();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const filteredOrders = useMemo(() => {
 const base = orders.filter((o) => {
 if (filterStatus && o.status !== filterStatus) return false;
 if (filterTechnician && o.assigned_worker_id !== filterTechnician) return false;
 if (dateRange && o.scheduled_at) {
 const orderDate = dayjs(o.scheduled_at);
 if (orderDate.isBefore(dateRange[0]) || orderDate.isAfter(dateRange[1])) return false;
 }
 return true;
 });
 if (!search) return base;
 const q = search.toLowerCase();
 return base.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
 );
 }, [orders, filterStatus, filterTechnician, dateRange, search]);

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

 // Kit list tabs (All + each status) — wired to the same client-side status filter.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...STATUS_VALUES.map((s) => ({ key: s, label: t(`field_service.status_${s}`) })),
 ];

 const allColumns = [
 {
 title: t('field_service.order_number'),
 dataIndex: 'order_number',
 key: 'order_number',
 render: (num: string, record: ServiceOrder) => (
 <span
 onClick={() => navigate(`/field-service/orders/${record.id}`)}
 style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--ink-900)' }}
 >
 {num || record.id.slice(0, 8)}
 </span>
 ),
 },
 {
 title: t('field_service.customer_name'),
 dataIndex: 'customer_name',
 key: 'customer_name',
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(v)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 </div>
 ),
 },
 {
 title: t('field_service.address'),
 dataIndex: 'address',
 key: 'address',
 ellipsis: true,
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('field_service.scheduled_at'),
 dataIndex: 'scheduled_at',
 key: 'scheduled_at',
 render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
 },
 {
 title: t('field_service.technician'),
 dataIndex: 'assigned_worker_name',
 key: 'assigned_worker_name',
 render: (name: string) => name
 ? <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{name}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('field_service.status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => (
 <StatusTag status={statusKinds[status] || 'default'} label={t(`field_service.status_${status}`)} />
 ),
 },
 {
 title: t('field_service.priority'),
 dataIndex: 'priority',
 key: 'priority',
 render: (priority: string) => (
 <StatusTag status={priorityKinds[priority] || 'default'} label={t(`field_service.priority_${priority}`)} />
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, record: ServiceOrder) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => navigate(`/field-service/orders/${record.id}`) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => openDuplicate(record) },
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(
 () => allColumns.filter((c) => !hiddenCols.includes(c.key)) as ColumnsType<ServiceOrder>,
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [hiddenCols, t, workers, navigate],
 );
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'order_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('service_orders.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const activeFilterCount =
 (filterStatus ? 1 : 0) + (filterTechnician ? 1 : 0) + (dateRange ? 1 : 0);

 return (
 <>
 <PageHeader
 title={t('field_service.service_orders')}
 subtitle={t('field_service.title')}
 breadcrumb={[
 { label: t('dashboard'), to: '/' },
 { label: t('field_service.title') },
 { label: t('field_service.service_orders') },
 ]}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setShowCreateModal(true); }}>
 {t('field_service.new_order')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={filterStatus ?? 'all'}
 onTabChange={(k) => { setFilterStatus(k === 'all' ? undefined : k); setSelectedRowKeys([]); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={activeFilterCount}
 onClear={() => { setFilterStatus(undefined); setFilterTechnician(undefined); setDateRange(null); }}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-700)' }}>
 {t('field_service.filter_status')}
 </div>
 <Radio.Group
 value={filterStatus ?? 'all'}
 onChange={(e) => setFilterStatus(e.target.value === 'all' ? undefined : e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 {STATUS_VALUES.map((s) => (
 <Radio key={s} value={s}>{t(`field_service.status_${s}`)}</Radio>
 ))}
 </Radio.Group>
 </div>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-700)' }}>
 {t('field_service.filter_technician')}
 </div>
 <Select
 allowClear
 style={{ width: '100%' }}
 placeholder={t('field_service.filter_technician')}
 value={filterTechnician}
 onChange={(v) => setFilterTechnician(v || undefined)}
 options={workers.map((w) => ({ value: w.id, label: w.name }))}
 />
 </div>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-700)' }}>
 {t('field_service.scheduled_at')}
 </div>
 <RangePicker
 style={{ width: '100%' }}
 value={dateRange}
 onChange={(d) => setDateRange(d as [Dayjs, Dayjs] | null)}
 />
 </div>
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('field_service.status')}
 anyLabel={t('all', 'All')}
 value={filterStatus ?? ''}
 onChange={(v) => setFilterStatus(v || undefined)}
 options={STATUS_VALUES.map((s) => ({ value: s, label: t(`field_service.status_${s}`) }))}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <Space>
 <Button
 icon={<SendOutlined />}
 onClick={handleBulkDispatch}
 disabled={selectedRowKeys.length === 0}
 >
 {t('field_service.bulk_dispatch')}
 </Button>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('service-orders', filteredOrders, cols);
 }}
 onPrint={() => window.print()}
 onImport={() => message.info(t('coming_soon', 'Coming soon'))}
 onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
 onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
 />
 </Space>
 </div>
 </>
 }
 >
 <ResponsiveTableAdapter
 dataSource={filteredOrders}
 columns={columns}
 rowKey="id"
 loading={loading}
 rowSelection={{
 selectedRowKeys,
 onChange: setSelectedRowKeys,
 }}
 pagination={{ pageSize: 20, showSizeChanger: true }}
 />
 </KitListCard>

 <FormDialog
 title={t('field_service.new_order')}
 open={showCreateModal}
 onClose={() => {
 setShowCreateModal(false);
 form.resetFields();
 }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleCreate}>
 <Form.Item name="customer_name" label={t('field_service.customer_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="address" label={t('field_service.address')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="description" label={t('field_service.description')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="scheduled_at" label={t('field_service.scheduled_at')}>
 <DatePicker showTime style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="assigned_worker_id" label={t('field_service.technician')}>
 <Select
 placeholder={t('field_service.select_technician')}
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {workers.filter((w) => w.is_active).map((w) => (
 <Select.Option key={w.id} value={w.id}>
 {w.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="priority" label={t('field_service.priority')} initialValue="normal">
 <Select>
 {['low', 'normal', 'high', 'urgent'].map((p) => (
 <Select.Option key={p} value={p}>
 {t(`field_service.priority_${p}`)}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="latitude" label={t('field_service.latitude')}>
 <InputNumber style={{ width: '100%' }} step={0.000001} />
 </Form.Item>
 <Form.Item name="longitude" label={t('field_service.longitude')}>
 <InputNumber style={{ width: '100%' }} step={0.000001} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default ServiceOrders;
