import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, DatePicker, Row, Col, Empty, Radio } from 'antd';
import { PlusOutlined, EyeOutlined, FallOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
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

interface Asset {
 id: string;
 asset_code: string;
 name: string;
 category_id?: string;
 acquisition_date: string;
 acquisition_cost: number;
 salvage_value: number;
 useful_life_months: number;
 depreciation_method: string;
 status: string;
 book_value: number;
 accumulated_depreciation: number;
 branch_id?: string;
 location?: string;
}

interface AssetCategory {
 id: string;
 name: string;
 default_useful_life_months: number;
 default_method: string;
 default_salvage_pct: number;
 asset_account_id: string;
 accumulated_depreciation_account_id: string;
 depreciation_expense_account_id: string;
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

const FixedAssets: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<Asset[]>([]);
 const [loading, setLoading] = useState(false);
 const [statusFilter, setStatusFilter] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('');
 const [search, setSearch] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [accounts, setAccounts] = useState<{ id: string; name: string; code: string }[]>([]);
 const [categories, setCategories] = useState<AssetCategory[]>([]);
 const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('assets.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const params: Record<string, string> = {};
 if (statusFilter) params.status = statusFilter;
 if (categoryFilter) params.category_id = categoryFilter;
 const r = await api.get('/api/fixed-assets/assets', { params });
 setData(r.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchAccounts = async () => {
 try {
 const r = await api.get('/api/accounts', { params: { page_size: 500 } });
 setAccounts(r.data.items || r.data || []);
 } catch {
 // Ignore
 }
 };

 const fetchCategories = async () => {
 try {
 const r = await api.get('/api/fixed-assets/asset-categories');
 setCategories(r.data.items || []);
 } catch {
 // Ignore
 }
 };

 const fetchBranches = async () => {
 try {
 const r = await api.get('/api/branches');
 setBranches(r.data.items || r.data || []);
 } catch {
 // Ignore
 }
 };

 useEffect(() => {
 fetchData();
 }, [statusFilter, categoryFilter]);

 useEffect(() => {
 fetchAccounts();
 fetchCategories();
 fetchBranches();
 }, []);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({
 status: 'active',
 depreciation_method: 'straight_line',
 salvage_value: 0,
 useful_life_months: 60,
 });
 setModalOpen(true);
 };

 const openEdit = async (record: Asset) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 acquisition_date: record.acquisition_date ? dayjs(record.acquisition_date) : undefined,
 });
 setModalOpen(true);
 };

 const handleCategoryChange = (categoryId: string) => {
 const cat = categories.find((c) => c.id === categoryId);
 if (cat) {
 form.setFieldsValue({
 useful_life_months: cat.default_useful_life_months,
 depreciation_method: cat.default_method,
 salvage_value: form.getFieldValue('acquisition_cost') * (cat.default_salvage_pct / 100) || 0,
 asset_account_id: cat.asset_account_id,
 accumulated_depreciation_account_id: cat.accumulated_depreciation_account_id,
 depreciation_expense_account_id: cat.depreciation_expense_account_id,
 });
 }
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 acquisition_date: (values.acquisition_date as Dayjs).format('YYYY-MM-DD'),
 };
 if (editingId) {
 await api.put(`/api/fixed-assets/assets/${editingId}`, payload);
 } else {
 await api.post('/api/fixed-assets/assets', payload);
 }
 message.success(t('success'));
 setModalOpen(false);
 fetchData();
 } catch (err: unknown) {
 const errorDetail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
 message.error(errorDetail || t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/fixed-assets/assets/${id}`);
 message.success(t('success'));
 fetchData();
 } catch (err: unknown) {
 const errorDetail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
 message.error(errorDetail || t('error'));
 }
 };

 // Status segments (real `status` server param) — drive both tabs and the Status dropdown.
 const statusOptions = [
 { value: 'active', label: t('assets.status_active') },
 { value: 'fully_depreciated', label: t('assets.status_fully_depreciated') },
 { value: 'disposed', label: t('assets.status_disposed') },
 ];

 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...statusOptions.map((o) => ({ key: o.value, label: o.label })),
 ];

 const muteChipStyle: React.CSSProperties = {
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 };
 const moneyStyle: React.CSSProperties = {
 color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600,
 };

 const allColumns = [
 {
 title: t('assets.asset_code'), dataIndex: 'asset_code', key: 'code', width: 120,
 render: (v: string) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 ),
 },
 {
 title: t('name'), dataIndex: 'name', key: 'name',
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
 title: t('assets.category'),
 dataIndex: 'category_id',
 key: 'category',
 render: (catId: string) => {
 const cat = categories.find((c) => c.id === catId);
 return cat?.name
 ? <span style={muteChipStyle}>{cat.name}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>;
 },
 },
 {
 title: t('assets.acquisition_cost'), dataIndex: 'acquisition_cost', key: 'cost',
 render: (v: number) => <span style={moneyStyle}>{v.toLocaleString()}</span>,
 },
 {
 title: t('assets.book_value'), dataIndex: 'book_value', key: 'book',
 render: (v: number) => <span style={moneyStyle}>{v.toLocaleString()}</span>,
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (s: string) => <StatusTag status={s} label={t(`assets.status_${s}`)} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, record: Asset) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => navigate(`/assets/${record.id}`) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openEdit(record) },
 { key: 'depreciate', icon: <FallOutlined />, label: t('assets.run_depreciation'), disabled: record.status !== 'active', onClick: () => navigate(`/assets/${record.id}`) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
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
 try { localStorage.setItem('assets.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const activeFilterCount = (statusFilter ? 1 : 0) + (categoryFilter ? 1 : 0);

 return (
 <>
 <PageHeader
 title={t('assets.fixed_assets')}
 extra={
 <Space>
 <Button onClick={() => navigate('/assets/categories')}>{t('assets.categories')}</Button>
 <Button onClick={() => navigate('/assets/depreciation-run')}>{t('assets.run_depreciation')}</Button>
 <Button onClick={() => navigate('/assets/reports')}>{t('reports')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new')}</Button>
 </Space>
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
 activeCount={activeFilterCount}
 onClear={() => { setStatusFilter(''); setCategoryFilter(''); }}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-700)' }}>{t('status')}</div>
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
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-700)' }}>{t('assets.category')}</div>
 <Select
 value={categoryFilter || undefined}
 onChange={(v) => setCategoryFilter(v ?? '')}
 allowClear
 placeholder={t('all', 'All')}
 style={{ width: '100%' }}
 options={categories.map((c) => ({ value: c.id, label: c.name }))}
 />
 </div>
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
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
 downloadCsv('fixed-assets', filteredData, cols);
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
 <ResponsiveTableAdapter columns={columns} dataSource={filteredData} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description={t('empty_assets')} /> }} />
 </KitListCard>
 <FormDialog
 title={editingId ? t('edit') : t('new')}
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 onOk={() => form.submit()}
 confirmLoading={saving}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="asset_code" label={t('assets.asset_code')}>
 <Input placeholder={t('assets.auto_generated')} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="category_id" label={t('assets.category')}>
 <Select onChange={handleCategoryChange} allowClear>
 {categories.map((c) => (
 <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="acquisition_date" label={t('assets.acquisition_date')} rules={[{ required: true }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="acquisition_cost" label={t('assets.acquisition_cost')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="salvage_value" label={t('assets.salvage_value')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="useful_life_months" label={t('assets.useful_life_months')} rules={[{ required: true }]}>
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="depreciation_method" label={t('assets.depreciation_method')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="straight_line">{t('assets.straight_line')}</Select.Option>
 <Select.Option value="declining_balance">{t('assets.declining_balance')}</Select.Option>
 </Select>
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={8}>
 <Form.Item name="asset_account_id" label={t('assets.asset_account')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children" filterOption={(input: string, option?: { children?: string }) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
 {accounts.map((a) => (
 <Select.Option key={a.id} value={a.id}>{`${a.code} - ${a.name}`}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 <Col span={8}>
 <Form.Item name="accumulated_depreciation_account_id" label={t('assets.accum_depreciation_account')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children" filterOption={(input: string, option?: { children?: string }) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
 {accounts.map((a) => (
 <Select.Option key={a.id} value={a.id}>{`${a.code} - ${a.name}`}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 <Col span={8}>
 <Form.Item name="depreciation_expense_account_id" label={t('assets.depreciation_expense_account')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children" filterOption={(input: string, option?: { children?: string }) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
 {accounts.map((a) => (
 <Select.Option key={a.id} value={a.id}>{`${a.code} - ${a.name}`}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="branch_id" label={t('branch')}>
 <Select allowClear>
 {branches.map((b) => (
 <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="location" label={t('assets.location')}>
 <Input />
 </Form.Item>
 </Col>
 </Row>
 <Form.Item name="notes" label={t('notes')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default FixedAssets;
