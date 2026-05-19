import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Input, Tag, Form, Select, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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

const { Option } = Select;

const Contacts: React.FC = () => {
 const { t } = useTranslation();
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
 try { return JSON.parse(localStorage.getItem('contacts.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 // AddGate: wire Selective Add for contacts section (R9.1, R9.5)
 const addGate = useAddGate('contacts.list');

 const fetchData = async (forceRetry = false) => {
 setLoading(true);
 try {
 const res = await api.get('/api/contacts', {
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
 // Convert empty strings to null so Pydantic EmailStr validation passes
 const payload = Object.fromEntries(
 Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])
 );
 try {
 if (editing) {
 await api.put(`/api/contacts/${editing.id}`, payload);
 } else {
 await api.post('/api/contacts', payload);
 }
 message.success(t('success'));
 setModal(false);
 form.resetFields();
 setEditing(null);
 fetchData();
 } catch { message.error(t('error')); }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/contacts/${id}`);
 message.success(t('success'));
 fetchData();
 },
 });
 };

 const openEdit = (record: any) => {
 setEditing(record);
 form.setFieldsValue(record);
 setModal(true);
 };

 const handleBulkDelete = () => {
 Modal.confirm({
 title: t('are_you_sure'),
 content: t('data_table_v2.delete_n_confirm', 'Delete {{n}} items?', { n: selectedIds.length }),
 okButtonProps: { danger: true },
 onOk: async () => {
 await Promise.all(selectedIds.map((id) => api.delete(`/api/contacts/${id}`)));
 message.success(t('success'));
 setSelectedIds([]);
 fetchData();
 },
 });
 };

 const allColumns = [
 { title: t('display_name'), dataIndex: 'display_name', key: 'display_name' },
 { title: t('contact_type'), dataIndex: 'contact_type', key: 'contact_type', render: (v: string) => <Tag color={v === 'customer' ? 'blue' : 'orange'}>{t(v)}</Tag> },
 { title: t('email'), dataIndex: 'email', key: 'email' },
 { title: t('phone'), dataIndex: 'phone', key: 'phone' },
 { title: t('company_name'), dataIndex: 'company_name', key: 'company_name' },
 {
 title: t('actions'), key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'display_name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('contacts.hiddenCols', JSON.stringify(next)); } catch {}
 };

 return (
 <div data-addgate-section="contacts.list">
 <PageHeader
 title={t('contacts')}
 subtitle={t('contacts_subtitle', 'Customers and vendors')}
 helpKey="contacts"
 sectionId="contacts.list"
 extra={
 <Space>
 <ExportButton endpoint="/api/export/customers" filename="customers" />
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }} data-add-action="contacts.list">
 {t('new_contact')}
 </Button>
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
 <Input
 prefix={<SearchOutlined />}
 placeholder={t('search')}
 value={search}
 onChange={(e) => { setSearch(e.target.value); setPage(1); }}
 style={{ width: 320 }}
 allowClear
 />
 <Space>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('contacts', data, cols);
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

 <FormDialog
 title={editing ? t('edit') : t('new_contact')}
 open={modal}
 onClose={() => { setModal(false); setEditing(null); form.resetFields(); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ contact_type: 'customer' }}>
 <Form.Item label={t('contact_type')} name="contact_type" rules={[{ required: true, message: t('required_field') }]}>
 <Select placeholder={t('placeholder_select')}>
 <Option value="customer">{t('customer')}</Option>
 <Option value="vendor">{t('vendor')}</Option>
 </Select>
 </Form.Item>
 <Form.Item label={t('display_name')} name="display_name" rules={[{ required: true, message: t('required_name') }]}>
 <Input placeholder={t('placeholder_name')} />
 </Form.Item>
 <Form.Item label={t('company_name')} name="company_name">
 <Input placeholder={t('placeholder_company')} />
 </Form.Item>
 <Form.Item label={t('email')} name="email" rules={[{ type: 'email', message: t('invalid_email') }]}>
 <Input placeholder={t('placeholder_email')} />
 </Form.Item>
 <Form.Item label={t('phone')} name="phone">
 <Input placeholder={t('placeholder_phone')} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Contacts;
