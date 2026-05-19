import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Steps, List, Popconfirm, Switch, Tag } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const Automations: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [createModal, setCreateModal] = useState(false);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [currentStep, setCurrentStep] = useState(0);
 const [steps, setSteps] = useState<any[]>([]);

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/marketing/automations');
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

 const handleCreate = async () => {
 try {
 const values = await form.validateFields();
 const payload = {
 name: values.name,
 trigger: { event: values.trigger_event },
 steps: steps,
 };
 await api.post('/api/marketing/automations', payload);
 message.success(t('success'));
 setCreateModal(false);
 form.resetFields();
 setSteps([]);
 setCurrentStep(0);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/marketing/automations/${id}`);
 message.success(t('deleted'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleToggleActive = async (id: string) => {
 try {
 await api.post(`/api/marketing/automations/${id}/activate`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const addStep = (type: string) => {
 setSteps([...steps, { type, config: {} }]);
 };

 const moveStep = (index: number, direction: 'up' | 'down') => {
 const newSteps = [...steps];
 const target = direction === 'up' ? index - 1 : index + 1;
 if (target < 0 || target >= newSteps.length) return;
 [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
 setSteps(newSteps);
 };

 const removeStep = (index: number) => {
 setSteps(steps.filter((_, i) => i !== index));
 };

 const columns: any[] = [
 { title: t('marketing.name'), dataIndex: 'name', key: 'name' },
 {
 title: t('marketing.trigger'),
 dataIndex: 'trigger',
 key: 'trigger',
 render: (val: any) => val?.event || '—',
 },
 {
 title: t('marketing.steps_count'),
 key: 'steps_count',
 render: (_: any, rec: any) => rec.steps?.length || 0,
 },
 {
 title: t('marketing.active'),
 dataIndex: 'active',
 key: 'active',
 render: (val: boolean, rec: any) => (
 <Switch checked={val} onChange={() => handleToggleActive(rec.id)} />
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, rec: any) => (
 <Space>
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(rec.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('marketing.automations')}
 subtitle={t('marketing.automations_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
 {t('create')}
 </Button>
 }
 />

 <ResponsiveTableAdapter columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />

 <FormDialog
 title={t('marketing.create_automation')}
 open={createModal}
 onClose={() => {
 setCreateModal(false);
 setCurrentStep(0);
 setSteps([]);
 form.resetFields();
 }} hideFooter
 >
 <Steps
 current={currentStep}
 style={{ marginBottom: 24 }}
 items={[
 { title: t('marketing.step_1_basic') },
 { title: t('marketing.step_2_steps') },
 { title: t('marketing.step_3_review') },
 ]}
 />

 {currentStep === 0 && (
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('marketing.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="trigger_event" label={t('marketing.trigger_event')} rules={[{ required: true }]}>
 <Select
 options={[
 { label: t('marketing.trigger_contact_created'), value: 'contact_created' },
 { label: t('marketing.trigger_invoice_paid'), value: 'invoice_paid' },
 { label: t('marketing.trigger_lead_qualified'), value: 'lead_qualified' },
 ]}
 />
 </Form.Item>
 <Button type="primary" onClick={() => setCurrentStep(1)}>
 {t('next')}
 </Button>
 </Form>
 )}

 {currentStep === 1 && (
 <div>
 <Space style={{ marginBottom: 16 }}>
 <Button onClick={() => addStep('email')}>
 + {t('marketing.step_email')}
 </Button>
 <Button onClick={() => addStep('sms')}>
 + {t('marketing.step_sms')}
 </Button>
 <Button onClick={() => addStep('wait')}>
 + {t('marketing.step_wait')}
 </Button>
 <Button onClick={() => addStep('tag')}>
 + {t('marketing.step_tag')}
 </Button>
 </Space>

 <List
 dataSource={steps}
 renderItem={(step: any, index: number) => (
 <List.Item
 actions={[
 <Button icon={<UpOutlined />} onClick={() => moveStep(index, 'up')} />,
 <Button icon={<DownOutlined />} onClick={() => moveStep(index, 'down')} />,
 <Button danger onClick={() => removeStep(index)}>
 {t('delete')}
 </Button>,
 ]}
 >
 <Tag>{step.type}</Tag>
 </List.Item>
 )}
 bordered
 />

 <Space style={{ marginTop: 16 }}>
 <Button onClick={() => setCurrentStep(0)}>{t('back')}</Button>
 <Button type="primary" onClick={() => setCurrentStep(2)} disabled={steps.length === 0}>
 {t('next')}
 </Button>
 </Space>
 </div>
 )}

 {currentStep === 2 && (
 <div>
 <p>
 <strong>{t('marketing.review_automation')}</strong>
 </p>
 <p>
 {t('marketing.name')}: {form.getFieldValue('name')}
 </p>
 <p>
 {t('marketing.trigger')}: {form.getFieldValue('trigger_event')}
 </p>
 <p>
 {t('marketing.steps_count')}: {steps.length}
 </p>

 <Space style={{ marginTop: 16 }}>
 <Button onClick={() => setCurrentStep(1)}>{t('back')}</Button>
 <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleCreate} loading={saving}>
 {t('marketing.activate')}
 </Button>
 </Space>
 </div>
 )}
 </FormDialog>
 </div>
 );
};

export default Automations;
