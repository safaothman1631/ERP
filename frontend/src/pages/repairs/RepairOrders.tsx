import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Form, InputNumber, Switch, Radio } from 'antd';
import { message } from '../../utils/message';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
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
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface RepairOrder {
 id: string;
 customer_name: string;
 product_name?: string;
 serial_no?: string;
 issue_description: string;
 status?: string;
 received_at?: string;
 estimated_cost: number;
 is_under_warranty: boolean;
}

const RepairOrders: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<RepairOrder[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [drawer, setDrawer] = useState(false);
 const [form] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('repair_orders.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/repairs/orders', { params: { limit: 100 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchData();
 }, []);

 const handleCreate = async (values: any) => {
 try {
 await api.post('/api/repairs/orders', values);
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const getStatusTag = (status?: string) => {
 const s = status || 'received';
 const kindMap: Record<string, StatusKind> = {
 received: 'info',
 diagnosed: 'info',
 in_repair: 'warning',
 done: 'success',
 delivered: 'default',
 };
 return <StatusTag status={kindMap[s] || 'default'} label={t(`repairs.status_${s}`)} />;
 };

 const filteredData = data.filter((r) => {
 const matchSearch =
 !search ||
 r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
 r.serial_no?.toLowerCase().includes(search.toLowerCase());
 const matchStatus = !statusFilter || (r.status || 'received') === statusFilter;
 return matchSearch && matchStatus;
 });

 // Status segments (used by both the tab strip and the toolbar Status dropdown).
 const statusOptions = [
 { value: 'received', label: t('repairs.status_received') },
 { value: 'diagnosed', label: t('repairs.status_diagnosed') },
 { value: 'in_repair', label: t('repairs.status_in_repair') },
 { value: 'done', label: t('repairs.status_done') },
 { value: 'delivered', label: t('repairs.status_delivered') },
 ];

 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...statusOptions.map((o) => ({ key: o.value, label: o.label })),
 ];

 // Kit cell renderers — avatar+name, mono serial/date, muted chips (tokens only).
 const allColumns = [
 {
 title: t('repairs.customer_name'),
 dataIndex: 'customer_name',
 key: 'customer_name',
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{String(v || '?').trim().slice(0, 2).toUpperCase()}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 </div>
 ),
 },
 {
 title: t('repairs.product'),
 dataIndex: 'product_name',
 key: 'product_name',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('repairs.serial_no'),
 dataIndex: 'serial_no',
 key: 'serial_no',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('repairs.issue'),
 dataIndex: 'issue_description',
 key: 'issue_description',
 ellipsis: true,
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('repairs.status'),
 dataIndex: 'status',
 key: 'status',
 render: (s: string) => getStatusTag(s),
 },
 {
 title: t('repairs.received_at'),
 dataIndex: 'received_at',
 key: 'received_at',
 render: (d: string) => d
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{dayjs(d).format('YYYY-MM-DD HH:mm')}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('repairs.warranty'),
 dataIndex: 'is_under_warranty',
 key: 'is_under_warranty',
 render: (v: boolean) => <StatusTag status={v ? 'success' : 'default'} label={v ? t('yes') : t('no')} />,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: RepairOrder) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => navigate(`/repairs/orders/${record.id}`) },
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'customer_name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('repair_orders.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('repairs.repair_orders')}
 subtitle={t('repairs.repair_orders_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 form.resetFields();
 setDrawer(true);
 }}
 >
 {t('repairs.new_order')}
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
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-700)' }}>
 {t('repairs.filter_by_status')}
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
 </KitFiltersButton>
 <KitStatusFilter
 label={t('repairs.filter_by_status')}
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
 downloadCsv('repair_orders', filteredData, cols);
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
 pagination={{ pageSize: 20 }}
 />
 </KitListCard>

 <FormDialog
 title={t('repairs.new_order')}
 open={drawer}
 onClose={() => {
 setDrawer(false);
 form.resetFields();
 }}
 >
 <Form
 form={form}
 layout="vertical"
 onFinish={handleCreate}
 initialValues={{ estimated_cost: 0, is_under_warranty: false }}
 >
 <Form.Item
 label={t('repairs.customer_name')}
 name="customer_name"
 rules={[{ required: true, message: t('required') }]}
 >
 <Input placeholder={t('repairs.customer_name_placeholder')} />
 </Form.Item>
 <Form.Item label={t('repairs.product')} name="product_name">
 <Input placeholder={t('repairs.product_name_placeholder')} />
 </Form.Item>
 <Form.Item label={t('repairs.serial_no')} name="serial_no">
 <Input placeholder={t('repairs.serial_no_placeholder')} />
 </Form.Item>
 <Form.Item
 label={t('repairs.issue_description')}
 name="issue_description"
 rules={[{ required: true, message: t('required') }]}
 >
 <Input.TextArea rows={3} placeholder={t('repairs.issue_placeholder')} />
 </Form.Item>
 <Form.Item label={t('repairs.estimated_cost')} name="estimated_cost">
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item
 label={t('repairs.under_warranty')}
 name="is_under_warranty"
 valuePropName="checked"
 >
 <Switch />
 </Form.Item>
 <div style={{ display: 'flex', gap: space.sm, justifyContent: 'flex-end' }}>
 <Button onClick={() => setDrawer(false)}>{t('cancel')}</Button>
 <Button type="primary" htmlType="submit">
 {t('create')}
 </Button>
 </div>
 </Form>
 </FormDialog>
 </div>
 );
};

export default RepairOrders;
