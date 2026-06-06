import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, DatePicker, Row, Col, Radio } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
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
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { SelectWithQuickCreate } from '../../design-system/empty/SelectWithQuickCreate';

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
 description?: string;
}

const statusKinds: Record<string, StatusKind> = {
 idle: 'default',
 in_use: 'info',
 maintenance: 'warning',
 broken: 'error',
};

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const Equipment: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<Equipment[]>([]);
 const [categories, setCategories] = useState<Category[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('equipment.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const r = await api.get('/api/maintenance/equipment', { params: { limit: 500 } });
 let items = r.data.items || [];
 if (statusFilter) {
 items = items.filter((e: Equipment) => e.status === statusFilter);
 }
 if (categoryFilter) {
 items = items.filter((e: Equipment) => e.category_id === categoryFilter);
 }
 setData(items);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchCategories = async () => {
 try {
 const r = await api.get('/api/maintenance/categories', { params: { limit: 500 } });
 setCategories(r.data.items || []);
 } catch {
 // Ignore
 }
 };

 useEffect(() => {
 void fetchData();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [statusFilter, categoryFilter]);

 useEffect(() => {
 void fetchCategories();
 }, []);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ is_active: true, purchase_value: 0 });
 setModalOpen(true);
 };

 const openEdit = async (record: Equipment) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 purchase_date: record.purchase_date ? dayjs(record.purchase_date) : undefined,
 warranty_until: record.warranty_until ? dayjs(record.warranty_until) : undefined,
 });
 setModalOpen(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const openDuplicate = (record: Equipment) => {
 setEditingId(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({
 ...rest,
 name: `${record.name ?? ''} (${t('copy', 'copy')})`,
 purchase_date: record.purchase_date ? dayjs(record.purchase_date) : undefined,
 warranty_until: record.warranty_until ? dayjs(record.warranty_until) : undefined,
 });
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 purchase_date: values.purchase_date ? (values.purchase_date as Dayjs).format('YYYY-MM-DD') : undefined,
 warranty_until: values.warranty_until ? (values.warranty_until as Dayjs).format('YYYY-MM-DD') : undefined,
 };
 if (editingId) {
 await api.patch(`/api/maintenance/equipment/${editingId}`, payload);
 } else {
 await api.post('/api/maintenance/equipment', payload);
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
 await api.delete(`/api/maintenance/equipment/${id}`);
 message.success(t('success'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 // Kit list tabs (All / status segments) — wired to the same status filter param.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'idle', label: t('maintenance.status_idle') },
 { key: 'in_use', label: t('maintenance.status_in_use') },
 { key: 'maintenance', label: t('maintenance.status_maintenance') },
 { key: 'broken', label: t('maintenance.status_broken') },
 ];

 const statusOptions = [
 { value: 'idle', label: t('maintenance.status_idle') },
 { value: 'in_use', label: t('maintenance.status_in_use') },
 { value: 'maintenance', label: t('maintenance.status_maintenance') },
 { value: 'broken', label: t('maintenance.status_broken') },
 ];

 const allColumns = [
 {
 title: t('maintenance.equipment_name'), dataIndex: 'name', key: 'name', width: 220,
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
 title: t('maintenance.serial_no'), dataIndex: 'serial_no', key: 'serial_no', width: 140,
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('maintenance.category'),
 dataIndex: 'category_id',
 key: 'category_id',
 width: 140,
 render: (catId: string) => {
 const cat = categories.find((c) => c.id === catId);
 return cat
 ? (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{cat.name}</span>
 )
 : <span style={{ color: 'var(--ink-400)' }}>—</span>;
 },
 },
 {
 title: t('maintenance.location'), dataIndex: 'location', key: 'location', width: 140,
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
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
 title: t('maintenance.purchase_value'),
 dataIndex: 'purchase_value',
 key: 'purchase_value',
 width: 120,
 render: (val: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val?.toLocaleString()}</span>
 ),
 },
 {
 title: t('maintenance.warranty_until'),
 dataIndex: 'warranty_until',
 key: 'warranty_until',
 width: 120,
 render: (date: string) => (date
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)' }}>{dayjs(date).format('YYYY-MM-DD')}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const, fixed: 'right' as const,
 render: (_: unknown, record: Equipment) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => navigate(`/maintenance/equipment/${record.id}`) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => { void openEdit(record); } },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => openDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => { void handleDelete(record.id); } },
 ]}
 />
 ),
 },
 ];

 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t, categories]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('equipment.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <>
 <PageHeader
 title={t('maintenance.equipment')}
 subtitle={t('maintenance.equipment_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('maintenance.new_equipment')}
 </Button>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={statusFilter || 'all'}
 onTabChange={(k) => setStatusFilter(k === 'all' ? '' : k)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={(statusFilter ? 1 : 0) + (categoryFilter ? 1 : 0)}
 onClear={() => { setStatusFilter(''); setCategoryFilter(''); }}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-700)' }}>
 {t('maintenance.filter_status')}
 </div>
 <Radio.Group
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 {statusOptions.map((o) => (
 <Radio key={o.value} value={o.value}>{o.label}</Radio>
 ))}
 </Radio.Group>
 </div>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-700)' }}>
 {t('maintenance.filter_category')}
 </div>
 <Select
 value={categoryFilter || undefined}
 onChange={(v) => setCategoryFilter(v || '')}
 placeholder={t('maintenance.filter_category')}
 allowClear
 style={{ width: '100%' }}
 options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
 />
 </div>
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('maintenance.status')}
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
 downloadCsv('equipment', filteredData, cols);
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
 scroll={{ x: 1200 }}
 />
 </KitListCard>
 <FormDialog
 open={modalOpen}
 title={editingId ? t('maintenance.edit_equipment') : t('maintenance.new_equipment')}
 onClose={() => {
 setModalOpen(false);
 form.resetFields();
 setEditingId(null);
 }}
 onOk={() => form.submit()}
 confirmLoading={saving}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="name" label={t('maintenance.equipment_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="serial_no" label={t('maintenance.serial_no')}>
 <Input />
 </Form.Item>
 <Form.Item name="category_id" label={t('maintenance.category')}>
 <SelectWithQuickCreate
 entity="equipment_category"
 placeholder={t('maintenance.select_category')}
 />
 </Form.Item>
 <Form.Item name="location" label={t('maintenance.location')}>
 <Input />
 </Form.Item>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="purchase_date" label={t('maintenance.purchase_date')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="purchase_value" label={t('maintenance.purchase_value')}>
 <InputNumber style={{ width: '100%' }} min={0} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="warranty_until" label={t('maintenance.warranty_until')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="is_active" label={t('maintenance.is_active')} valuePropName="checked">
 <Select>
 <Select.Option value={true}>{t('active')}</Select.Option>
 <Select.Option value={false}>{t('inactive')}</Select.Option>
 </Select>
 </Form.Item>
 </Col>
 </Row>
 </Form>
 </FormDialog>
 </>
 );
};

export default Equipment;
