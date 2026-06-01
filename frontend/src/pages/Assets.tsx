import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, Button, Tag, Form, Input, InputNumber, Select, Space, DatePicker, Popconfirm, Row, Col, Card, Statistic, Progress, Empty, Typography } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, ToolOutlined, DollarOutlined, FallOutlined, CheckCircleOutlined, ClockCircleOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { space as spaceTk } from '../theme/tokens';
import { useAuthStore } from '../store';
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

const statusColors: Record<string, string> = {
 active: 'green',
 fully_depreciated: 'orange',
 disposed: 'red',
 draft: 'default',
};

const Assets: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Asset[]>([]);
 const [loading, setLoading] = useState(false);
 const [statusFilter, setStatusFilter] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('assets.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');
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
 try {
 await api.delete(`/api/assets/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
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

 const columns = [
 { title: t('name'), dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
 { title: '#', dataIndex: 'asset_number', key: 'asset_number' },
 { title: t('date'), dataIndex: 'purchase_date', key: 'purchase_date', render: (d: string) => d?.substring(0, 10) },
 { title: t('purchasePrice'), dataIndex: 'purchase_price', key: 'purchase_price', render: (v: number) => <Text strong>{fmtIQD(v)}</Text> },
 {
 title: t('currentValue'), dataIndex: 'current_value', key: 'current_value',
 render: (v: number, r: Asset) => {
 const pct = r.purchase_price > 0 ? Math.round(((r.purchase_price - v) / r.purchase_price) * 100) : 0;
 return (
 <Space orientation="vertical" style={{ minWidth: 120 }}>
 <Text strong>{fmtIQD(v)}</Text>
 <Progress percent={pct} strokeColor={pct >= 100 ? '#f59e0b' : '#7B61FF'} showInfo={false} className="depreciation-progress" />
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
 return <Tag icon={iconMap[s]} color={statusColors[s] || 'default'} style={{ borderRadius: 12 }}>{t(s)}</Tag>;
 },
 },
 {
 title: t('actions'), key: 'actions',
 render: (_: unknown, r: Asset) => (
 <Space>
 <Button onClick={() => openEdit(r)}>{t('edit')}</Button>
 {r.status === 'active' && (
 <Button onClick={() => { disposeForm.resetFields(); setDisposeModal(r.id); }}>
 {t('dispose')}
 </Button>
 )}
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
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

 const tabItems = [
 { key: '', label: t('all') },
 { key: 'active', label: t('active') },
 { key: 'fully_depreciated', label: t('fully_depreciated') },
 { key: 'disposed', label: t('disposed') },
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
 <Card className="stat-card gradient-card-blue" style={{ borderRadius: 12 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <Statistic
 title={<Text style={{ color: '#6b7280', fontSize: 13 }}>{t('purchasePrice')}</Text>}
 value={data.reduce((sum, a) => sum + (a.purchase_price || 0), 0)}
 suffix="IQD"
 styles={{ content: { color: '#2563eb', fontWeight: 700 } }}
 />
 <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2563eb14' }}>
 <DollarOutlined style={{ fontSize: 24, color: '#2563eb' }} />
 </div>
 </div>
 </Card>
 </Col>
 <Col xs={24} sm={8}>
 <Card className="stat-card gradient-card-orange" style={{ borderRadius: 12 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <Statistic
 title={<Text style={{ color: '#6b7280', fontSize: 13 }}>{t('currentValue')}</Text>}
 value={data.reduce((sum, a) => sum + (a.current_value || 0), 0)}
 suffix="IQD"
 styles={{ content: { color: '#ea580c', fontWeight: 700 } }}
 />
 <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ea580c14' }}>
 <FallOutlined style={{ fontSize: 24, color: '#ea580c' }} />
 </div>
 </div>
 </Card>
 </Col>
 <Col xs={24} sm={8}>
 <Card className="stat-card gradient-card-green" style={{ borderRadius: 12 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <Statistic
 title={<Text style={{ color: '#6b7280', fontSize: 13 }}>{t('fully_depreciated')}</Text>}
 value={data.filter(a => a.status === 'fully_depreciated').length}
 suffix={`/ ${data.length}`}
 styles={{ content: { color: '#16a34a', fontWeight: 700 } }}
 />
 <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#16a34a14' }}>
 <CheckCircleOutlined style={{ fontSize: 24, color: '#16a34a' }} />
 </div>
 </div>
 </Card>
 </Col>
 </Row>

 <div style={{ marginBottom: spaceTk.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spaceTk.md, flexWrap: 'wrap' }}>
 <Tabs activeKey={statusFilter} onChange={setStatusFilter} items={tabItems} style={{ flex: 1, minWidth: 240 }} />
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('assets', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </div>

 <ResponsiveTableAdapter
 dataSource={data}
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 locale={{
 emptyText: (
 <Empty
 image={<InboxOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
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
