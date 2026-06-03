import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, Select, Space, Switch, Modal, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

type EntityTab = 'all' | 'invoice' | 'quote' | 'contact' | 'item' | 'expense' | 'bill' | 'sales_order' | 'purchase_order';

export default function CustomFields() {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [form] = Form.useForm();
 const [editId, setEditId] = useState<string | null>(null);
 const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
 const [fieldType, setFieldType] = useState<string>('text');
 const [tab, setTab] = useState<EntityTab>('all');
 const [fieldTypeFilter, setFieldTypeFilter] = useState<string>('');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('customFields.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async (page = 1) => {
 setLoading(true);
 try {
 const res = await api.get('/api/custom-fields', { params: { page, page_size: pagination.pageSize } });
 setData(res.data.items || []);
 setPagination(p => ({ ...p, total: res.data.total || 0, current: page }));
 } catch {
 message.error(t('error'));
 }
 setLoading(false);
 };

 useEffect(() => {
 fetchData();
 }, []);

 const handleSubmit = async (values: any) => {
 try {
 const payload = {
 ...values,
 options: values.options ? values.options.split(',').map((o: string) => o.trim()) : [],
 };
 if (editId) {
 await api.put(`/api/custom-fields/${editId}`, payload);
 message.success(t('updated'));
 } else {
 await api.post('/api/custom-fields', payload);
 message.success(t('created'));
 }
 setModalVisible(false);
 form.resetFields();
 setEditId(null);
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('confirmDelete'),
 onOk: async () => {
 try {
 await api.delete(`/api/custom-fields/${id}`);
 message.success(t('deleted'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleEdit = (record: any) => {
 setEditId(record.id);
 setFieldType(record.field_type || 'text');
 form.setFieldsValue({
 ...record,
 options: record.options?.join(', ') || '',
 });
 setModalVisible(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: any) => {
 setEditId(null);
 const { id: _id, ...rest } = record;
 setFieldType(record.field_type || 'text');
 form.setFieldsValue({
 ...rest,
 options: record.options?.join(', ') || '',
 field_name: `${record.field_name ?? ''} (${t('copy', 'copy')})`,
 });
 setModalVisible(true);
 };

 // Kit list tabs (entity type segments) — client-side filter on data already fetched.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'invoice', label: t('invoice', 'Invoice') },
 { key: 'quote', label: t('quote', 'Quote') },
 { key: 'contact', label: t('contact', 'Contact') },
 { key: 'item', label: t('item', 'Item') },
 { key: 'expense', label: t('expense', 'Expense') },
 { key: 'bill', label: t('bill', 'Bill') },
 { key: 'sales_order', label: t('sales_order', 'Sales Order') },
 { key: 'purchase_order', label: t('purchase_order', 'Purchase Order') },
 ];

 // Client-side filtering for tabs + field type + search (API has no filter params; keeps logic unchanged).
 const filteredData = useMemo(() => {
 const q = search.trim().toLowerCase();
 return data.filter((r) => {
 if (tab !== 'all' && r.entity_type !== tab) return false;
 if (fieldTypeFilter && r.field_type !== fieldTypeFilter) return false;
 if (q && !Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
 return true;
 });
 }, [data, tab, fieldTypeFilter, search]);

 const allColumns = [
 {
 title: t('field_name'), dataIndex: 'field_name', key: 'field_name',
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
 title: t('entity_type'), dataIndex: 'entity_type', key: 'entity_type',
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(v)}</span>
 ),
 },
 {
 title: t('field_type'),
 dataIndex: 'field_type',
 key: 'field_type',
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{v}</span>
 ),
 },
 {
 title: t('required'),
 dataIndex: 'is_required',
 key: 'is_required',
 render: (v: boolean) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: v ? 'var(--danger-soft, var(--surface-2))' : 'var(--surface-2)',
 border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600,
 color: v ? 'var(--danger-500, var(--ink-600))' : 'var(--ink-600)',
 }}>{v ? t('yes') : t('no')}</span>
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
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
 const visibleColumns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'field_name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('customFields.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const activeFilterCount = (tab !== 'all' ? 1 : 0) + (fieldTypeFilter ? 1 : 0);

 return (
 <div>
 <PageHeader
 title={t('custom_fields')}
 subtitle={t('custom_fields_subtitle', 'Custom fields')}
 extra={
 <Space>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditId(null);
 setFieldType('text');
 form.resetFields();
 setModalVisible(true);
 }}
 >
 {t('add')}
 </Button>
 </Space>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as EntityTab); setPagination(p => ({ ...p, current: 1 })); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={activeFilterCount}
 onClear={() => { setTab('all'); setFieldTypeFilter(''); setPagination(p => ({ ...p, current: 1 })); }}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
 <div>
 <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 6 }}>
 {t('entity_type', 'Entity type')}
 </div>
 <Radio.Group
 value={tab}
 onChange={(e) => { setTab(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="invoice">{t('invoice', 'Invoice')}</Radio>
 <Radio value="quote">{t('quote', 'Quote')}</Radio>
 <Radio value="contact">{t('contact', 'Contact')}</Radio>
 <Radio value="item">{t('item', 'Item')}</Radio>
 <Radio value="expense">{t('expense', 'Expense')}</Radio>
 <Radio value="bill">{t('bill', 'Bill')}</Radio>
 <Radio value="sales_order">{t('sales_order', 'Sales Order')}</Radio>
 <Radio value="purchase_order">{t('purchase_order', 'Purchase Order')}</Radio>
 </Radio.Group>
 </div>
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('field_type', 'Field type')}
 anyLabel={t('all', 'All')}
 value={fieldTypeFilter}
 onChange={(v) => { setFieldTypeFilter(v); setPagination(p => ({ ...p, current: 1 })); }}
 options={[
 { value: 'text', label: 'Text' },
 { value: 'number', label: 'Number' },
 { value: 'date', label: 'Date' },
 { value: 'select', label: 'Select' },
 { value: 'boolean', label: 'Boolean' },
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
 downloadCsv('custom-fields', filteredData, cols);
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
 pagination={{ ...pagination, onChange: fetchData }}
 />
 </KitListCard>
 <FormDialog
 title={editId ? t('edit') : t('add')}
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item label={t('entity_type')} name="entity_type" rules={[{ required: true }]}>
 <Select
 placeholder={t('select')}
 options={[
 { label: t('invoice'), value: 'invoice' },
 { label: t('quote'), value: 'quote' },
 { label: t('contact'), value: 'contact' },
 { label: t('item'), value: 'item' },
 { label: t('expense'), value: 'expense' },
 { label: t('bill'), value: 'bill' },
 { label: t('sales_order'), value: 'sales_order' },
 { label: t('purchase_order'), value: 'purchase_order' },
 ]}
 />
 </Form.Item>
 <Form.Item label={t('field_name')} name="field_name" rules={[{ required: true }]}>
 <Input placeholder={t('field_name')} />
 </Form.Item>
 <Form.Item label={t('field_type')} name="field_type" rules={[{ required: true }]} initialValue="text">
 <Select
 placeholder={t('select')}
 onChange={setFieldType}
 options={[
 { label: 'Text', value: 'text' },
 { label: 'Number', value: 'number' },
 { label: 'Date', value: 'date' },
 { label: 'Select', value: 'select' },
 { label: 'Boolean', value: 'boolean' },
 ]}
 />
 </Form.Item>
 {fieldType === 'select' && (
 <Form.Item label={t('options')} name="options" extra={t('comma_separated')}>
 <Input placeholder="Option1, Option2, Option3" />
 </Form.Item>
 )}
 <Form.Item label={t('required')} name="is_required" valuePropName="checked" initialValue={false}>
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
