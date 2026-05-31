import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, Space, Switch, Tag, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space } from '../theme/tokens';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

export default function Branches() {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [form] = Form.useForm();
 const [editId, setEditId] = useState<string | null>(null);
 const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('branches.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchData = async (page = 1) => {
 setLoading(true);
 try {
 const res = await api.get('/api/branches');
 const items = Array.isArray(res.data) ? res.data : (res.data.items || []);
 setData(items);
 setPagination(p => ({ ...p, total: items.length, current: page }));
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
 if (editId) {
 await api.put(`/api/branches/${editId}`, values);
 message.success(t('updated'));
 } else {
 await api.post('/api/branches', values);
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
 await api.delete(`/api/branches/${id}`);
 message.success(t('deleted'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleToggleActive = async (id: string, isActive: boolean) => {
 try {
 await api.put(`/api/branches/${id}`, { is_active: !isActive });
 message.success(t('updated'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (record: any) => {
 setEditId(record.id);
 form.setFieldsValue(record);
 setModalVisible(true);
 };

 const columns = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('code'), dataIndex: 'code', key: 'code' },
 { title: t('address'), dataIndex: 'address', key: 'address' },
 { title: t('phone'), dataIndex: 'phone', key: 'phone' },
 {
 title: t('head_office'),
 dataIndex: 'is_head_office',
 key: 'is_head_office',
 render: (v: boolean) => (v ? <Tag color="blue">{t('yes')}</Tag> : <Tag>{t('no')}</Tag>),
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (isActive: boolean, record: any) => (
 <Switch
 checked={isActive}
 onChange={() => handleToggleActive(record.id, isActive)}
 checkedChildren={t('active')}
 unCheckedChildren={t('inactive')}
 />
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
 <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
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
 try { localStorage.setItem('branches.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('branches')}
 subtitle={t('branches_subtitle', 'Manage branches')}
 extra={
 <Space>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditId(null);
 form.resetFields();
 setModalVisible(true);
 }}
 >
 {t('add')}
 </Button>
 </Space>
 }
 />
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: space.md }}>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('branches', data, cols);
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
 pagination={{ ...pagination, onChange: fetchData }}
 />
 <FormDialog
 title={editId ? t('edit') : t('add')}
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true }]}>
 <Input placeholder={t('name')} />
 </Form.Item>
 <Form.Item label={t('code')} name="code" rules={[{ required: true }]}>
 <Input placeholder={t('code')} />
 </Form.Item>
 <Form.Item label={t('address')} name="address">
 <Input.TextArea rows={2} placeholder={t('address')} />
 </Form.Item>
 <Form.Item label={t('phone')} name="phone">
 <Input placeholder={t('phone')} />
 </Form.Item>
 <Form.Item label={t('head_office')} name="is_head_office" valuePropName="checked" initialValue={false}>
 <Switch checkedChildren={t('yes')} unCheckedChildren={t('no')} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
