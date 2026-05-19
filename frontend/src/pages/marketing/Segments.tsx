import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Card, Popconfirm, Tag } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const Segments: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [createModal, setCreateModal] = useState(false);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [previewModal, setPreviewModal] = useState<string | null>(null);
 const [previewData, setPreviewData] = useState<any[]>([]);
 const [previewLoading, setPreviewLoading] = useState(false);

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/marketing/audiences');
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, []);

 const handleCreate = async (values: any) => {
 setSaving(true);
 try {
 await api.post('/api/marketing/audiences', values);
 message.success(t('success'));
 setCreateModal(false);
 form.resetFields();
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/marketing/audiences/${id}`);
 message.success(t('deleted'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handlePreview = async (id: string) => {
 setPreviewModal(id);
 setPreviewLoading(true);
 try {
 const res = await api.get(`/api/marketing/audiences/${id}/preview`);
 setPreviewData(res.data.members || []);
 } catch {
 message.error(t('error'));
 } finally {
 setPreviewLoading(false);
 }
 };

 const columns: any[] = [
 { title: t('marketing.name'), dataIndex: 'name', key: 'name' },
 {
 title: t('marketing.source'),
 dataIndex: 'source',
 key: 'source',
 render: (val: string) => <Tag>{val || 'contacts'}</Tag>,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, rec: any) => (
 <Space>
 <Button icon={<EyeOutlined />} onClick={() => handlePreview(rec.id)}>
 {t('marketing.preview')}
 </Button>
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(rec.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 const previewColumns: any[] = [
 { title: t('marketing.name'), dataIndex: 'name', key: 'name' },
 { title: t('marketing.email'), dataIndex: 'email', key: 'email' },
 ];

 return (
 <div>
 <PageHeader
 title={t('marketing.segments')}
 subtitle={t('marketing.segments_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
 {t('create')}
 </Button>
 }
 />

 <ResponsiveTableAdapter columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />

 <FormDialog
 title={t('marketing.create_segment')}
 open={createModal}
 onClose={() => setCreateModal(false)} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleCreate}>
 <Form.Item name="name" label={t('marketing.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="source" label={t('marketing.source')} initialValue="contacts">
 <Select
 options={[
 { label: t('contacts'), value: 'contacts' },
 { label: t('leads'), value: 'leads' },
 { label: t('marketing.manual'), value: 'manual' },
 ]}
 />
 </Form.Item>
 <Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>
 {t('create')}
 </Button>
 <Button onClick={() => setCreateModal(false)}>{t('cancel')}</Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('marketing.segment_preview')}
 open={!!previewModal}
 onClose={() => setPreviewModal(null)} hideFooter
 >
 <Card loading={previewLoading}>
 <p>
 {t('marketing.total_members')}: <strong>{previewData.length}</strong>
 </p>
 <ResponsiveTableAdapter
 columns={previewColumns}
 dataSource={previewData}
 rowKey="id"
 pagination={{ pageSize: 10 }}
 />
 </Card>
 </FormDialog>
 </div>
 );
};

export default Segments;
