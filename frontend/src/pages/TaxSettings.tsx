import React, { useEffect, useState } from 'react';
import { Tabs, Button, Form, Input, InputNumber, Space, Popconfirm } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

const TaxSettings: React.FC = () => {
 const { t } = useTranslation();
 return (
 <Tabs defaultActiveKey="rates" items={[
 { key: 'rates', label: t('tax_rates'), children: <TaxRates /> },
 { key: 'groups', label: t('tax_groups'), children: <TaxGroups /> },
 ]} />
 );
};

const TaxRates: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);

 const fetchData = () => {
 setLoading(true);
 api.get('/api/taxes/rates').then(r => setData(Array.isArray(r.data) ? r.data : (r.data.items || [] || []))).catch((e) => console.error(e)).finally(() => setLoading(false));
 };

 useEffect(() => { fetchData(); }, []);

 const handleSave = async (values: any) => {
 setSaving(true);
 try { await api.post('/api/taxes/rates', values); message.success(t('success')); setModalOpen(false); fetchData(); }
 catch { message.error(t('error')); } finally { setSaving(false); }
 };

 const handleDelete = async (id: string) => {
 try { await api.delete(`/api/taxes/rates/${id}`); message.success(t('success')); fetchData(); } catch { message.error(t('error')); }
 };

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>{t('new_tax_rate')}</Button>
 </div>
 <ResponsiveTableAdapter dataSource={data} columns={[
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: '%', dataIndex: 'rate', key: 'rate', render: (v: number) => `${v}%` },
 { title: t('type'), dataIndex: 'tax_type', key: 'tax_type' },
 { title: t('actions'), key: 'actions', render: (_: any, r: any) => (
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(r.id)}><Button danger icon={<DeleteOutlined />} /></Popconfirm>
 )},
 ]} rowKey="id" loading={loading} />
 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('new_tax_rate')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]}><Input placeholder={t('placeholder_name')} /></Form.Item>
 <Form.Item label={t('rate') + ' %'} name="rate" rules={[{ required: true, message: t('required_field') }]}><InputNumber min={0} max={100} style={{ width: '100%' }} placeholder={t('placeholder_amount')} /></Form.Item>
 <Form.Item label={t('type')} name="tax_type" initialValue="percentage"><Input placeholder={t('placeholder_description')} /></Form.Item>
 <Form.Item label={t('description')} name="description"><Input.TextArea rows={2} placeholder={t('placeholder_description')} /></Form.Item>
 <Space><Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button><Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button></Space>
 </Form>
 </FormDialog>
 </div>
 );
};

const TaxGroups: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);

 const fetchData = () => {
 setLoading(true);
 api.get('/api/taxes/groups').then(r => setData(Array.isArray(r.data) ? r.data : (r.data.items || [] || []))).catch((e) => console.error(e)).finally(() => setLoading(false));
 };

 useEffect(() => { fetchData(); }, []);

 const handleSave = async (values: any) => {
 setSaving(true);
 try {
 await api.post('/api/taxes/groups', { name: values.name, tax_rate_ids: values.tax_rate_ids?.split(',').map((s: string) => s.trim()) || [] });
 message.success(t('success')); setModalOpen(false); fetchData();
 } catch { message.error(t('error')); } finally { setSaving(false); }
 };

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>{t('new_tax_group')}</Button>
 </div>
 <ResponsiveTableAdapter dataSource={data} columns={[
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('description'), dataIndex: 'description', key: 'description' },
 ]} rowKey="id" loading={loading} />
 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('new_tax_group')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item label={t('tax_rate_ids')} name="tax_rate_ids"><Input placeholder="id1, id2, ..." /></Form.Item>
 <Space><Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button><Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button></Space>
 </Form>
 </FormDialog>
 </div>
 );
};

export default TaxSettings;
