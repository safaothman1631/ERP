import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Form, Select, DatePicker, InputNumber, Radio } from 'antd';
import { message } from '../../utils/message';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitSearchInput from '../../design-system/KitSearchInput';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import { downloadCsv } from '../../utils/exportCsv';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

interface RentalContract {
 id: string;
 customer_name: string;
 product_id: string;
 quantity: number;
 start_date: string;
 end_date: string;
 daily_rate?: number;
 deposit_amount: number;
 status?: string;
}

const RentalContracts: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<RentalContract[]>([]);
 const [products, setProducts] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [drawer, setDrawer] = useState(false);
 const [form] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('rental.contracts.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/rental/contracts', { params: { limit: 100 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchProducts = async () => {
 try {
 const res = await api.get('/api/rental/products', { params: { limit: 200 } });
 setProducts(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 useEffect(() => {
 void fetchData();
 void fetchProducts();
 }, []);

 const handleCreate = async (values: any) => {
 try {
 const payload = {
 ...values,
 start_date: values.start_date?.format('YYYY-MM-DD'),
 end_date: values.end_date?.format('YYYY-MM-DD'),
 };
 await api.post('/api/rental/contracts', payload);
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const getStatusTag = (status?: string) => {
 if (!status || status === 'draft') return <StatusTag status="default" label={t('rental.status_draft')} />;
 if (status === 'active') return <StatusTag status="success" label={t('rental.status_active')} />;
 if (status === 'closed') return <StatusTag status="default" label={t('rental.status_closed')} />;
 return <StatusTag status="default" label={status} />;
 };

 const filteredData = data.filter((c) => {
 const matchSearch = !search || c.customer_name?.toLowerCase().includes(search.toLowerCase());
 const matchStatus = !statusFilter || (c.status || 'draft') === statusFilter;
 return matchSearch && matchStatus;
 });

 // Kit list tabs (All / Draft / Active / Closed) — wired to the same client-side
 // status filter the page already applies (missing status counts as 'draft').
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'draft', label: t('rental.status_draft') },
 { key: 'active', label: t('rental.status_active') },
 { key: 'closed', label: t('rental.status_closed') },
 ];

 const allColumns = [
 {
 title: t('rental.customer_name'), dataIndex: 'customer_name', key: 'customer_name',
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
 title: t('rental.product'),
 dataIndex: 'product_id',
 key: 'product_id',
 render: (pid: string) => {
 const p = products.find((pr) => pr.id === pid);
 return (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{p?.name || pid}</span>
 );
 },
 },
 { title: t('rental.quantity'), dataIndex: 'quantity', key: 'quantity' },
 {
 title: t('rental.start_date'),
 dataIndex: 'start_date',
 key: 'start_date',
 render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '—'),
 },
 {
 title: t('rental.end_date'),
 dataIndex: 'end_date',
 key: 'end_date',
 render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '—'),
 },
 {
 title: t('rental.deposit'),
 dataIndex: 'deposit_amount',
 key: 'deposit_amount',
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {v?.toLocaleString() || '0'}
 </span>
 ),
 },
 {
 title: t('rental.status'),
 dataIndex: 'status',
 key: 'status',
 render: (s: string) => getStatusTag(s),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: RentalContract) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view'), onClick: () => navigate(`/rental/contracts/${record.id}`) },
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, products, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'customer_name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('rental.contracts.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('rental.rental_contracts')}
 subtitle={t('rental.rental_contracts_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 form.resetFields();
 setDrawer(true);
 }}
 >
 {t('rental.new_contract')}
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
 activeCount={statusFilter ? 1 : 0}
 onClear={() => setStatusFilter('')}
 >
 <Radio.Group
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 <Radio value="draft">{t('rental.status_draft')}</Radio>
 <Radio value="active">{t('rental.status_active')}</Radio>
 <Radio value="closed">{t('rental.status_closed')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('rental.status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => setStatusFilter(v)}
 options={[
 { value: 'draft', label: t('rental.status_draft') },
 { value: 'active', label: t('rental.status_active') },
 { value: 'closed', label: t('rental.status_closed') },
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
 downloadCsv('rental-contracts', filteredData, cols);
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
 title={t('rental.new_contract')}
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
 initialValues={{ quantity: 1, deposit_amount: 0 }}
 >
 <Form.Item
 label={t('rental.customer_name')}
 name="customer_name"
 rules={[{ required: true, message: t('required') }]}
 >
 <Input placeholder={t('rental.customer_name_placeholder')} />
 </Form.Item>
 <Form.Item
 label={t('rental.product')}
 name="product_id"
 rules={[{ required: true, message: t('required') }]}
 >
 <Select
 placeholder={t('rental.select_product')}
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
 <Form.Item label={t('rental.quantity')} name="quantity">
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item
 label={t('rental.start_date')}
 name="start_date"
 rules={[{ required: true, message: t('required') }]}
 >
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item
 label={t('rental.end_date')}
 name="end_date"
 rules={[{ required: true, message: t('required') }]}
 >
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('rental.deposit')} name="deposit_amount">
 <InputNumber min={0} style={{ width: '100%' }} />
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

export default RentalContracts;
