import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, DatePicker, Row, Col, Progress, Empty, Typography, Modal, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, ToolOutlined, DollarOutlined, FallOutlined, CheckCircleOutlined, ClockCircleOutlined, InboxOutlined, EyeOutlined, EditOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, KpiCard, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

const { Text } = Typography;

interface Asset {
 id: string;
 name: string;
 asset_number: string;
 description: string;
 purchase_date: string;
 purchase_price: number;
 current_value: number;
 salvage_value: number;
 useful_life_months: number;
 depreciation_method: string;
 status: string;
 depreciation_entries?: DepreciationEntry[];
}

interface DepreciationEntry {
 id: string;
 date: string;
 amount: number;
 accumulated: number;
 book_value: number;
}

const statusTone: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
 active: 'success',
 fully_depreciated: 'warning',
 disposed: 'danger',
 draft: 'neutral',
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

const Assets: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Asset[]>([]);
 const [loading, setLoading] = useState(false);
 const [statusFilter, setStatusFilter] = useState('');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('assets.hiddenCols') || '[]'); } catch { return []; }
 });
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [_accounts, setAccounts] = useState<{ id: string; name: string; code: string }[]>([]);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [depreciating, setDepreciating] = useState(false);
 const [disposeModal, setDisposeModal] = useState<string | null>(null);
 const [disposeForm] = Form.useForm();
 const [disposing, setDisposing] = useState(false);

 const fetchData = async () => {
 setLoading(true);
 try {
 const params: Record<string, string> = {};
 if (statusFilter) params.status = statusFilter;
 const r = await api.get('/api/assets', { params });
 setData(r.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { fetchData(); }, [statusFilter]);

 const openNew = async () => {
 const a = await api.get('/api/accounts', { params: { page_size: 200 } });
 setAccounts(a.data.items || a.data);
 setEditingId(null);
 form.resetFields();
 setModalOpen(true);
 };

 const openEdit = async (record: Asset) => {
 const a = await api.get('/api/accounts', { params: { page_size: 200 } });
 setAccounts(a.data.items || a.data);
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 purchase_date: record.purchase_date ? dayjs(record.purchase_date) : undefined,
 });
 setModalOpen(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const openDuplicate = async (record: Asset) => {
 const a = await api.get('/api/accounts', { params: { page_size: 200 } });
 setAccounts(a.data.items || a.data);
 setEditingId(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({
 ...rest,
 name: `${record.name ?? ''} (${t('copy', 'copy')})`,
 purchase_date: record.purchase_date ? dayjs(record.purchase_date) : undefined,
 });
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 purchase_date: (values.purchase_date as dayjs.Dayjs).format('YYYY-MM-DD'),
 };
 if (editingId) {
 await api.put(`/api/assets/${editingId}`, payload);
 } else {
 await api.post('/api/assets', payload);
 }
 message.success(t('success'));
 setModalOpen(false);
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 try {
 await api.delete(`/api/assets/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleDepreciateAll = async () => {
 setDepreciating(true);
 try {
 await api.post('/api/assets/depreciate-all');
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setDepreciating(false);
 }
 };

 const handleDispose = async (values: Record<string, unknown>) => {
 if (!disposeModal) return;
 setDisposing(true);
 try {
 await api.post(`/api/assets/${disposeModal}/dispose`, {
 disposal_amount: values.disposal_amount,
 disposal_date: (values.disposal_date as dayjs.Dayjs).format('YYYY-MM-DD'),
 });
 message.success(t('success'));
 setDisposeModal(null);
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setDisposing(false);
 }
 };

 const fmtIQD = (v: number) => `${new Intl.NumberFormat('en-US').format(v || 0)} IQD`;

 // Client-side search across all row fields (server has no search param).
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);

 // Kit list tabs (All / Active / Fully Depreciated / Disposed) — server-side filtered.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'active', label: t('active', 'Active') },
 { key: 'fully_depreciated', label: t('fully_depreciated', 'Fully Depreciated') },
 { key: 'disposed', label: t('disposed', 'Disposed') },
 ];

 const allColumns = [
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
 title: '#', dataIndex: 'asset_number', key: 'asset_number',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('date'), dataIndex: 'purchase_date', key: 'purchase_date',
 render: (d: string) => d
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{d.substring(0, 10)}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('purchasePrice'), dataIndex: 'purchase_price', key: 'purchase_price',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtIQD(v)}</span>
 ),
 },
 {
 title: t('currentValue'), dataIndex: 'current_value', key: 'current_value',
 render: (v: number, r: Asset) => {
 const pct = r.purchase_price > 0 ? Math.round(((r.purchase_price - v) / r.purchase_price) * 100) : 0;
 return (
 <Space orientation="vertical" style={{ minWidth: 120 }}>
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtIQD(v)}</span>
 <Progress percent={pct} strokeColor={pct >= 100 ? 'var(--warning-500)' : 'var(--accent-500)'} showInfo={false} className="depreciation-progress" />
 <Text type="secondary" style={{ fontSize: 11 }}>{pct}% {t('depreciation')}</Text>
 </Space>
 );
 },
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (s: string) => {
 const iconMap: Record<string, React.ReactNode> = {
 active: <CheckCircleOutlined />,
 fully_depreciated: <ClockCircleOutlined />,
 disposed: <DeleteOutlined />,
 };
 return <StatusTag tone={statusTone[s] || 'neutral'} icon={iconMap[s]}>{t(s)}</StatusTag>;
 },
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, r: Asset) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openEdit(r) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openEdit(r) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => openDuplicate(r) },
 ...(r.status === 'active' ? [
 { key: 'dispose', icon: <ToolOutlined />, label: t('dispose'), onClick: () => { disposeForm.resetFields(); setDisposeModal(r.id); } },
 ] : []),
 { type: 'divider' as const },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(r.id) },
 ]}
 />
 ),
 },
 ];
 const visibleColumns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('assets.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const depreciationColumns = [
 { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
 { title: t('amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => fmtIQD(v) },
 { title: t('depreciation'), dataIndex: 'accumulated', key: 'accumulated', render: (v: number) => fmtIQD(v) },
 { title: t('currentValue'), dataIndex: 'book_value', key: 'book_value', render: (v: number) => fmtIQD(v) },
 ];

 return (
 <div>
 <PageHeader
 title={t('assets', 'Fixed Assets')}
 subtitle={t('assets_subtitle', 'Manage fixed assets and depreciation')}
 sectionId="accounting.assets"
 extra={
 <Space>
 <Button icon={<ToolOutlined />} loading={depreciating} onClick={handleDepreciateAll}>
 {t('depreciateAll')}
 </Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('create')}
 </Button>
 </Space>
 }
 />
 {/* Stats Bar */}
 <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
 <Col xs={24} sm={8}>
 <KpiCard
 title={t('purchasePrice')}
 value={data.reduce((sum, a) => sum + (a.purchase_price || 0), 0)}
 suffix=" IQD"
 icon={<DollarOutlined />}
 tone="primary"
 />
 </Col>
 <Col xs={24} sm={8}>
 <KpiCard
 title={t('currentValue')}
 value={data.reduce((sum, a) => sum + (a.current_value || 0), 0)}
 suffix=" IQD"
 icon={<FallOutlined />}
 tone="warning"
 />
 </Col>
 <Col xs={24} sm={8}>
 <KpiCard
 title={t('fully_depreciated')}
 value={data.filter(a => a.status === 'fully_depreciated').length}
 suffix={`/ ${data.length}`}
 icon={<CheckCircleOutlined />}
 tone="success"
 />
 </Col>
 </Row>

 <KitListCard
 tabs={tabs}
 activeTab={statusFilter || 'all'}
 onTabChange={(k) => setStatusFilter(k === 'all' ? '' : k)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 {/* Group Filters + Status in a single flex unit so they ALWAYS wrap
 together to the same line — never one stranded on a row by itself. */}
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
 <Radio value="active">{t('active', 'Active')}</Radio>
 <Radio value="fully_depreciated">{t('fully_depreciated', 'Fully Depreciated')}</Radio>
 <Radio value="disposed">{t('disposed', 'Disposed')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => setStatusFilter(v || '')}
 options={[
 { value: 'active', label: t('active', 'Active') },
 { value: 'fully_depreciated', label: t('fully_depreciated', 'Fully Depreciated') },
 { value: 'disposed', label: t('disposed', 'Disposed') },
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
 downloadCsv('assets', data, cols);
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
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 locale={{
 emptyText: (
 <Empty
 image={<InboxOutlined style={{ fontSize: 48, color: 'var(--ink-400)' }} />}
 description={
 <Space orientation="vertical">
 <Text strong>{t('no_assets_yet')}</Text>
 <Text type="secondary">{t('no_assets_hint')}</Text>
 </Space>
 }
 >
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_asset')}</Button>
 </Empty>
 ),
 }}
 expandable={{
 expandedRowRender: (record: Asset) => (
 <ResponsiveTableAdapter
 dataSource={record.depreciation_entries || []}
 columns={depreciationColumns}
 rowKey="id"
 pagination={false}
 />
 ),
 }}
 />
 </KitListCard>

 <FormDialog
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 title={editingId ? t('edit') : t('create')} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Space wrap>
 <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]} style={{ width: 280 }}>
 <Input placeholder={t('placeholder_name')} />
 </Form.Item>
 <Form.Item label={t('asset_number')} name="asset_number" style={{ width: 180 }}>
 <Input placeholder={t('placeholder_reference')} />
 </Form.Item>
 </Space>
 <Form.Item label={t('description')} name="description">
 <Input.TextArea rows={2} placeholder={t('placeholder_description')} />
 </Form.Item>
 <Space wrap>
 <Form.Item label={t('account')} name="asset_account_id" rules={[{ required: true, message: t('required_account') }]} style={{ width: 220 }}>
 <SelectWithQuickCreate entity="account" showSearch placeholder={t('placeholder_select')} allowClear />
 </Form.Item>
 <Form.Item label={t('depreciation') + ' ' + t('account')} name="depreciation_account_id" rules={[{ required: true, message: t('required_account') }]} style={{ width: 220 }}>
 <SelectWithQuickCreate entity="account" showSearch placeholder={t('placeholder_select')} allowClear />
 </Form.Item>
 <Form.Item label={t('accumulated_depreciation_account')} name="accumulated_depreciation_account_id" style={{ width: 220 }}>
 <SelectWithQuickCreate entity="account" showSearch placeholder={t('placeholder_select')} allowClear />
 </Form.Item>
 </Space>
 <Space wrap>
 <Form.Item label={t('date')} name="purchase_date" rules={[{ required: true, message: t('required_date') }]}>
 <DatePicker placeholder={t('placeholder_date')} />
 </Form.Item>
 <Form.Item label={t('purchasePrice')} name="purchase_price" rules={[{ required: true, message: t('required_price') }]}>
 <InputNumber min={0} style={{ width: 180 }} placeholder={t('placeholder_amount')} />
 </Form.Item>
 <Form.Item label={t('salvageValue')} name="salvage_value">
 <InputNumber min={0} style={{ width: 140 }} placeholder={t('placeholder_amount')} />
 </Form.Item>
 </Space>
 <Space wrap>
 <Form.Item label={t('usefulLife')} name="useful_life_months" rules={[{ required: true, message: t('required_field') }]}>
 <InputNumber min={1} style={{ width: 140 }} addonAfter={t('monthly')} />
 </Form.Item>
 <Form.Item label={t('depreciation_method')} name="depreciation_method" initialValue="straight_line">
 <Select style={{ width: 200 }} placeholder={t('placeholder_select')} options={[
 { label: 'Straight Line', value: 'straight_line' },
 { label: 'Declining Balance', value: 'declining_balance' },
 ]} />
 </Form.Item>
 </Space>
 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button>
 <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
 </Space>
 </Form>
 </FormDialog>

 <FormDialog
 open={!!disposeModal}
 onClose={() => setDisposeModal(null)}
 title={t('dispose')} hideFooter
 >
 <Form form={disposeForm} layout="vertical" onFinish={handleDispose} initialValues={{ disposal_date: dayjs() }}>
 <Form.Item label={t('amount')} name="disposal_amount" rules={[{ required: true, message: t('required_amount') }]}>
 <InputNumber min={0} style={{ width: '100%' }} placeholder={t('placeholder_amount')} />
 </Form.Item>
 <Form.Item label={t('date')} name="disposal_date" rules={[{ required: true, message: t('required_date') }]}>
 <DatePicker placeholder={t('placeholder_date')} />
 </Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={disposing}>{t('confirm')}</Button>
 <Button onClick={() => setDisposeModal(null)}>{t('cancel')}</Button>
 </Space>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Assets;
