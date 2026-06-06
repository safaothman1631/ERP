import React, { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface AssetCategory {
 id: string;
 name: string;
 default_useful_life_months: number;
 default_method: string;
 default_salvage_pct: number;
 asset_account_id: string;
 accumulated_depreciation_account_id: string;
 depreciation_expense_account_id: string;
}

const AssetCategories: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<AssetCategory[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [accounts, setAccounts] = useState<{ id: string; name: string; code: string }[]>([]);

 const fetchData = async () => {
 setLoading(true);
 try {
 const r = await api.get('/api/fixed-assets/asset-categories');
 setData(r.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchAccounts = async () => {
 try {
 const r = await api.get('/api/accounts', { params: { page_size: 500 } });
 setAccounts(r.data.items || r.data || []);
 } catch {
 // Ignore
 }
 };

 useEffect(() => {
 fetchData();
 fetchAccounts();
 }, []);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ default_useful_life_months: 60, default_method: 'straight_line', default_salvage_pct: 0 });
 setModalOpen(true);
 };

 const openEdit = (record: AssetCategory) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 if (editingId) {
 await api.put(`/api/fixed-assets/asset-categories/${editingId}`, values);
 } else {
 await api.post('/api/fixed-assets/asset-categories', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 fetchData();
 } catch (err: unknown) {
 const errorDetail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
 message.error(errorDetail || t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/fixed-assets/asset-categories/${id}`);
 message.success(t('success'));
 fetchData();
 } catch (err: unknown) {
 const errorDetail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
 message.error(errorDetail || t('error'));
 }
 };

 const columns = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('assets.useful_life'), dataIndex: 'default_useful_life_months', key: 'life', render: (v: number) => `${v} ${t('months')}` },
 { title: t('assets.depreciation_method'), dataIndex: 'default_method', key: 'method', render: (v: string) => t(`assets.${v}`) },
 {
 title: t('action'),
 key: 'action',
 render: (_: unknown, record: AssetCategory) => (
 <Space>
 <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(record.id)}>
 <Button type="link" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <>
 <PageHeader title={t('assets.categories')} extra={<Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new')}</Button>} />
 <ResponsiveTableAdapter columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
 <FormDialog
 title={editingId ? t('edit') : t('new')}
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 onOk={() => form.submit()}
 confirmLoading={saving}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="default_useful_life_months" label={t('assets.useful_life_months')} rules={[{ required: true }]}>
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="default_method" label={t('assets.depreciation_method')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="straight_line">{t('assets.straight_line')}</Select.Option>
 <Select.Option value="declining_balance">{t('assets.declining_balance')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="default_salvage_pct" label={t('assets.salvage_pct')} rules={[{ required: true }]}>
 <InputNumber min={0} max={100} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="asset_account_id" label={t('assets.asset_account')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children" filterOption={(input: string, option?: { children?: string }) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
 {accounts.map((a) => (
 <Select.Option key={a.id} value={a.id}>{`${a.code} - ${a.name}`}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="accumulated_depreciation_account_id" label={t('assets.accumulated_depreciation_account')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children" filterOption={(input: string, option?: { children?: string }) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
 {accounts.map((a) => (
 <Select.Option key={a.id} value={a.id}>{`${a.code} - ${a.name}`}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="depreciation_expense_account_id" label={t('assets.depreciation_expense_account')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children" filterOption={(input: string, option?: { children?: string }) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
 {accounts.map((a) => (
 <Select.Option key={a.id} value={a.id}>{`${a.code} - ${a.name}`}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default AssetCategories;
