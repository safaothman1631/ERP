import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, InputNumber, Select, Switch, Card, Tag, Image, Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { EditOutlined, SearchOutlined, PlusOutlined, ImportOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../../design-system';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Text } = Typography;

const POSProducts: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [categories, setCategories] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [editModalVisible, setEditModalVisible] = useState(false);
 const [editingItem, setEditingItem] = useState<any>(null);
 const [form] = Form.useForm();

 // ── "Pull from inventory" modal state ────────────────────────────────────
 // Lets the user bring existing inventory items into POS in bulk by flipping
 // their `available_in_pos` flag. This is the primary UX for stocking a new
 // POS catalog without re-creating items.
 const [pullModalOpen, setPullModalOpen] = useState(false);
 const [pullableItems, setPullableItems] = useState<any[]>([]);
 const [pullableLoading, setPullableLoading] = useState(false);
 const [pullSearch, setPullSearch] = useState('');
 const [pullSelected, setPullSelected] = useState<string[]>([]);
 const [pullCategoryDefault, setPullCategoryDefault] = useState<string | undefined>(undefined);
 const [pullSaving, setPullSaving] = useState(false);

 // ── "Create new POS item" modal state ───────────────────────────────────
 // Inline create flow so the user can stock the POS catalog without
 // leaving this page. We post to /api/items with `available_in_pos: true`
 // so the new record shows up here immediately after save.
 const [createModalOpen, setCreateModalOpen] = useState(false);
 const [createSaving, setCreateSaving] = useState(false);
 const [createForm] = Form.useForm();

 const [filters, setFilters] = useState({
 category_id: '',
 q: '',
 });
 const [pagination, setPagination] = useState({
 current: 1,
 pageSize: 50,
 total: 0,
 });
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('posProducts.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchCategories = async () => {
 try {
 const res = await api.get('/api/pos/categories', { params: { page_size: 500 } });
 setCategories(res.data.items || []);
 } catch {
 // Silent fail
 }
 };

 const fetchData = async (page = 1) => {
 setLoading(true);
 try {
 const res = await api.get('/api/pos/products', {
 params: {
 page,
 page_size: pagination.pageSize,
 category_id: filters.category_id || undefined,
 q: filters.q || undefined,
 },
 });
 setData(res.data.items || []);
 setPagination((prev) => ({
 ...prev,
 current: page,
 total: res.data.total || 0,
 }));
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchCategories();
 fetchData();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 const handleSearch = () => {
 fetchData(1);
 };

 const openEditModal = (record: any) => {
 setEditingItem(record);
 form.setFieldsValue({
 pos_category_id: record.category_id || record.pos_category_id,
 image_url: record.image_url,
 available_in_pos: true,
 });
 setEditModalVisible(true);
 };

 const handleEditSubmit = async (values: any) => {
 try {
 await api.put(`/api/items/${editingItem.id}`, {
 pos_category_id: values.pos_category_id,
 image_url: values.image_url,
 available_in_pos: values.available_in_pos,
 });
 message.success(t('success'));
 setEditModalVisible(false);
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 };

 // ── Pull-from-inventory flow ─────────────────────────────────────────────
 const loadPullableItems = async (q = '') => {
 setPullableLoading(true);
 try {
 const res = await api.get('/api/items', {
 params: { page: 1, page_size: 200, search: q || undefined },
 });
 // Only show items NOT yet in POS so the picker is meaningful.
 const filtered = (res.data.items || []).filter(
 (it: any) => !it.available_in_pos,
 );
 setPullableItems(filtered);
 } catch {
 setPullableItems([]);
 } finally {
 setPullableLoading(false);
 }
 };

 const openPullModal = () => {
 setPullSelected([]);
 setPullSearch('');
 setPullCategoryDefault(undefined);
 setPullModalOpen(true);
 loadPullableItems('');
 };

 const handlePullSearch = (val: string) => {
 setPullSearch(val);
 loadPullableItems(val);
 };

 // ── Create-new-item flow ─────────────────────────────────────────────────
 const openCreateModal = () => {
 createForm.resetFields();
 createForm.setFieldsValue({
 item_type: 'goods',
 unit: 'pcs',
 selling_price: 0,
 cost_price: 0,
 });
 setCreateModalOpen(true);
 };

 const handleCreateSave = async (values: any) => {
 setCreateSaving(true);
 try {
 await api.post('/api/items', {
 ...values,
 // The whole point of this entry path: the new item is POS-visible
 // from the moment it's created. The schema's default is false for
 // items created via /items/new, so we explicitly override here.
 available_in_pos: true,
 });
 message.success(t('success'));
 setCreateModalOpen(false);
 fetchData(1);
 } catch (err) {
 const detail =
 (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '';
 message.error(detail || t('error'));
 } finally {
 setCreateSaving(false);
 }
 };

 const handlePullSave = async () => {
 if (pullSelected.length === 0) {
 message.warning(t('pos.pull_select_at_least_one', 'Select at least one item to add'));
 return;
 }
 setPullSaving(true);
 const results = await Promise.allSettled(
 pullSelected.map((itemId) =>
 api.put(`/api/items/${itemId}`, {
 available_in_pos: true,
 ...(pullCategoryDefault ? { pos_category_id: pullCategoryDefault } : {}),
 }),
 ),
 );
 setPullSaving(false);
 const failed = results.filter((r) => r.status === 'rejected').length;
 if (failed > 0) {
 message.warning(
 t('pos.pull_partial_success', { count: pullSelected.length - failed, failed }) ||
 `Added ${pullSelected.length - failed} item(s), ${failed} failed.`,
 );
 } else {
 message.success(
 t('pos.pull_success', { count: pullSelected.length }) ||
 `Added ${pullSelected.length} item(s) to POS.`,
 );
 }
 setPullModalOpen(false);
 fetchData(1);
 };

 const flattenCategories = (cats: any[], level = 0): any[] => {
 let result: any[] = [];
 for (const cat of cats) {
 result.push({
 value: cat.id,
 label: '—'.repeat(level) + ' ' + cat.name,
 });
 if (cat.children && cat.children.length > 0) {
 result = result.concat(flattenCategories(cat.children, level + 1));
 }
 }
 return result;
 };

 const categoryOptions = flattenCategories(categories);

 const columns = [
 {
 title: t('pos.image'),
 dataIndex: 'image_url',
 key: 'image_url',
 width: 80,
 render: (url: string) =>
 url ? <Image src={url} style={{ objectFit: 'cover' }} /> : '—',
 },
 {
 title: t('name'),
 dataIndex: 'name',
 key: 'name',
 },
 {
 title: t('name_ku'),
 dataIndex: 'name_ku',
 key: 'name_ku',
 },
 {
 title: t('sku'),
 dataIndex: 'sku',
 key: 'sku',
 },
 {
 title: t('barcode'),
 dataIndex: 'barcode',
 key: 'barcode',
 },
 {
 title: t('price'),
 dataIndex: 'price',
 key: 'price',
 render: (val: number) => (val ?? 0).toLocaleString('en-IQ') + ' IQD',
 },
 {
 title: t('pos.category'),
 dataIndex: 'category_id',
 key: 'category_id',
 render: (catId: string) => {
 const cat = categories.find((c) => c.id === catId);
 return cat ? cat.name : '—';
 },
 },
 {
 title: t('qty_available'),
 dataIndex: 'qty_available',
 key: 'qty_available',
 render: (val: number) => (
 <Tag color={(val ?? 0) > 0 ? 'green' : 'red'}>{val ?? 0}</Tag>
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
 {t('edit')}
 </Button>
 ),
 },
 ];
 const visibleColumns = useMemo(
 () => columns.filter((c) => !hiddenCols.includes(c.key as string)),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [hiddenCols, categories],
 );
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('posProducts.hiddenCols', JSON.stringify(next)); } catch {}
 };

 const noFilters = !filters.q && !filters.category_id;
 const showEmptyState = !loading && data.length === 0 && noFilters;

 return (
 <Card
 title={t('pos.products')}
 extra={
 <Space>
 <Button
 type="primary"
 icon={<ImportOutlined />}
 onClick={openPullModal}
 data-testid="pos-products-pull-cta"
 >
 {t('pos.add_existing_items', 'Add from inventory')}
 </Button>
 <Button
 icon={<PlusOutlined />}
 onClick={openCreateModal}
 data-testid="pos-products-create-cta"
 >
 {t('pos.create_new_item', 'Create new item')}
 </Button>
 </Space>
 }
 >
 <Space style={{ marginBottom: 16 }} wrap>
 <Input
 placeholder={t('search')}
 value={filters.q}
 onChange={(e) => setFilters({ ...filters, q: e.target.value })}
 onPressEnter={handleSearch}
 style={{ width: 200 }}
 prefix={<SearchOutlined />}
 />
 <Select
 placeholder={t('pos.category')}
 value={filters.category_id || undefined}
 onChange={(val) => setFilters({ ...filters, category_id: val || '' })}
 options={[{ value: '', label: t('all') }, ...categoryOptions]}
 style={{ width: 200 }}
 allowClear
 />
 <Button type="primary" onClick={handleSearch}>
 {t('search')}
 </Button>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('pos-products', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </Space>

 {showEmptyState ? (
 <div style={{ padding: '48px 16px' }}>
 <Empty
 image={<AppstoreAddOutlined style={{ fontSize: 64, color: '#bfbfbf' }} />}
 description={
 <div style={{ marginTop: 12 }}>
 <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>
 {t('pos.no_products_yet', 'No POS products yet')}
 </Text>
 <Text type="secondary">
 {t(
 'pos.no_products_help',
 'Pull existing inventory items into POS, or create a new item from scratch.',
 )}
 </Text>
 </div>
 }
 >
 <Space>
 <Button type="primary" icon={<ImportOutlined />} onClick={openPullModal}>
 {t('pos.add_existing_items', 'Add from inventory')}
 </Button>
 <Button
 icon={<PlusOutlined />}
 onClick={openCreateModal}
 >
 {t('pos.create_new_item', 'Create new item')}
 </Button>
 </Space>
 </Empty>
 </div>
 ) : (
 <ResponsiveTableAdapter
 dataSource={data}
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 pagination={{
 current: pagination.current,
 pageSize: pagination.pageSize,
 total: pagination.total,
 onChange: (page) => fetchData(page),
 showSizeChanger: false,
 }}
 />
 )}

 {/* ── Edit modal ────────────────────────────────────────────────── */}
 <FormDialog
 open={editModalVisible}
 onClose={() => setEditModalVisible(false)}
 onOk={() => form.submit()}
 title={t('pos.edit_product')}
 >
 <Form form={form} layout="vertical" onFinish={handleEditSubmit}>
 <Form.Item name="pos_category_id" label={t('pos.category')}>
 <Select options={categoryOptions} allowClear />
 </Form.Item>

 <Form.Item name="image_url" label={t('pos.image_url')}>
 <Input placeholder="https://..." />
 </Form.Item>

 <Form.Item name="available_in_pos" label={t('pos.available_in_pos')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>

 {/* ── Pull-from-inventory modal ─────────────────────────────────── */}
 <FormDialog
 open={pullModalOpen}
 onClose={() => setPullModalOpen(false)}
 onOk={handlePullSave}
 title={t('pos.add_existing_items', 'Add from inventory')}
 confirmLoading={pullSaving}
 >
 <div style={{ marginBottom: 12 }}>
 <Text type="secondary">
 {t(
 'pos.pull_help',
 'Select items from your inventory to make them available in POS. You can adjust the category for each item later.',
 )}
 </Text>
 </div>
 <Space direction="vertical" style={{ width: '100%' }} size="middle">
 <Input
 placeholder={t('pos.pull_search_placeholder', 'Search items by name or SKU...')}
 value={pullSearch}
 onChange={(e) => handlePullSearch(e.target.value)}
 prefix={<SearchOutlined />}
 allowClear
 />
 <div>
 <Text strong>{t('pos.category', 'POS category')}:</Text>
 <div style={{ marginTop: 4 }}>
 <Select
 placeholder={t('pos.pick_default_category', 'Default category (optional)')}
 value={pullCategoryDefault}
 onChange={(v) => setPullCategoryDefault(v as string | undefined)}
 options={categoryOptions}
 style={{ width: '100%' }}
 allowClear
 showSearch
 optionFilterProp="label"
 />
 </div>
 </div>
 <div
 style={{
 maxHeight: 360,
 overflowY: 'auto',
 border: '1px solid #f0f0f0',
 borderRadius: 6,
 padding: 8,
 }}
 >
 {pullableLoading ? (
 <div style={{ textAlign: 'center', padding: 32 }}>{t('loading', 'Loading…')}</div>
 ) : pullableItems.length === 0 ? (
 <Empty
 description={
 pullSearch
 ? t('pos.pull_no_results', 'No matching items found')
 : t('pos.pull_no_pullable', 'All inventory items are already in POS')
 }
 />
 ) : (
 <Space direction="vertical" style={{ width: '100%' }} size={4}>
 {pullableItems.map((item) => {
 const checked = pullSelected.includes(item.id);
 return (
 <label
 key={item.id}
 style={{
 display: 'flex',
 alignItems: 'center',
 gap: 12,
 padding: '8px 10px',
 borderRadius: 6,
 cursor: 'pointer',
 background: checked ? 'rgba(22, 119, 255, 0.06)' : 'transparent',
 }}
 >
 <input
 type="checkbox"
 checked={checked}
 onChange={(e) => {
 setPullSelected((prev) =>
 e.target.checked
 ? [...prev, item.id]
 : prev.filter((id) => id !== item.id),
 );
 }}
 />
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ fontWeight: 500 }}>{item.name}</div>
 <div style={{ fontSize: 12, color: '#8c8c8c' }}>
 {item.sku ? `${t('sku')}: ${item.sku}` : ''}
 {item.price != null
 ? ` · ${Number(item.price).toLocaleString('en-IQ')} IQD`
 : ''}
 </div>
 </div>
 </label>
 );
 })}
 </Space>
 )}
 </div>
 <Text type="secondary" style={{ fontSize: 12 }}>
 {t('pos.pull_selected_count', {
 count: pullSelected.length,
 defaultValue: '{{count}} item(s) selected',
 })}
 </Text>
 </Space>
 </FormDialog>

 {/* ── Create-new-POS-item modal ─────────────────────────────────── */}
 <FormDialog
 open={createModalOpen}
 onClose={() => setCreateModalOpen(false)}
 onOk={() => createForm.submit()}
 title={t('pos.create_new_item', 'Create new item')}
 confirmLoading={createSaving}
 >
 <Form form={createForm} layout="vertical" onFinish={handleCreateSave}>
 <Form.Item
 name="name"
 label={t('name')}
 rules={[{ required: true, message: t('required_field', 'Required') }]}
 >
 <Input placeholder={t('pos.item_name_placeholder', 'e.g. Cola can 330ml')} />
 </Form.Item>
 <Form.Item name="name_ku" label={t('name_ku', 'Name (Kurdish)')}>
 <Input placeholder={t('pos.item_name_ku_placeholder', 'بۆ نموونە: کۆلا ٣٣٠ مل')} />
 </Form.Item>
 <Space style={{ width: '100%' }} size="middle" wrap>
 <Form.Item name="sku" label={t('sku', 'SKU')} style={{ minWidth: 160 }}>
 <Input />
 </Form.Item>
 <Form.Item name="barcode" label={t('barcode', 'Barcode')} style={{ minWidth: 160 }}>
 <Input />
 </Form.Item>
 </Space>
 <Space style={{ width: '100%' }} size="middle" wrap>
 <Form.Item
 name="selling_price"
 label={t('selling_price', 'Selling price')}
 style={{ minWidth: 160 }}
 rules={[{ required: true, message: t('required_field', 'Required') }]}
 >
 <InputNumber min={0} style={{ width: '100%' }} addonAfter="IQD" />
 </Form.Item>
 <Form.Item name="cost_price" label={t('cost_price', 'Cost price')} style={{ minWidth: 160 }}>
 <InputNumber min={0} style={{ width: '100%' }} addonAfter="IQD" />
 </Form.Item>
 </Space>
 <Space style={{ width: '100%' }} size="middle" wrap>
 <Form.Item name="item_type" label={t('item_type', 'Type')} style={{ minWidth: 160 }}>
 <Select
 options={[
 { value: 'goods', label: t('enums.item_type.goods', 'Goods') },
 { value: 'service', label: t('enums.item_type.service', 'Service') },
 ]}
 />
 </Form.Item>
 <Form.Item name="unit" label={t('unit', 'Unit')} style={{ minWidth: 120 }}>
 <Input />
 </Form.Item>
 </Space>
 <Form.Item name="pos_category_id" label={t('pos.category', 'POS category')}>
 <Select
 options={categoryOptions}
 allowClear
 showSearch
 optionFilterProp="label"
 placeholder={t('pos.pick_category_optional', 'Pick a category (optional)')}
 />
 </Form.Item>
 <Form.Item name="image_url" label={t('pos.image_url', 'Image URL')}>
 <Input placeholder="https://…" />
 </Form.Item>
 <Form.Item name="description" label={t('description', 'Description')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 </Form>
 </FormDialog>
 </Card>
 );
};

export default POSProducts;
