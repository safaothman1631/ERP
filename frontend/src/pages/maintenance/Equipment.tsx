import React, { useEffect, useState } from 'react';
import { Button, Tag, Form, Input, InputNumber, Select, Space, DatePicker, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { SelectWithQuickCreate } from '../../design-system/empty/SelectWithQuickCreate';

interface Equipment {
 id: string;
 name: string;
 serial_no?: string;
 category_id?: string;
 location?: string;
 purchase_date?: string;
 purchase_value: number;
 warranty_until?: string;
 is_active: boolean;
 status?: string;
}

interface Category {
 id: string;
 name: string;
 description?: string;
}

const statusColors: Record<string, string> = {
 idle: 'default',
 in_use: 'blue',
 maintenance: 'orange',
 broken: 'red',
};

const Equipment: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<Equipment[]>([]);
 const [categories, setCategories] = useState<Category[]>([]);
 const [loading, setLoading] = useState(false);
 const [statusFilter, setStatusFilter] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);

 const fetchData = async () => {
 setLoading(true);
 try {
 const r = await api.get('/api/maintenance/equipment', { params: { limit: 500 } });
 let items = r.data.items || [];
 if (statusFilter) {
 items = items.filter((e: Equipment) => e.status === statusFilter);
 }
 if (categoryFilter) {
 items = items.filter((e: Equipment) => e.category_id === categoryFilter);
 }
 setData(items);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchCategories = async () => {
 try {
 const r = await api.get('/api/maintenance/categories', { params: { limit: 500 } });
 setCategories(r.data.items || []);
 } catch {
 // Ignore
 }
 };

 useEffect(() => {
 void fetchData();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [statusFilter, categoryFilter]);

 useEffect(() => {
 void fetchCategories();
 }, []);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ is_active: true, purchase_value: 0 });
 setModalOpen(true);
 };

 const openEdit = async (record: Equipment) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 purchase_date: record.purchase_date ? dayjs(record.purchase_date) : undefined,
 warranty_until: record.warranty_until ? dayjs(record.warranty_until) : undefined,
 });
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 purchase_date: values.purchase_date ? (values.purchase_date as Dayjs).format('YYYY-MM-DD') : undefined,
 warranty_until: values.warranty_until ? (values.warranty_until as Dayjs).format('YYYY-MM-DD') : undefined,
 };
 if (editingId) {
 await api.patch(`/api/maintenance/equipment/${editingId}`, payload);
 } else {
 await api.post('/api/maintenance/equipment', payload);
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
 await api.delete(`/api/maintenance/equipment/${id}`);
 message.success(t('success'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const columns = [
 { title: t('maintenance.equipment_name'), dataIndex: 'name', key: 'name', width: 200 },
 { title: t('maintenance.serial_no'), dataIndex: 'serial_no', key: 'serial_no', width: 140 },
 {
 title: t('maintenance.category'),
 dataIndex: 'category_id',
 key: 'category_id',
 width: 140,
 render: (catId: string) => {
 const cat = categories.find((c) => c.id === catId);
 return cat ? cat.name : '—';
 },
 },
 { title: t('maintenance.location'), dataIndex: 'location', key: 'location', width: 140 },
 {
 title: t('maintenance.status'),
 dataIndex: 'status',
 key: 'status',
 width: 120,
 render: (status: string) => (
 <Tag color={statusColors[status] || 'default'}>
 {t(`maintenance.status_${status}`, status)}
 </Tag>
 ),
 },
 {
 title: t('maintenance.purchase_value'),
 dataIndex: 'purchase_value',
 key: 'purchase_value',
 width: 120,
 render: (val: number) => val?.toLocaleString(),
 },
 {
 title: t('maintenance.warranty_until'),
 dataIndex: 'warranty_until',
 key: 'warranty_until',
 width: 120,
 render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD') : '—'),
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 180,
 fixed: 'right' as const,
 render: (_: unknown, record: Equipment) => (
 <Space>
 <Button icon={<EyeOutlined />} onClick={() => navigate(`/maintenance/equipment/${record.id}`)}>
 {t('view')}
 </Button>
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
 title={t('maintenance.equipment')}
 subtitle={t('maintenance.equipment_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('maintenance.new_equipment')}
 </Button>
 }
 />
 <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
 <Col span={12}>
 <Select
 style={{ width: '100%' }}
 placeholder={t('maintenance.filter_status')}
 allowClear
 value={statusFilter || undefined}
 onChange={(val) => setStatusFilter(val || '')}
 >
 <Select.Option value="idle">{t('maintenance.status_idle')}</Select.Option>
 <Select.Option value="in_use">{t('maintenance.status_in_use')}</Select.Option>
 <Select.Option value="maintenance">{t('maintenance.status_maintenance')}</Select.Option>
 <Select.Option value="broken">{t('maintenance.status_broken')}</Select.Option>
 </Select>
 </Col>
 <Col span={12}>
 <Select
 style={{ width: '100%' }}
 placeholder={t('maintenance.filter_category')}
 allowClear
 value={categoryFilter || undefined}
 onChange={(val) => setCategoryFilter(val || '')}
 >
 {categories.map((cat) => (
 <Select.Option key={cat.id} value={cat.id}>
 {cat.name}
 </Select.Option>
 ))}
 </Select>
 </Col>
 </Row>
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={data}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 50, showSizeChanger: true }}
 scroll={{ x: 1200 }}
 />
 <FormDialog
 open={modalOpen}
 title={editingId ? t('maintenance.edit_equipment') : t('maintenance.new_equipment')}
 onClose={() => {
 setModalOpen(false);
 form.resetFields();
 setEditingId(null);
 }}
 onOk={() => form.submit()}
 confirmLoading={saving}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="name" label={t('maintenance.equipment_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="serial_no" label={t('maintenance.serial_no')}>
 <Input />
 </Form.Item>
 <Form.Item name="category_id" label={t('maintenance.category')}>
 <SelectWithQuickCreate
 entity="equipment_category"
 placeholder={t('maintenance.select_category')}
 />
 </Form.Item>
 <Form.Item name="location" label={t('maintenance.location')}>
 <Input />
 </Form.Item>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="purchase_date" label={t('maintenance.purchase_date')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="purchase_value" label={t('maintenance.purchase_value')}>
 <InputNumber style={{ width: '100%' }} min={0} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="warranty_until" label={t('maintenance.warranty_until')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="is_active" label={t('maintenance.is_active')} valuePropName="checked">
 <Select>
 <Select.Option value={true}>{t('active')}</Select.Option>
 <Select.Option value={false}>{t('inactive')}</Select.Option>
 </Select>
 </Form.Item>
 </Col>
 </Row>
 </Form>
 </FormDialog>
 </>
 );
};

export default Equipment;
