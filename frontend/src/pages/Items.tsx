import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Input, Form, InputNumber, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api, { backendRetryConfig, isBackendUnavailableError } from '../api';
import ExportButton from '../components/ExportButton';
import { EmptyState, PageHeader, BulkActionBar, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space } from '../theme/tokens';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';
import { EmptyState as AddGateEmptyState } from '../components/AddGate/EmptyState';
import { asTranslationKey } from '../i18n/types';

const Items: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [modal, setModal] = useState(false);
 const [editing, setEditing] = useState<any>(null);
 const [form] = Form.useForm();
 const [backendUnavailable, setBackendUnavailable] = useState(false);
 const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('items.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 // AddGate: wire Selective Add for items section (R9.1, R9.5)
 const addGate = useAddGate('inventory.items');

 const fetchData = async (forceRetry = false) => {
 setLoading(true);
 try {
 const res = await api.get('/api/items', {
 params: { page, search, page_size: 20 },
 ...(forceRetry ? backendRetryConfig : {}),
 });
 setData(res.data.items);
 setTotal(res.data.total);
 setBackendUnavailable(false);
 } catch (error) {
 if (isBackendUnavailableError(error)) {
 setBackendUnavailable(true);
 setData([]);
 setTotal(0);
 } else {
 message.error(t('error'));
 }
 } finally { setLoading(false); }
 };

 useEffect(() => { void fetchData(); }, [page, search]);

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(total); }, [total, addGate.setRecordCount]);

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.put(`/api/items/${editing.id}`, values);
 } else {
 await api.post('/api/items', values);
 }
 message.success(t('success'));
 setModal(false); form.resetFields(); setEditing(null); fetchData();
 } catch { message.error(t('error')); }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => { await api.delete(`/api/items/${id}`); message.success(t('success')); fetchData(); },
 });
 };

 const handleBulkDelete = () => {
 Modal.confirm({
 title: t('are_you_sure'),
 content: t('data_table_v2.delete_n_confirm', 'Delete {{n}} items?', { n: selectedIds.length }),
 okButtonProps: { danger: true },
 onOk: async () => {
 await Promise.all(selectedIds.map((id) => api.delete(`/api/items/${id}`)));
 message.success(t('success'));
 setSelectedIds([]);
 fetchData();
 },
 });
 };

 const allColumns = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('sku'), dataIndex: 'sku', key: 'sku' },
 { title: t('selling_price'), dataIndex: 'selling_price', key: 'selling_price', render: (v: number) => v?.toLocaleString() },
 { title: t('cost_price'), dataIndex: 'cost_price', key: 'cost_price', render: (v: number) => v?.toLocaleString() },
 { title: t('stock'), dataIndex: 'stock_on_hand', key: 'stock_on_hand' },
 {
 title: t('actions'), key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => { setEditing(record); form.setFieldsValue(record); setModal(true); }} />
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
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
 try { localStorage.setItem('items.hiddenCols', JSON.stringify(next)); } catch {}
 };

 return (
 <div data-addgate-section="inventory.items">
 <PageHeader
 title={t('items')}
 subtitle={t('items_subtitle', 'Items and services')}
 helpKey="items"
 sectionId="inventory.items"
 extra={
 <Space>
 <ExportButton endpoint="/api/export/products" filename="products" />
 <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/items/new')} data-add-action="inventory.items">{t('new_item')}</Button>
 </Space>
 }
 />
 {backendUnavailable ? (
 <EmptyState
 icon={<WarningOutlined />}
 title={t('backend_unavailable_title')}
 description={t('backend_unavailable_description')}
 actionLabel={t('retry')}
 onAction={() => void fetchData(true)}
 />
 ) : (
 <>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: space.md, alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
 <Input prefix={<SearchOutlined />} placeholder={t('search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 320 }} allowClear />
 <Space>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('items', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </Space>
 </div>

 <ResponsiveTableAdapter
 dataSource={data}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
 rowSelection={{
 selectedRowKeys: selectedIds,
 onChange: (keys) => setSelectedIds(keys),
 }}
 />
 <BulkActionBar
 selectedCount={selectedIds.length}
 onClear={() => setSelectedIds([])}
 isDark={isDark}
 actions={[
 { key: 'delete', label: t('delete'), icon: <DeleteOutlined />, danger: true, onClick: handleBulkDelete },
 ]}
 />
 </>
 )}

 <FormDialog title={editing ? t('edit') : t('new_item')} open={modal} onClose={() => { setModal(false); setEditing(null); form.resetFields(); }} onOk={() => form.submit()}>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ item_type: 'goods', selling_price: 0, cost_price: 0 }}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]}><Input placeholder={t('placeholder_item_name')} /></Form.Item>
 <Form.Item label={t('sku')} name="sku"><Input placeholder={t('placeholder_sku')} /></Form.Item>
 <Form.Item label={t('description')} name="description"><Input.TextArea rows={2} placeholder={t('placeholder_description')} /></Form.Item>
 <Space style={{ width: '100%' }}>
 <Form.Item label={t('selling_price')} name="selling_price"><InputNumber min={0} style={{ width: 200 }} placeholder={t('placeholder_amount')} /></Form.Item>
 <Form.Item label={t('cost_price')} name="cost_price"><InputNumber min={0} style={{ width: 200 }} placeholder={t('placeholder_amount')} /></Form.Item>
 </Space>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Items;
