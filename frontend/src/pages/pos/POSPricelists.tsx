import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, InputNumber, Card, Tag, DatePicker, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import dayjs from 'dayjs';
import { PageHeader, StatusTag } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const POSPricelists: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/pos/pricelists', { params: { page_size: 100 } });
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

 const openModal = (record?: any) => {
 if (record) {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 rules: record.rules || [],
 });
 } else {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({
 is_active: true,
 currency: 'IQD',
 discount_policy: 'with_discount',
 rules: [],
 });
 }
 setModalVisible(true);
 };

 const handleSubmit = async (values: any) => {
 try {
 // Convert dates to ISO strings
 const payload = {
 ...values,
 rules: (values.rules || []).map((r: any) => ({
 ...r,
 date_from: r.date_from ? dayjs(r.date_from).toISOString() : null,
 date_to: r.date_to ? dayjs(r.date_to).toISOString() : null,
 })),
 };

 if (editingId) {
 await api.put(`/api/pos/pricelists/${editingId}`, payload);
 message.success(t('success'));
 } else {
 await api.post('/api/pos/pricelists', payload);
 message.success(t('success'));
 }
 setModalVisible(false);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('confirm_delete'),
 onOk: async () => {
 try {
 await api.delete(`/api/pos/pricelists/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const columns = [
 {
 title: t('name'),
 dataIndex: 'name',
 key: 'name',
 },
 {
 title: t('name_ku'),
 dataIndex: 'name_ku',
 key: 'name_ku',
 },
 {
 title: t('pos.currency'),
 dataIndex: 'currency',
 key: 'currency',
 render: (val: string) => <Tag>{val}</Tag>,
 },
 {
 title: t('pos.rules_count'),
 dataIndex: 'rules',
 key: 'rules',
 render: (rules: any[]) => <StatusTag status="info" label={String(rules?.length || 0)} />,
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (active: boolean) => (
 <StatusTag status={active ? 'active' : 'inactive'} label={active ? t('active') : t('inactive')} />
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('pos.pricelists')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
 {t('add')}
 </Button>
 }
 />
 <ResponsiveTableAdapter dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={false} />

 <FormDialog
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => form.submit()}
 title={editingId ? t('edit') : t('add')}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>

 <Form.Item name="name_ku" label={t('name_ku')}>
 <Input />
 </Form.Item>

 <Form.Item name="currency" label={t('pos.currency')}>
 <Select>
 <Select.Option value="IQD">IQD</Select.Option>
 <Select.Option value="USD">USD</Select.Option>
 </Select>
 </Form.Item>

 <Form.Item name="discount_policy" label={t('pos.discount_policy')}>
 <Select>
 <Select.Option value="with_discount">{t('pos.with_discount')}</Select.Option>
 <Select.Option value="without_discount">{t('pos.without_discount')}</Select.Option>
 </Select>
 </Form.Item>

 <Form.Item label={t('pos.pricelist_rules')}>
 <Form.List name="rules">
 {(fields, { add, remove }) => (
 <>
 {fields.map((field, index) => (
 <Card
 key={field.key}
 title={`${t('pos.rule')} ${index + 1}`}
 extra={<Button icon={<MinusCircleOutlined />} danger onClick={() => remove(field.name)} />}
 style={{ marginBottom: 8 }}
 >
 <Form.Item
 {...field}
 name={[field.name, 'applies_on']}
 label={t('pos.applies_on')}
 rules={[{ required: true }]}
 >
 <Select>
 <Select.Option value="all">{t('pos.all_products')}</Select.Option>
 <Select.Option value="category">{t('pos.category')}</Select.Option>
 <Select.Option value="product">{t('pos.product')}</Select.Option>
 </Select>
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'product_id']} label={t('pos.product_id')}>
 <Input placeholder={t('pos.product_id_hint')} />
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'category_id']} label={t('pos.category_id')}>
 <Input placeholder={t('pos.category_id_hint')} />
 </Form.Item>

 <Space>
 <Form.Item {...field} name={[field.name, 'min_qty']} label={t('pos.min_qty')}>
 <InputNumber min={1} defaultValue={1} />
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'compute']} label={t('pos.compute')}>
 <Select defaultValue="fixed">
 <Select.Option value="fixed">{t('pos.fixed_price')}</Select.Option>
 <Select.Option value="discount">{t('pos.discount')}</Select.Option>
 <Select.Option value="formula">{t('pos.formula')}</Select.Option>
 </Select>
 </Form.Item>
 </Space>

 <Space>
 <Form.Item {...field} name={[field.name, 'fixed_price']} label={t('pos.fixed_price')}>
 <InputNumber min={0} />
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'percent']} label={t('pos.discount_percent')}>
 <InputNumber min={0} max={100} />
 </Form.Item>
 </Space>

 <Space>
 <Form.Item {...field} name={[field.name, 'date_from']} label={t('pos.date_from')}>
 <DatePicker />
 </Form.Item>

 <Form.Item {...field} name={[field.name, 'date_to']} label={t('pos.date_to')}>
 <DatePicker />
 </Form.Item>
 </Space>
 </Card>
 ))}
 <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
 {t('pos.add_rule')}
 </Button>
 </>
 )}
 </Form.List>
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default POSPricelists;
