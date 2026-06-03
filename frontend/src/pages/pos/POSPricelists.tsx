import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, Select, InputNumber, Card, DatePicker, Modal, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import dayjs from 'dayjs';
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

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const POSPricelists: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 // Kit list tab / status filter (client-side — page fetches all rows at once).
 const [tab, setTab] = useState<'all' | 'active' | 'inactive'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('pos_pricelists.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/pos/pricelists', { params: { page_size: 100 } });
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

 const openModal = (record?: any) => {
 if (record) {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 rules: record.rules || [],
 });
 } else {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({
 is_active: true,
 currency: 'IQD',
 discount_policy: 'with_discount',
 rules: [],
 });
 }
 setModalVisible(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const openDuplicate = (record: any) => {
 setEditingId(null);
 form.resetFields();
 const { id: _id, ...rest } = record;
 form.setFieldsValue({
 ...rest,
 name: `${record.name ?? ''} (${t('copy', 'copy')})`,
 rules: record.rules || [],
 });
 setModalVisible(true);
 };

 const handleSubmit = async (values: any) => {
 try {
 // Convert dates to ISO strings
 const payload = {
 ...values,
 rules: (values.rules || []).map((r: any) => ({
 ...r,
 date_from: r.date_from ? dayjs(r.date_from).toISOString() : null,
 date_to: r.date_to ? dayjs(r.date_to).toISOString() : null,
 })),
 };

 if (editingId) {
 await api.put(`/api/pos/pricelists/${editingId}`, payload);
 message.success(t('success'));
 } else {
 await api.post('/api/pos/pricelists', payload);
 message.success(t('success'));
 }
 setModalVisible(false);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('confirm_delete'),
 onOk: async () => {
 try {
 await api.delete(`/api/pos/pricelists/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 // Kit list tabs (All / Active / Inactive) — client-side filtered on is_active.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'active', label: t('active', 'Active') },
 { key: 'inactive', label: t('inactive', 'Inactive') },
 ];

 const filteredData = useMemo(() => {
 let rows = data;
 if (tab === 'active') rows = rows.filter((r) => r.is_active);
 else if (tab === 'inactive') rows = rows.filter((r) => !r.is_active);
 if (search) {
 const q = search.toLowerCase();
 rows = rows.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }
 return rows;
 }, [data, tab, search]);

 const allColumns = [
 {
 title: t('name'),
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
 title: t('name_ku'),
 dataIndex: 'name_ku',
 key: 'name_ku',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('pos.currency'),
 dataIndex: 'currency',
 key: 'currency',
 render: (val: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{val}</span>
 ),
 },
 {
 title: t('pos.rules_count'),
 dataIndex: 'rules',
 key: 'rules',
 render: (rules: any[]) => <StatusTag status="info" label={String(rules?.length || 0)} />,
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (active: boolean) => (
 <StatusTag status={active ? 'active' : 'inactive'} label={active ? t('active') : t('inactive')} />
 ),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openModal(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openModal(record) },
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
 try { localStorage.setItem('pos_pricelists.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <>
 <PageHeader
 title={t('pos.pricelists')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
 {t('add')}
 </Button>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => setTab(k as typeof tab)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
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
 <Radio value="active">{t('active', 'Active')}</Radio>
 <Radio value="inactive">{t('inactive', 'Inactive')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => setTab((v || 'all') as typeof tab)}
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
 downloadCsv('pos_pricelists', filteredData, cols);
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
 <ResponsiveTableAdapter dataSource={filteredData} columns={columns} rowKey="id" loading={loading} pagination={false} />
 </KitListCard>

 <FormDialog
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => form.submit()}
 title={editingId ? t('edit') : t('add')}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>

 <Form.Item name="name_ku" label={t('name_ku')}>
 <Input />
 </Form.Item>

 <Form.Item name="currency" label={t('pos.currency')}>
 <Select>
 <Select.Option value="IQD">IQD</Select.Option>
 <Select.Option value="USD">USD</Select.Option>
 </Select>
 </Form.Item>

 <Form.Item name="discount_policy" label={t('pos.discount_policy')}>
 <Select>
 <Select.Option value="with_discount">{t('pos.with_discount')}</Select.Option>
 <Select.Option value="without_discount">{t('pos.without_discount')}</Select.Option>
 </Select>
 </Form.Item>

 <Form.Item label={t('pos.pricelist_rules')}>
 <Form.List name="rules">
 {(fields, { add, remove }) => (
 <>
 {fields.map((field, index) => (
 <Card
 key={field.key}
 title={`${t('pos.rule')} ${index + 1}`}
 extra={<Button icon={<MinusCircleOutlined />} danger onClick={() => remove(field.name)} />}
 style={{ marginBottom: 8 }}
 >
 <Form.Item
 {...field}
 name={[field.name, 'applies_on']}
 label={t('pos.applies_on')}
 rules={[{ required: true }]}
 >
 <Select>
 <Select.Option value="all">{t('pos.all_products')}</Select.Option>
 <Select.Option value="category">{t('pos.category')}</Select.Option>
 <Select.Option value="product">{t('pos.product')}</Select.Option>
 </Select>
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'product_id']} label={t('pos.product_id')}>
 <Input placeholder={t('pos.product_id_hint')} />
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'category_id']} label={t('pos.category_id')}>
 <Input placeholder={t('pos.category_id_hint')} />
 </Form.Item>

 <Space>
 <Form.Item {...field} name={[field.name, 'min_qty']} label={t('pos.min_qty')}>
 <InputNumber min={1} defaultValue={1} />
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'compute']} label={t('pos.compute')}>
 <Select defaultValue="fixed">
 <Select.Option value="fixed">{t('pos.fixed_price')}</Select.Option>
 <Select.Option value="discount">{t('pos.discount')}</Select.Option>
 <Select.Option value="formula">{t('pos.formula')}</Select.Option>
 </Select>
 </Form.Item>
 </Space>

 <Space>
 <Form.Item {...field} name={[field.name, 'fixed_price']} label={t('pos.fixed_price')}>
 <InputNumber min={0} />
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'percent']} label={t('pos.discount_percent')}>
 <InputNumber min={0} max={100} />
 </Form.Item>
 </Space>

 <Space>
 <Form.Item {...field} name={[field.name, 'date_from']} label={t('pos.date_from')}>
 <DatePicker />
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'date_to']} label={t('pos.date_to')}>
 <DatePicker />
 </Form.Item>
 </Space>
 </Card>
 ))}
 <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
 {t('pos.add_rule')}
 </Button>
 </>
 )}
 </Form.List>
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default POSPricelists;
