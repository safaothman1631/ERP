import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, DatePicker, Row, Col, Radio } from 'antd';
import {
  PlusOutlined, DeleteOutlined, PlayCircleOutlined, CheckCircleOutlined, StopOutlined,
  EyeOutlined, EditOutlined, CopyOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import type { StatusKind } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions, { type KitRowEntry } from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
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
 const [search, setSearch] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('maintenance_requests.hiddenCols') || '[]'); } catch { return []; }
 });

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

 const openEdit = (record: MaintRequest) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 scheduled_at: record.scheduled_at ? dayjs(record.scheduled_at) : undefined,
 });
 setModalOpen(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const openDuplicate = (record: MaintRequest) => {
 setEditingId(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({
 ...rest,
 scheduled_at: record.scheduled_at ? dayjs(record.scheduled_at) : undefined,
 });
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

 const allColumns = [
 {
 title: t('maintenance.equipment'),
 dataIndex: 'equipment_id',
 key: 'equipment_id',
 width: 180,
 render: (eqId: string) => {
 const eq = equipment.find((e) => e.id === eqId);
 const name = eq ? eq.name : '—';
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{String(name || '?').trim().slice(0, 2).toUpperCase()}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{name}</span>
 </div>
 );
 },
 },
 {
 title: t('maintenance.title'),
 dataIndex: 'title',
 key: 'title',
 width: 200,
 render: (v: string) => <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>,
 },
 {
 title: t('maintenance.type'),
 dataIndex: 'type',
 key: 'type',
 width: 120,
 render: (type: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(`maintenance.type_${type}`, type)}</span>
 ),
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
 {
 title: t('maintenance.requested_by'),
 dataIndex: 'requested_by',
 key: 'requested_by',
 width: 130,
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('maintenance.assigned_to'),
 dataIndex: 'assigned_to',
 key: 'assigned_to',
 width: 130,
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('maintenance.scheduled_at'),
 dataIndex: 'scheduled_at',
 key: 'scheduled_at',
 width: 160,
 render: (date: string) => date
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{dayjs(date).format('YYYY-MM-DD HH:mm')}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 fixed: 'right' as const,
 render: (_: unknown, record: MaintRequest) => {
 const actions: KitRowEntry[] = [
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openEdit(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => openDuplicate(record) },
 ];
 const transitions: KitRowEntry[] = [];
 if (record.status === 'new') {
 transitions.push({ key: 'start', icon: <PlayCircleOutlined />, label: t('maintenance.start'), onClick: () => handleStart(record.id) });
 }
 if (record.status === 'in_progress') {
 transitions.push({ key: 'complete', icon: <CheckCircleOutlined />, label: t('maintenance.complete'), onClick: () => handleComplete(record.id) });
 }
 if (record.status !== 'done' && record.status !== 'cancelled') {
 transitions.push({ key: 'cancel_req', icon: <StopOutlined />, label: t('cancel'), onClick: () => handleCancel(record.id) });
 }
 if (transitions.length) {
 actions.push({ type: 'divider' }, ...transitions);
 }
 actions.push(
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 );
 return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
 },
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t, equipment]);
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'equipment_id' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('maintenance_requests.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const statusOptions = [
 { value: 'new', label: t('maintenance.status_new') },
 { value: 'in_progress', label: t('maintenance.status_in_progress') },
 { value: 'done', label: t('maintenance.status_done') },
 { value: 'cancelled', label: t('maintenance.status_cancelled') },
 ];

 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...statusOptions.map((o) => ({ key: o.value, label: o.label })),
 ];

 const filtersActiveCount = (typeFilter ? 1 : 0) + (priorityFilter ? 1 : 0);

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
 <KitListCard
 tabs={tabs}
 activeTab={statusFilter || 'all'}
 onTabChange={(k) => setStatusFilter(k === 'all' ? '' : k)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={filtersActiveCount}
 onClear={() => { setTypeFilter(''); setPriorityFilter(''); }}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-700)' }}>
 {t('maintenance.filter_type')}
 </div>
 <Radio.Group
 value={typeFilter}
 onChange={(e) => setTypeFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 <Radio value="corrective">{t('maintenance.type_corrective')}</Radio>
 <Radio value="preventive">{t('maintenance.type_preventive')}</Radio>
 <Radio value="inspection">{t('maintenance.type_inspection')}</Radio>
 </Radio.Group>
 </div>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-700)' }}>
 {t('maintenance.filter_priority')}
 </div>
 <Radio.Group
 value={priorityFilter}
 onChange={(e) => setPriorityFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 <Radio value="low">{t('maintenance.priority_low')}</Radio>
 <Radio value="medium">{t('maintenance.priority_medium')}</Radio>
 <Radio value="high">{t('maintenance.priority_high')}</Radio>
 <Radio value="urgent">{t('maintenance.priority_urgent')}</Radio>
 </Radio.Group>
 </div>
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('maintenance.filter_status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => setStatusFilter(v)}
 options={statusOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('maintenance_requests', data, cols);
 }}
 onPrint={() => window.print()}
 onImport={() => message.info(t('coming_soon', 'Coming soon'))}
 onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
 onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
 />
 </div>
 </>
 }
 >
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={filteredData}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 50, showSizeChanger: true }}
 scroll={{ x: 1500 }}
 />
 </KitListCard>
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
