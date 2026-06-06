import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Space, Input, Form, Select, InputNumber, Radio } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, EyeOutlined, EditOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface ECN {
 id: string;
 title: string;
 product_id: string;
 type: string;
 reason?: string;
 proposed_changes?: string;
 assigned_to?: string;
 priority: string;
 status: string;
 affected_boms_count?: number;
 created_at: string;
}

interface Product {
 id: string;
 name: string;
}

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const PLMEngineeringChanges: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<ECN[]>([]);
 const [products, setProducts] = useState<Product[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [drawer, setDrawer] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('plm_ecn.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/plm/ecos', { params: { limit: 100 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchProducts = async () => {
 try {
 const res = await api.get('/api/items', { params: { limit: 200 } });
 setProducts(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 useEffect(() => {
 void fetchData();
 void fetchProducts();
 }, []);

 const handleSubmit = async (values: any) => {
 try {
 if (editingId) {
 await api.patch(`/api/plm/ecos/${editingId}`, values);
 message.success(t('plm.ecn_updated'));
 } else {
 await api.post('/api/plm/ecos', values);
 message.success(t('plm.ecn_created'));
 }
 setDrawer(false);
 form.resetFields();
 setEditingId(null);
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (ecn: ECN) => {
 setEditingId(ecn.id);
 form.setFieldsValue(ecn);
 setDrawer(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (ecn: ECN) => {
 setEditingId(null);
 const { id: _id, ...rest } = ecn;
 form.setFieldsValue({ ...rest, title: `${ecn.title ?? ''} (${t('copy', 'copy')})` });
 setDrawer(true);
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/plm/ecos/${id}`);
 message.success(t('plm.ecn_deleted'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const getStatusTag = (status: string) => {
 const map: Record<string, 'info' | 'warning' | 'success' | 'error'> = {
 draft: 'info',
 review: 'warning',
 approved: 'success',
 implemented: 'success',
 rejected: 'error',
 };
 return <StatusTag status={map[status] || 'info'} />;
 };

 const getPriorityTag = (priority: string) => {
 const kinds: Record<string, StatusKind> = {
 low: 'default',
 medium: 'info',
 high: 'warning',
 urgent: 'error',
 };
 return <StatusTag status={kinds[priority] || 'default'} label={t(`plm.priority_${priority}`)} />;
 };

 const filteredData = data.filter((e) => {
 const matchSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase());
 const matchStatus = !statusFilter || e.status === statusFilter;
 return matchSearch && matchStatus;
 });

 // Kit list tabs (All / status segments) — wired to the same statusFilter param.
 const statusOptions = [
 { value: 'draft', label: t('plm.status_draft') },
 { value: 'review', label: t('plm.status_review') },
 { value: 'approved', label: t('plm.status_approved') },
 { value: 'implemented', label: t('plm.status_implemented') },
 { value: 'rejected', label: t('plm.status_rejected') },
 ];
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...statusOptions.map((o) => ({ key: o.value, label: o.label })),
 ];

 const allColumns: any[] = [
 {
 title: t('plm.ecn_number'),
 dataIndex: 'id',
 key: 'id',
 width: 150,
 render: (id: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>
 {`ECN-${id.slice(0, 8)}`}
 </span>
 ),
 },
 {
 title: t('plm.title'),
 dataIndex: 'title',
 key: 'title',
 width: 250,
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
 title: t('plm.product'),
 dataIndex: 'product_id',
 key: 'product_id',
 width: 180,
 render: (pid: string) => (
 <span style={{ color: 'var(--ink-700)' }}>{products.find((p) => p.id === pid)?.name || pid}</span>
 ),
 },
 {
 title: t('plm.change_type'),
 dataIndex: 'type',
 key: 'type',
 width: 120,
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(`plm.type_${v}`)}</span>
 ),
 },
 {
 title: t('plm.priority'),
 dataIndex: 'priority',
 key: 'priority',
 width: 100,
 render: getPriorityTag,
 },
 {
 title: t('plm.status'),
 dataIndex: 'status',
 key: 'status',
 width: 120,
 render: getStatusTag,
 },
 {
 title: t('plm.affected_boms'),
 dataIndex: 'affected_boms_count',
 key: 'affected_boms_count',
 width: 120,
 align: 'center' as const,
 render: (v?: number) => <span style={{ color: 'var(--ink-700)' }}>{v || 0}</span>,
 },
 {
 title: t('plm.assigned_to'),
 dataIndex: 'assigned_to',
 key: 'assigned_to',
 width: 120,
 render: (v?: string) => v
 ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, rec: ECN) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => handleEdit(rec) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(rec) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(rec) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(rec.id) },
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t, products]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' && c.title ? c.title : c.key,
 pinned: c.key === 'title' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('plm_ecn.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <>
 <PageHeader
 title={t('plm.ecn_title')}
 subtitle={t('plm.ecn_subtitle')}
 breadcrumb={[{ label: t('plm.title') }, { label: t('plm.ecn_title') }]}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditingId(null);
 form.resetFields();
 setDrawer(true);
 }}
 >
 {t('plm.create_ecn')}
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
 activeCount={statusFilter ? 1 : 0}
 onClear={() => setStatusFilter('')}
 >
 <Radio.Group
 value={statusFilter || 'all'}
 onChange={(e) => setStatusFilter(e.target.value === 'all' ? '' : e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 {statusOptions.map((o) => (
 <Radio key={o.value} value={o.value}>{o.label}</Radio>
 ))}
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('plm.status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => setStatusFilter(v || '')}
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
 downloadCsv('plm_ecn', filteredData, cols);
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
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 scroll={{ x: 1400 }}
 />
 </KitListCard>

 <FormDialog
 title={editingId ? t('plm.edit_ecn') : t('plm.create_ecn')}
 open={drawer}
 onClose={() => {
 setDrawer(false);
 setEditingId(null);
 form.resetFields();
 }}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item name="title" label={t('plm.title')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="product_id" label={t('plm.product')} rules={[{ required: true }]}>
 <Select
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {products.map((p) => (
 <Select.Option key={p.id} value={p.id}>
 {p.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="type" label={t('plm.change_type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="change">{t('plm.type_change')}</Select.Option>
 <Select.Option value="new_part">{t('plm.type_new_part')}</Select.Option>
 <Select.Option value="obsolete">{t('plm.type_obsolete')}</Select.Option>
 <Select.Option value="deviation">{t('plm.type_deviation')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="priority" label={t('plm.priority')} initialValue="medium">
 <Select>
 <Select.Option value="low">{t('plm.priority_low')}</Select.Option>
 <Select.Option value="medium">{t('plm.priority_medium')}</Select.Option>
 <Select.Option value="high">{t('plm.priority_high')}</Select.Option>
 <Select.Option value="urgent">{t('plm.priority_urgent')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="status" label={t('plm.status')} initialValue="draft">
 <Select>
 <Select.Option value="draft">{t('plm.status_draft')}</Select.Option>
 <Select.Option value="review">{t('plm.status_review')}</Select.Option>
 <Select.Option value="approved">{t('plm.status_approved')}</Select.Option>
 <Select.Option value="implemented">{t('plm.status_implemented')}</Select.Option>
 <Select.Option value="rejected">{t('plm.status_rejected')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="reason" label={t('plm.reason')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="proposed_changes" label={t('plm.proposed_changes')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="assigned_to" label={t('plm.assigned_to')}>
 <Input />
 </Form.Item>
 <Form.Item name="affected_boms_count" label={t('plm.affected_boms')} initialValue={0}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item>
 <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
 <Button onClick={() => setDrawer(false)}>{t('cancel')}</Button>
 <Button type="primary" htmlType="submit">
 {t('save')}
 </Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default PLMEngineeringChanges;
