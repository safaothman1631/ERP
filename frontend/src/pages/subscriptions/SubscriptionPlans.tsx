import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, InputNumber, Switch, Modal, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Plan {
 id: string;
 code: string;
 name: string;
 price: number;
 currency: string;
 billing_cycle: 'monthly' | 'quarterly' | 'yearly';
 billing_interval: number;
 trial_days: number;
 setup_fee: number;
 active: boolean;
 description?: string;
}

const SubscriptionPlans: React.FC = () => {
 const { t } = useTranslation();
 const [plans, setPlans] = useState<Plan[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [editing, setEditing] = useState<Plan | null>(null);

 const fetchPlans = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/subscriptions/plans');
 setPlans(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchPlans();
 }, []);

 const handleCreate = () => {
 setEditing(null);
 form.resetFields();
 form.setFieldsValue({ currency: 'IQD', billing_cycle: 'monthly', billing_interval: 1, trial_days: 0, setup_fee: 0, active: true });
 setModalOpen(true);
 };

 const handleEdit = (record: Plan) => {
 setEditing(record);
 form.setFieldsValue(record);
 setModalOpen(true);
 };

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.put(`/api/subscriptions/plans/${editing.id}`, values);
 } else {
 await api.post('/api/subscriptions/plans', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditing(null);
 void fetchPlans();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 try {
 await api.delete(`/api/subscriptions/plans/${id}`);
 message.success(t('success'));
 void fetchPlans();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const columns = [
 { title: t('subscription.code'), dataIndex: 'code', key: 'code', width: 100 },
 { title: t('subscription.plan_name'), dataIndex: 'name', key: 'name' },
 {
 title: t('subscription.price'),
 key: 'price',
 render: (_: any, record: Plan) => `${record.price.toLocaleString()} ${record.currency}`,
 width: 120,
 },
 {
 title: t('subscription.billing_cycle'),
 dataIndex: 'billing_cycle',
 key: 'billing_cycle',
 render: (cycle: string) => t(`subscription.cycle_${cycle}`),
 width: 120,
 },
 {
 title: t('subscription.trial_days'),
 dataIndex: 'trial_days',
 key: 'trial_days',
 width: 100,
 },
 {
 title: t('subscription.setup_fee'),
 dataIndex: 'setup_fee',
 key: 'setup_fee',
 render: (fee: number) => fee > 0 ? fee.toLocaleString() : '-',
 width: 100,
 },
 {
 title: t('status'),
 key: 'active',
 render: (_: any, record: Plan) => (
 <StatusTag status={record.active ? 'active' : 'inactive'} label={record.active ? t('active') : t('inactive')} />
 ),
 width: 80,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: Plan) => (
 <Space>
 <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
 <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 width: 100,
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('subscription.plans')}
 subtitle={t('subscription.plans_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('subscription.new_plan')}
 </Button>
 }
 />

 <SectionCard padded={false}>
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={plans}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 />
 </SectionCard>

 <FormDialog
 title={editing ? t('subscription.edit_plan') : t('subscription.new_plan')}
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="code" label={t('subscription.code')} rules={[{ required: true }]}>
 <Input maxLength={50} />
 </Form.Item>
 <Form.Item name="name" label={t('subscription.plan_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="price" label={t('subscription.price')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="currency" label={t('currency')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="IQD">IQD</Select.Option>
 <Select.Option value="USD">USD</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="billing_cycle" label={t('subscription.billing_cycle')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="monthly">{t('subscription.cycle_monthly')}</Select.Option>
 <Select.Option value="quarterly">{t('subscription.cycle_quarterly')}</Select.Option>
 <Select.Option value="yearly">{t('subscription.cycle_yearly')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="billing_interval" label={t('subscription.billing_interval')} rules={[{ required: true }]}>
 <InputNumber min={1} max={12} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="trial_days" label={t('subscription.trial_days')}>
 <InputNumber min={0} max={365} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="setup_fee" label={t('subscription.setup_fee')}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="description" label={t('description')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="active" label={t('active')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default SubscriptionPlans;
