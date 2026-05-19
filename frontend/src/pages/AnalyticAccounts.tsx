import React, { useEffect, useState } from 'react';
import { Button, Space, Input, Form, Switch, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

const AnalyticAccounts: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modal, setModal] = useState(false);
 const [editing, setEditing] = useState<any>(null);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/analytic/accounts');
 setData(Array.isArray(res.data) ? res.data : []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchData();
 }, []);

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.put(`/api/analytic/accounts/${editing.id}`, values);
 } else {
 await api.post('/api/analytic/accounts', values);
 }
 message.success(t('success'));
 setModal(false);
 form.resetFields();
 setEditing(null);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/analytic/accounts/${id}`);
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

 const columns = [
 { title: t('code'), dataIndex: 'code', key: 'code' },
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('active'), dataIndex: 'active', key: 'active', render: (v: boolean) => (v ? t('yes') : t('no')) },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('analytic_accounts')}
 subtitle={t('analytic_accounts_subtitle', 'Analytic accounts for cost analysis')}
 helpKey="analytic"
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
 {t('new')}
 </Button>
 }
 />
 <ResponsiveTableAdapter dataSource={data} columns={columns} rowKey="id" loading={loading} />

 <FormDialog
 title={editing ? t('edit') : t('new')}
 open={modal}
 onClose={() => { setModal(false); form.resetFields(); setEditing(null); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="code" label={t('code')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="active" label={t('active')} valuePropName="checked" initialValue={true}>
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default AnalyticAccounts;
