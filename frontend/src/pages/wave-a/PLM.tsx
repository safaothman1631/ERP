import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Tag, message, Card, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { TextArea } = Input;

const PLM: React.FC = () => {
 const { t } = useTranslation();
 const [ecos, setEcos] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [editing, setEditing] = useState<any>(null);

 const fetchECOs = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/plm/ecos', { params: { limit: 100 } });
 setEcos(res.data.items || []);
 } catch (_error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchECOs();
 }, []);

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.patch(`/api/plm/ecos/${editing.id}`, values);
 } else {
 await api.post('/api/plm/ecos', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditing(null);
 void fetchECOs();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/plm/ecos/${id}`);
 message.success(t('success'));
 void fetchECOs();
 },
 });
 };

 const openEdit = (record: any) => {
 setEditing(record);
 form.setFieldsValue(record);
 setModalOpen(true);
 };

 const statusColors: Record<string, string> = {
 draft: 'default',
 review: 'blue',
 approved: 'green',
 implemented: 'cyan',
 rejected: 'red',
 };

 const columns = [
 { title: t('plm.eco_id'), dataIndex: 'id', key: 'id', width: 120 },
 { title: t('plm.title'), dataIndex: 'title', key: 'title' },
 { title: t('plm.product'), dataIndex: 'product_id', key: 'product_id' },
 { title: t('plm.type'), dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{t(`plm.type_${v}`)}</Tag> },
 { title: t('plm.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v] || 'default'}>{t(`plm.status_${v}`)}</Tag> },
 { title: t('plm.priority'), dataIndex: 'priority', key: 'priority', render: (v: string) => <Tag color={v === 'urgent' ? 'red' : v === 'high' ? 'orange' : 'default'}>{t(`priority_${v}`)}</Tag> },
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
 title={t('plm.title')}
 subtitle={t('plm.subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
 {t('plm.new_eco')}
 </Button>
 }
 />
 <Card style={{ marginTop: space.md }}>
 <ResponsiveTableAdapter dataSource={ecos} columns={columns} loading={loading} rowKey="id" />
 </Card>

 <FormDialog
 title={editing ? t('plm.edit_eco') : t('plm.new_eco')}
 open={modalOpen}
 onClose={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="title" label={t('plm.title')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="product_id" label={t('plm.product')} rules={[{ required: true }]}>
 <Input placeholder={t('plm.product_id_placeholder')} />
 </Form.Item>
 <Form.Item name="type" label={t('plm.type')} initialValue="change">
 <Select>
 <Select.Option value="change">{t('plm.type_change')}</Select.Option>
 <Select.Option value="new_part">{t('plm.type_new_part')}</Select.Option>
 <Select.Option value="obsolete">{t('plm.type_obsolete')}</Select.Option>
 <Select.Option value="deviation">{t('plm.type_deviation')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="priority" label={t('plm.priority')} initialValue="medium">
 <Select>
 <Select.Option value="low">{t('priority_low')}</Select.Option>
 <Select.Option value="medium">{t('priority_medium')}</Select.Option>
 <Select.Option value="high">{t('priority_high')}</Select.Option>
 <Select.Option value="urgent">{t('priority_urgent')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="reason" label={t('plm.reason')}>
 <TextArea rows={3} />
 </Form.Item>
 <Form.Item name="proposed_changes" label={t('plm.proposed_changes')}>
 <TextArea rows={4} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default PLM;
