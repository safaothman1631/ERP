import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, Select, Switch, Card, Tag, Image } from 'antd';
import { useTranslation } from 'react-i18next';
import { EditOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../../design-system';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const POSProducts: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [categories, setCategories] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [editingItem, setEditingItem] = useState<any>(null);
 const [form] = Form.useForm();
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
 }, []);

 const handleSearch = () => {
 fetchData(1);
 };

 const openModal = (record: any) => {
 setEditingItem(record);
 form.setFieldsValue({
 pos_category_id: record.category_id,
 image_url: record.image_url,
 available_in_pos: true,
 });
 setModalVisible(true);
 };

 const handleSubmit = async (values: any) => {
 try {
 // Update item via items API
 await api.put(`/api/items/${editingItem.id}`, {
 pos_category_id: values.pos_category_id,
 image_url: values.image_url,
 available_in_pos: values.available_in_pos,
 });
 message.success(t('success'));
 setModalVisible(false);
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
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
 render: (val: number) => val.toLocaleString('en-IQ') + ' IQD',
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
 <Tag color={val > 0 ? 'green' : 'red'}>{val}</Tag>
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Button icon={<EditOutlined />} onClick={() => openModal(record)}>
 {t('edit')}
 </Button>
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
 try { localStorage.setItem('posProducts.hiddenCols', JSON.stringify(next)); } catch {}
 };

 return (
 <Card title={t('pos.products')}>
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

 <FormDialog
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => form.submit()}
 title={t('pos.edit_product')}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
 </Card>
 );
};

export default POSProducts;
