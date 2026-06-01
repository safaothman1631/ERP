import React, { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../api';
import { PageHeader, StatusTag, DataTable } from '../../design-system';
import { FormDialog } from '../../components/responsive/FormDialog';

const { TextArea } = Input;

interface MenuItem {
 id: string;
 menu_id: string;
 name: string;
 price: number;
 category?: string;
 description?: string;
 image_url?: string;
 prep_time_minutes: number;
 is_available: boolean;
}

interface Menu {
 id: string;
 name: string;
 is_active: boolean;
}

const MenuManager: React.FC = () => {
 const { t } = useTranslation();
 const [items, setItems] = useState<MenuItem[]>([]);
 const [menus, setMenus] = useState<Menu[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();

 useEffect(() => {
 void fetchData();
 }, []);

 const fetchData = async () => {
 setLoading(true);
 try {
 const [itemsRes, menusRes] = await Promise.all([
 api.get('/api/restaurant/menu-items'),
 api.get('/api/restaurant/menus'),
 ]);
 setItems(itemsRes.data.items || []);
 setMenus(menusRes.data.items || []);
 } catch {
 void message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleOpenModal = (record?: MenuItem) => {
 if (record) {
 setEditingId(record.id);
 form.setFieldsValue(record);
 } else {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ prep_time_minutes: 15, is_available: true });
 }
 setModalOpen(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 if (editingId) {
 await api.patch(`/api/restaurant/menu-items/${editingId}`, values);
 void message.success(t('updated'));
 } else {
 await api.post('/api/restaurant/menu-items', values);
 void message.success(t('created'));
 }
 setModalOpen(false);
 void fetchData();
 } catch {
 void message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/restaurant/menu-items/${id}`);
 void message.success(t('deleted'));
 void fetchData();
 } catch {
 void message.error(t('error'));
 }
 };

 const columns: ColumnsType<MenuItem> = [
 { title: t('restaurant.item_name'), dataIndex: 'name', key: 'name' },
 {
 title: t('restaurant.price'),
 dataIndex: 'price',
 key: 'price',
 align: 'right',
 render: (val: number) => `${new Intl.NumberFormat('en-US').format(val || 0)} IQD`,
 },
 { title: t('restaurant.category'), dataIndex: 'category', key: 'category' },
 {
 title: t('restaurant.prep_time'),
 dataIndex: 'prep_time_minutes',
 key: 'prep_time_minutes',
 render: (val: number) => `${val} ${t('restaurant.minutes')}`,
 },
 {
 title: t('restaurant.availability'),
 dataIndex: 'is_available',
 key: 'is_available',
 render: (val: boolean) => (
 <StatusTag status={val ? 'active' : 'inactive'} label={val ? t('available') : t('unavailable')} />
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: unknown, record: MenuItem) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => void handleDelete(record.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('restaurant.menu_manager')}
 subtitle={t('restaurant.manage_menu_items')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
 {t('restaurant.add_item')}
 </Button>
 }
 />

 <DataTable<MenuItem>
 columns={columns}
 dataSource={items}
 rowKey="id"
 loading={loading}
 stickyHeader={false}
 pagination={{ pageSize: 20 }}
 />

 <FormDialog
 title={editingId ? t('restaurant.edit_item') : t('restaurant.add_item')}
 open={modalOpen}
 onOk={() => void handleSave()}
 onCancel={() => setModalOpen(false)}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="menu_id" label={t('restaurant.menu')} rules={[{ required: true }]}>
 <Select placeholder={t('restaurant.select_menu')}>
 {menus.map(m => (
 <Select.Option key={m.id} value={m.id}>
 {m.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="name" label={t('restaurant.item_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="price" label={t('restaurant.price')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} addonAfter="IQD" />
 </Form.Item>
 <Form.Item name="category" label={t('restaurant.category')}>
 <Input />
 </Form.Item>
 <Form.Item name="description" label={t('description')}>
 <TextArea rows={3} />
 </Form.Item>
 <Form.Item name="prep_time_minutes" label={t('restaurant.prep_time')} rules={[{ required: true }]}>
 <InputNumber min={1} style={{ width: '100%' }} addonAfter={t('restaurant.minutes')} />
 </Form.Item>
 <Form.Item name="is_available" label={t('restaurant.availability')} valuePropName="checked">
 <Select>
 <Select.Option value={true}>{t('available')}</Select.Option>
 <Select.Option value={false}>{t('unavailable')}</Select.Option>
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default MenuManager;
