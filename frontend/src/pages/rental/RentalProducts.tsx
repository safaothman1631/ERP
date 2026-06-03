import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Space, Input, Form, InputNumber, Switch, Modal, Radio } from 'antd';
import { message } from '../../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, type ColumnVisibilityItem, BulkActionBar, StatusTag } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface RentalProduct {
 id: string;
 name: string;
 daily_rate: number;
 weekly_rate: number;
 monthly_rate: number;
 deposit: number;
 quantity_total: number;
 is_available: boolean;
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

const RentalProducts: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<RentalProduct[]>([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [search, setSearch] = useState('');
 const [tab, setTab] = useState<'all' | 'available' | 'unavailable'>('all');
 const [modal, setModal] = useState(false);
 const [editing, setEditing] = useState<RentalProduct | null>(null);
 const [form] = Form.useForm();
 const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('rental_products.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/rental/products', { params: { limit: 100 } });
 const items = res.data.items || [];
 setData(items);
 setTotal(res.data.total || items.length);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchData();
 }, []);

 const filteredData = useMemo(() => {
 let rows = data;
 if (search) {
 rows = rows.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()));
 }
 if (tab === 'available') {
 rows = rows.filter((p) => p.is_available);
 } else if (tab === 'unavailable') {
 rows = rows.filter((p) => !p.is_available);
 }
 return rows;
 }, [data, search, tab]);

 useEffect(() => {
 setTotal(filteredData.length);
 }, [filteredData]);

 // Kit list tabs (All / Available / Unavailable) — client-side filtered on is_available.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'available', label: t('rental.available', 'Available') },
 { key: 'unavailable', label: t('rental.unavailable', 'Unavailable') },
 ];

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.patch(`/api/rental/products/${editing.id}`, values);
 } else {
 await api.post('/api/rental/products', values);
 }
 message.success(t('success'));
 setModal(false);
 form.resetFields();
 setEditing(null);
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/rental/products/${id}`);
 message.success(t('success'));
 void fetchData();
 },
 });
 };

 const openEdit = (record: RentalProduct) => {
 setEditing(record);
 form.setFieldsValue(record);
 setModal(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const openDuplicate = (record: RentalProduct) => {
 setEditing(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({ ...rest, name: `${record.name ?? ''} (${t('copy', 'copy')})` });
 setModal(true);
 };

 const handleBulkDelete = () => {
 Modal.confirm({
 title: t('are_you_sure'),
 content: t('data_table_v2.delete_n_confirm', { n: selectedIds.length }),
 okButtonProps: { danger: true },
 onOk: async () => {
 await Promise.all(selectedIds.map((id) => api.delete(`/api/rental/products/${id}`)));
 message.success(t('success'));
 setSelectedIds([]);
 void fetchData();
 },
 });
 };

 const money = (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {v?.toLocaleString()}
 </span>
 );

 const allColumns = [
 {
 title: t('rental.product_name'), dataIndex: 'name', key: 'name',
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
 title: t('rental.daily_rate'),
 dataIndex: 'daily_rate',
 key: 'daily_rate',
 render: (v: number) => money(v),
 },
 {
 title: t('rental.weekly_rate'),
 dataIndex: 'weekly_rate',
 key: 'weekly_rate',
 render: (v: number) => money(v),
 },
 {
 title: t('rental.monthly_rate'),
 dataIndex: 'monthly_rate',
 key: 'monthly_rate',
 render: (v: number) => money(v),
 },
 {
 title: t('rental.deposit'),
 dataIndex: 'deposit',
 key: 'deposit',
 render: (v: number) => money(v),
 },
 { title: t('rental.quantity'), dataIndex: 'quantity_total', key: 'quantity_total' },
 {
 title: t('rental.available'),
 dataIndex: 'is_available',
 key: 'is_available',
 render: (v: boolean) => <StatusTag status={v ? 'success' : 'default'} label={v ? t('yes') : t('no')} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: RentalProduct) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openEdit(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => openDuplicate(record) },
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
 try { localStorage.setItem('rental_products.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('rental.rental_products')}
 subtitle={t('rental.rental_products_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditing(null);
 form.resetFields();
 setModal(true);
 }}
 >
 {t('rental.new_product')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as typeof tab); setSelectedIds([]); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => setTab('all')}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => setTab(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="available">{t('rental.available', 'Available')}</Radio>
 <Radio value="unavailable">{t('rental.unavailable', 'Unavailable')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('rental.available', 'Available')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => setTab((v || 'all') as typeof tab)}
 options={[
 { value: 'available', label: t('rental.available', 'Available') },
 { value: 'unavailable', label: t('rental.unavailable', 'Unavailable') },
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
 downloadCsv('rental_products', filteredData, cols);
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
 pagination={{ pageSize: 20, total }}
 rowSelection={{
 selectedRowKeys: selectedIds,
 onChange: (keys) => setSelectedIds(keys),
 }}
 />
 </KitListCard>

 <BulkActionBar
 selectedCount={selectedIds.length}
 onClear={() => setSelectedIds([])}
 isDark={isDark}
 actions={[
 {
 key: 'delete',
 label: t('delete'),
 icon: <DeleteOutlined />,
 danger: true,
 onClick: handleBulkDelete,
 },
 ]}
 />

 <FormDialog
 title={editing ? t('edit') : t('rental.new_product')}
 open={modal}
 onClose={() => {
 setModal(false);
 setEditing(null);
 form.resetFields();
 }}
 onOk={() => form.submit()}
 >
 <Form
 form={form}
 layout="vertical"
 onFinish={handleSave}
 initialValues={{
 daily_rate: 0,
 weekly_rate: 0,
 monthly_rate: 0,
 deposit: 0,
 quantity_total: 1,
 is_available: true,
 }}
 >
 <Form.Item
 label={t('rental.product_name')}
 name="name"
 rules={[{ required: true, message: t('required_name') }]}
 >
 <Input placeholder={t('rental.product_name_placeholder')} />
 </Form.Item>
 <Space style={{ width: '100%' }}>
 <Form.Item label={t('rental.daily_rate')} name="daily_rate">
 <InputNumber min={0} style={{ width: 150 }} />
 </Form.Item>
 <Form.Item label={t('rental.weekly_rate')} name="weekly_rate">
 <InputNumber min={0} style={{ width: 150 }} />
 </Form.Item>
 </Space>
 <Space style={{ width: '100%' }}>
 <Form.Item label={t('rental.monthly_rate')} name="monthly_rate">
 <InputNumber min={0} style={{ width: 150 }} />
 </Form.Item>
 <Form.Item label={t('rental.deposit')} name="deposit">
 <InputNumber min={0} style={{ width: 150 }} />
 </Form.Item>
 </Space>
 <Space style={{ width: '100%' }}>
 <Form.Item label={t('rental.quantity')} name="quantity_total">
 <InputNumber min={1} style={{ width: 150 }} />
 </Form.Item>
 <Form.Item label={t('rental.available')} name="is_available" valuePropName="checked">
 <Switch />
 </Form.Item>
 </Space>
 </Form>
 </FormDialog>
 </div>
 );
};

export default RentalProducts;
