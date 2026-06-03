import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, Select, Switch, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface QCPlan {
 id: string;
 name: string;
 operation: string;
 test_type: string;
 product_id?: string;
 instructions?: string;
 is_active: boolean;
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

/** Muted chip for the kit's type/category cells (tokens only). */
const mutedChip = (label: React.ReactNode): React.ReactNode => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{label}</span>
);

const QCPlans: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<QCPlan[]>([]);
 const [loading, setLoading] = useState(false);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 // Presentation-only client-side status segment ('all' | 'active' | 'inactive').
 const [tab, setTab] = useState<'all' | 'active' | 'inactive'>('all');
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('qc_plans.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/quality/points', { params: { limit: 200 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, []);

 const handleSave = async (values: any) => {
 try {
 if (editingId) {
 await api.patch(`/api/quality/points/${editingId}`, values);
 message.success(t('success'));
 } else {
 await api.post('/api/quality/points', values);
 message.success(t('quality.plan_created'));
 }
 setDrawerOpen(false);
 form.resetFields();
 setEditingId(null);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (record: QCPlan) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setDrawerOpen(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: QCPlan) => {
 setEditingId(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({ ...rest, name: `${record.name ?? ''} (${t('copy', 'copy')})` });
 setDrawerOpen(true);
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/quality/points/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 // Kit list tabs (All / Active / Inactive) — client-side filtered on is_active.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'active', label: t('active', 'Active') },
 { key: 'inactive', label: t('inactive', 'Inactive') },
 ];

 // Client-side status + search filter (no server params exist on this endpoint).
 const filteredData = useMemo(() => {
 let rows = data;
 if (tab === 'active') rows = rows.filter((d) => d.is_active);
 else if (tab === 'inactive') rows = rows.filter((d) => !d.is_active);
 if (search) {
 const q = search.toLowerCase();
 rows = rows.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }
 return rows;
 }, [data, tab, search]);

 const allColumns = [
 {
 title: t('quality.plan_name'),
 dataIndex: 'name',
 key: 'name',
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
 title: t('quality.operation'),
 dataIndex: 'operation',
 key: 'operation',
 render: (v: string) => mutedChip(t(`quality.operation_${v}`)),
 },
 {
 title: t('quality.test_type'),
 dataIndex: 'test_type',
 key: 'test_type',
 render: (v: string) => mutedChip(t(`quality.test_${v}`)),
 },
 {
 title: t('quality.criteria'),
 dataIndex: 'instructions',
 key: 'instructions',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (v: boolean) => <StatusTag status={v ? 'success' : 'default'} label={v ? t('active') : t('inactive')} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: QCPlan) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => handleEdit(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('qc_plans.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('quality.qc_plans')}
 subtitle={t('quality.qc_plans_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditingId(null);
 form.resetFields();
 setDrawerOpen(true);
 }}
 >
 {t('quality.new_plan')}
 </Button>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as typeof tab); setPage(1); }}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPage(1); }}
 placeholder={t('search')}
 />
 {/* Group Filters + Status in one flex unit so they always wrap together. */}
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => { setTab('all'); setPage(1); }}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => { setTab(e.target.value); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="active">{t('active', 'Active')}</Radio>
 <Radio value="inactive">{t('inactive', 'Inactive')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as typeof tab); setPage(1); }}
 options={[
 { value: 'active', label: t('active', 'Active') },
 { value: 'inactive', label: t('inactive', 'Inactive') },
 ]}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('qc_plans', filteredData, cols);
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
 dataSource={filteredData}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ current: page, pageSize: 20, onChange: setPage }}
 />
 </KitListCard>
 <FormDialog
 title={editingId ? t('quality.edit_plan') : t('quality.new_plan')}
 open={drawerOpen}
 onClose={() => {
 setDrawerOpen(false);
 form.resetFields();
 setEditingId(null);
 }}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item
 name="name"
 label={t('quality.plan_name')}
 rules={[{ required: true, message: t('required') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item
 name="operation"
 label={t('quality.operation')}
 initialValue="manufacturing"
 rules={[{ required: true }]}
 >
 <Select>
 <Select.Option value="manufacturing">{t('quality.operation_manufacturing')}</Select.Option>
 <Select.Option value="receiving">{t('quality.operation_receiving')}</Select.Option>
 <Select.Option value="delivery">{t('quality.operation_delivery')}</Select.Option>
 <Select.Option value="stock_move">{t('quality.operation_stock_move')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item
 name="test_type"
 label={t('quality.test_type')}
 initialValue="pass_fail"
 rules={[{ required: true }]}
 >
 <Select>
 <Select.Option value="pass_fail">{t('quality.test_pass_fail')}</Select.Option>
 <Select.Option value="measure">{t('quality.test_measure')}</Select.Option>
 <Select.Option value="instructions">{t('quality.test_instructions')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="product_id" label={t('quality.product')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="instructions" label={t('quality.criteria')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="is_active" label={t('active')} valuePropName="checked" initialValue={true}>
 <Switch />
 </Form.Item>
 <Form.Item>
 <Space>
 <Button type="primary" htmlType="submit">
 {t('save')}
 </Button>
 <Button onClick={() => setDrawerOpen(false)}>{t('cancel')}</Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default QCPlans;
