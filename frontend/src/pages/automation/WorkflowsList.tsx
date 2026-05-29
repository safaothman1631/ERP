import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Switch, Tag, message, Card, Drawer, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ListWithEmptyState } from '../../design-system/empty/ListWithEmptyState';

const { TextArea } = Input;

const WorkflowsList: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [workflows, setWorkflows] = useState<any[]>([]);
 const [triggers, setTriggers] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();

 const fetchWorkflows = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/automation/workflows');
 setWorkflows(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchTriggers = async () => {
 try {
 const res = await api.get('/api/automation/triggers');
 setTriggers(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 useEffect(() => {
 void fetchWorkflows();
 void fetchTriggers();
 }, []);

 const handleCreate = async (values: any) => {
 try {
 const trigger = triggers.find((t) => t.event === values.trigger_event);
 const payload = {
 name: values.name,
 description: values.description,
 trigger: { event: values.trigger_event, filter: {}, cron_expr: '' },
 nodes: [],
 edges: [],
 active: true,
 };
 const res = await api.post('/api/automation/workflows', payload);
 message.success(t('automation.workflow_created'));
 setModalOpen(false);
 form.resetFields();
 navigate(`/automation/workflows/${res.data.id}`);
 } catch {
 message.error(t('error'));
 }
 };

 const handleToggle = async (id: string, active: boolean) => {
 try {
 await api.post(`/api/automation/workflows/${id}/toggle`);
 message.success(t('success'));
 void fetchWorkflows();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDuplicate = async (record: any) => {
 try {
 const payload = {
 ...record,
 name: `${record.name} (Copy)`,
 id: undefined,
 run_count: 0,
 last_run_at: null,
 };
 await api.post('/api/automation/workflows', payload);
 message.success(t('automation.workflow_duplicated'));
 void fetchWorkflows();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/automation/workflows/${id}`);
 message.success(t('success'));
 void fetchWorkflows();
 },
 });
 };

 const columns = [
 { title: t('automation.workflow_name'), dataIndex: 'name', key: 'name' },
 {
 title: t('automation.trigger'),
 dataIndex: 'trigger',
 key: 'trigger',
 render: (trigger: any) => <Tag color="blue">{trigger?.event || 'N/A'}</Tag>,
 },
 {
 title: t('automation.nodes'),
 dataIndex: 'nodes',
 key: 'nodes',
 render: (nodes: any[]) => nodes?.length || 0,
 },
 {
 title: t('automation.active'),
 dataIndex: 'active',
 key: 'active',
 render: (v: boolean, record: any) => (
 <Switch checked={v} onChange={() => handleToggle(record.id, v)} />
 ),
 },
 {
 title: t('automation.last_run'),
 dataIndex: 'last_run_at',
 key: 'last_run_at',
 render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
 },
 {
 title: t('automation.run_count'),
 dataIndex: 'run_count',
 key: 'run_count',
 render: (v: number) => v || 0,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => navigate(`/automation/workflows/${record.id}`)} />
 <Button icon={<CopyOutlined />} onClick={() => handleDuplicate(record)} />
 <Button icon={<PlayCircleOutlined />} onClick={() => navigate(`/automation/workflows/${record.id}/runs`)} />
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('automation.workflows')}
 subtitle={t('automation.workflows_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
 {t('automation.new_workflow')}
 </Button>
 }
 />
 <Card style={{ marginTop: space.md }}>
 <ListWithEmptyState
 entity="workflow"
 data={workflows}
 loading={loading}
 onCreate={() => { form.resetFields(); setModalOpen(true); }}
 onRetry={() => void fetchWorkflows()}
 render={(rows) => (
 <ResponsiveTableAdapter dataSource={rows} columns={columns} loading={loading} rowKey="id" />
 )}
 />
 </Card>

 <FormDialog
 title={t('automation.new_workflow')}
 open={modalOpen}
 onClose={() => { setModalOpen(false); form.resetFields(); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleCreate}>
 <Form.Item name="name" label={t('automation.workflow_name')} rules={[{ required: true }]}>
 <Input placeholder={t('automation.workflow_name_placeholder')} />
 </Form.Item>
 <Form.Item name="description" label={t('automation.description')}>
 <TextArea rows={2} placeholder={t('automation.description_placeholder')} />
 </Form.Item>
 <Form.Item name="trigger_event" label={t('automation.trigger_event')} rules={[{ required: true }]}>
 <Select placeholder={t('automation.select_trigger')}>
 {triggers.map((trigger) => (
 <Select.Option key={trigger.event} value={trigger.event}>
 {trigger.label}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default WorkflowsList;
