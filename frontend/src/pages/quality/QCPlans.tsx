import React, { useEffect, useState, useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Space, Form, Input, Select, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader } from '../../design-system';
import { Popconfirm } from 'antd';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface QCPlan {
 id: string;
 name: string;
 operation: string;
 test_type: string;
 product_id?: string;
 instructions?: string;
 is_active: boolean;
}

const QCPlans: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<QCPlan[]>([]);
 const [loading, setLoading] = useState(false);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/quality/points', { params: { limit: 200 } });
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

 const handleSave = async (values: any) => {
 try {
 if (editingId) {
 await api.patch(`/api/quality/points/${editingId}`, values);
 message.success(t('success'));
 } else {
 await api.post('/api/quality/points', values);
 message.success(t('quality.plan_created'));
 }
 setDrawerOpen(false);
 form.resetFields();
 setEditingId(null);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (record: QCPlan) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setDrawerOpen(true);
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/quality/points/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const columns: ColumnsType<QCPlan> = [
 {
 title: t('quality.plan_name'),
 dataIndex: 'name',
 key: 'name',
 },
 {
 title: t('quality.operation'),
 dataIndex: 'operation',
 key: 'operation',
 render: (v) => t(`quality.operation_${v}`),
 },
 {
 title: t('quality.test_type'),
 dataIndex: 'test_type',
 key: 'test_type',
 render: (v) => t(`quality.test_${v}`),
 },
 {
 title: t('quality.criteria'),
 dataIndex: 'instructions',
 key: 'instructions',
 render: (v) => v || 'â€”',
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (v) => (v ? t('active') : t('inactive')),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_, record) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
 <Popconfirm
 title={t('confirm_delete')}
 onConfirm={() => handleDelete(record.id)}
 >
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('quality.qc_plans')}
 subtitle={t('quality.qc_plans_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditingId(null);
 form.resetFields();
 setDrawerOpen(true);
 }}
 >
 {t('quality.new_plan')}
 </Button>
 }
 />
 <ResponsiveTableAdapter
 dataSource={data}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 <FormDialog
 title={editingId ? t('quality.edit_plan') : t('quality.new_plan')}
 open={drawerOpen}
 onClose={() => {
 setDrawerOpen(false);
 form.resetFields();
 setEditingId(null);
 }}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item
 name="name"
 label={t('quality.plan_name')}
 rules={[{ required: true, message: t('required') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item
 name="operation"
 label={t('quality.operation')}
 initialValue="manufacturing"
 rules={[{ required: true }]}
 >
 <Select>
 <Select.Option value="manufacturing">{t('quality.operation_manufacturing')}</Select.Option>
 <Select.Option value="receiving">{t('quality.operation_receiving')}</Select.Option>
 <Select.Option value="delivery">{t('quality.operation_delivery')}</Select.Option>
 <Select.Option value="stock_move">{t('quality.operation_stock_move')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item
 name="test_type"
 label={t('quality.test_type')}
 initialValue="pass_fail"
 rules={[{ required: true }]}
 >
 <Select>
 <Select.Option value="pass_fail">{t('quality.test_pass_fail')}</Select.Option>
 <Select.Option value="measure">{t('quality.test_measure')}</Select.Option>
 <Select.Option value="instructions">{t('quality.test_instructions')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="product_id" label={t('quality.product')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="instructions" label={t('quality.criteria')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="is_active" label={t('active')} valuePropName="checked" initialValue={true}>
 <Switch />
 </Form.Item>
 <Form.Item>
 <Space>
 <Button type="primary" htmlType="submit">
 {t('save')}
 </Button>
 <Button onClick={() => setDrawerOpen(false)}>{t('cancel')}</Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default QCPlans;
