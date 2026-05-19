import { useEffect, useState } from 'react';
import { Button, Form, Input, Select, Space, Tag, Popconfirm, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader } from '../../design-system';
import api from '../../api';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Company {
 id: string;
 name: string;
 code: string;
 currency: string;
 tax_id?: string;
 address?: string;
 phone?: string;
 email?: string;
 is_primary?: boolean;
 is_active?: boolean;
}

const CompaniesList = () => {
 const { t } = useTranslation();
 const [loading, setLoading] = useState(false);
 const [companies, setCompanies] = useState<Company[]>([]);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();

 const fetchCompanies = async () => {
 setLoading(true);
 try {
 const { data } = await api.get('/api/companies');
 setCompanies(data);
 } catch (err) {
 message.error(t('multi_entity.error_loading_companies'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchCompanies();
 }, []);

 const handleCreate = () => {
 setEditingId(null);
 form.resetFields();
 setDrawerOpen(true);
 };

 const handleEdit = (record: Company) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setDrawerOpen(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 if (editingId) {
 await api.put(`/api/companies/${editingId}`, values);
 message.success(t('multi_entity.company_updated'));
 } else {
 await api.post('/api/companies', values);
 message.success(t('multi_entity.company_created'));
 }
 setDrawerOpen(false);
 fetchCompanies();
 } catch (err) {
 message.error(t('multi_entity.error_saving_company'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/companies/${id}`);
 message.success(t('multi_entity.company_deleted'));
 fetchCompanies();
 } catch (err) {
 message.error(t('multi_entity.error_deleting_company'));
 }
 };

 const handleSwitch = async (id: string) => {
 try {
 await api.post(`/api/companies/${id}/switch`);
 message.success(t('multi_entity.company_switched'));
 } catch (err) {
 message.error(t('multi_entity.error_switching_company'));
 }
 };

 const columns: ColumnsType<Company> = [
 {
 title: t('multi_entity.company_name'),
 dataIndex: 'name',
 key: 'name',
 render: (text, record) => (
 <Space>
 {text}
 {record.is_primary && <Tag color="blue">{t('multi_entity.base_entity')}</Tag>}
 </Space>
 ),
 },
 {
 title: t('multi_entity.code'),
 dataIndex: 'code',
 key: 'code',
 },
 {
 title: t('multi_entity.currency'),
 dataIndex: 'currency',
 key: 'currency',
 },
 {
 title: t('multi_entity.tax_id'),
 dataIndex: 'tax_id',
 key: 'tax_id',
 },
 {
 title: t('multi_entity.status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (active) => (
 <Tag color={active ? 'green' : 'red'}>
 {active ? t('multi_entity.active') : t('multi_entity.inactive')}
 </Tag>
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_, record) => (
 <Space>
 <Button
 type="link"
 icon={<SwapOutlined />}
 onClick={() => handleSwitch(record.id)}
 disabled={record.is_primary}
 >
 {t('multi_entity.switch')}
 </Button>
 <Button
 type="link"
 icon={<EditOutlined />}
 onClick={() => handleEdit(record)}
 disabled={record.is_primary}
 />
 {!record.is_primary && (
 <Popconfirm
 title={t('multi_entity.confirm_delete_company')}
 onConfirm={() => handleDelete(record.id)}
 >
 <Button type="link" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 )}
 </Space>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('multi_entity.companies')}
 subtitle={t('multi_entity.companies_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('multi_entity.add_company')}
 </Button>
 }
 />
 <Card>
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={companies}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </Card>

 <FormDialog
 title={editingId ? t('multi_entity.edit_company') : t('multi_entity.add_company')}
 open={drawerOpen}
 onClose={() => setDrawerOpen(false)}
 footer={
 <Space style={{ float: 'right' }}>
 <Button onClick={() => setDrawerOpen(false)}>{t('cancel')}</Button>
 <Button type="primary" onClick={handleSave}>
 {t('save')}
 </Button>
 </Space>
 }
 >
 <Form form={form} layout="vertical">
 <Form.Item
 name="name"
 label={t('multi_entity.company_name')}
 rules={[{ required: true, message: t('multi_entity.name_required') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item
 name="code"
 label={t('multi_entity.code')}
 rules={[{ required: true, message: t('multi_entity.code_required') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item
 name="currency"
 label={t('multi_entity.currency')}
 rules={[{ required: true, message: t('multi_entity.currency_required') }]}
 >
 <Select>
 <Select.Option value="IQD">IQD</Select.Option>
 <Select.Option value="USD">USD</Select.Option>
 <Select.Option value="EUR">EUR</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="tax_id" label={t('multi_entity.tax_id')}>
 <Input />
 </Form.Item>
 <Form.Item name="address" label={t('multi_entity.address')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="phone" label={t('multi_entity.phone')}>
 <Input />
 </Form.Item>
 <Form.Item name="email" label={t('multi_entity.email')}>
 <Input />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default CompaniesList;
