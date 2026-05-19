import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Category {
 id: string;
 name: string;
 description?: string;
}

const EquipmentCategories: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Category[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);

 const fetchData = async () => {
 setLoading(true);
 try {
 const r = await api.get('/api/maintenance/categories', { params: { limit: 500 } });
 setData(r.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchData();
 }, []);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 setModalOpen(true);
 };

 const openEdit = (record: Category) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 if (editingId) {
 await api.patch(`/api/maintenance/categories/${editingId}`, values);
 } else {
 await api.post('/api/maintenance/categories', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditingId(null);
 void fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/maintenance/categories/${id}`);
 message.success(t('success'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const columns = [
 { title: t('name'), dataIndex: 'name', key: 'name', width: 250 },
 { title: t('description'), dataIndex: 'description', key: 'description' },
 {
 title: t('actions'),
 key: 'actions',
 width: 150,
 fixed: 'right' as const,
 render: (_: unknown, record: Category) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(record.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('maintenance.equipment_categories')}
 subtitle={t('maintenance.categories_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('maintenance.new_category')}
 </Button>
 }
 />
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={data}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 50, showSizeChanger: true }}
 />
 <FormDialog
 open={modalOpen}
 title={editingId ? t('maintenance.edit_category') : t('maintenance.new_category')}
 onClose={() => {
 setModalOpen(false);
 form.resetFields();
 setEditingId(null);
 }}
 onOk={() => form.submit()}
 confirmLoading={saving}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="description" label={t('description')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default EquipmentCategories;
