import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Form, Input, Select, DatePicker, InputNumber, Tag, Space, Divider } from 'antd';
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';
import { space } from '../theme/tokens';
import dayjs from 'dayjs';
import { message } from '../utils/message';
import { FormDialog } from '../components/responsive/FormDialog';

interface Task {
 id: string;
 name: string;
 start: string;
 end: string;
 progress: number;
 billable: boolean;
 status: string;
}

interface Dependency {
 id: string;
 predecessor_task_id: string;
 successor_task_id: string;
 type: string;
}

interface Milestone {
 id: string;
 name: string;
 due_date: string;
 done: boolean;
 task_ids?: string[];
}

interface GanttData {
 project_name: string;
 tasks: Task[];
 dependencies: Dependency[];
 milestones: Milestone[];
}

const ProjectGantt: React.FC = () => {
 const { projectId } = useParams<{ projectId: string }>();
 const navigate = useNavigate();
 const { t } = useTranslation();
 
 const [data, setData] = useState<GanttData | null>(null);
 const [loading, setLoading] = useState(false);
 const [taskDrawer, setTaskDrawer] = useState(false);
 const [depModal, setDepModal] = useState(false);
 const [milestoneModal, setMilestoneModal] = useState(false);
 const [selectedTask, setSelectedTask] = useState<Task | null>(null);
 
 const [taskForm] = Form.useForm();
 const [depForm] = Form.useForm();
 const [milestoneForm] = Form.useForm();

 const fetchData = async () => {
 if (!projectId) return;
 setLoading(true);
 try {
 const res = await api.get(`/api/projects/${projectId}/gantt`);
 setData(res.data);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, [projectId]);

 const handleTaskSave = async (values: any) => {
 if (!projectId) return;
 try {
 const payload = {
 ...values,
 start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
 end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
 };
 
 if (selectedTask) {
 await api.put(`/api/projects/${projectId}/tasks/${selectedTask.id}`, payload);
 } else {
 await api.post(`/api/projects/${projectId}/tasks`, payload);
 }
 
 message.success(t('success'));
 setTaskDrawer(false);
 taskForm.resetFields();
 setSelectedTask(null);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDepSave = async (values: any) => {
 if (!projectId) return;
 try {
 await api.post(`/api/projects/${projectId}/dependencies`, values);
 message.success(t('success'));
 setDepModal(false);
 depForm.resetFields();
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleMilestoneSave = async (values: any) => {
 if (!projectId) return;
 try {
 const payload = {
 ...values,
 due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : undefined,
 };
 await api.post(`/api/projects/${projectId}/milestones`, payload);
 message.success(t('success'));
 setMilestoneModal(false);
 milestoneForm.resetFields();
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const completeMilestone = async (milestoneId: string) => {
 try {
 await api.put(`/api/projects/milestones/${milestoneId}/complete`, {});
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const calculateGanttPositions = () => {
 if (!data || data.tasks.length === 0) return { minDate: null, maxDate: null, rows: [] };

 const dates = data.tasks.flatMap(t => [t.start, t.end]).filter(Boolean);
 if (dates.length === 0) return { minDate: null, maxDate: null, rows: [] };

 const minDate = dayjs(dates.sort()[0]);
 const maxDate = dayjs(dates.sort()[dates.length - 1]);
 const totalDays = maxDate.diff(minDate, 'day') + 1 || 1;

 const rows = data.tasks.map(task => {
 const start = dayjs(task.start);
 const end = dayjs(task.end);
 const offsetDays = start.diff(minDate, 'day');
 const durationDays = end.diff(start, 'day') + 1;
 const leftPercent = (offsetDays / totalDays) * 100;
 const widthPercent = (durationDays / totalDays) * 100;

 return {
 task,
 leftPercent,
 widthPercent,
 };
 });

 return { minDate, maxDate, totalDays, rows };
 };

 const { minDate, maxDate, totalDays, rows } = calculateGanttPositions();

 const openTaskDrawer = (task?: Task) => {
 if (task) {
 setSelectedTask(task);
 taskForm.setFieldsValue({
 name: task.name,
 start_date: task.start ? dayjs(task.start) : undefined,
 end_date: task.end ? dayjs(task.end) : undefined,
 progress: task.progress,
 billable: task.billable,
 status: task.status,
 });
 } else {
 setSelectedTask(null);
 taskForm.resetFields();
 }
 setTaskDrawer(true);
 };

 const taskOptions = data?.tasks.map(t => ({ label: t.name, value: t.id })) || [];

 return (
 <div>
 <PageHeader
 title={data?.project_name || t('gantt')}
 subtitle={t('gantt')}
 helpKey="gantt"
 extra={
 <Space>
 <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
 {t('back')}
 </Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskDrawer()}>
 {t('add_task')}
 </Button>
 <Button icon={<PlusOutlined />} onClick={() => { depForm.resetFields(); setDepModal(true); }}>
 {t('add_dependency')}
 </Button>
 <Button icon={<PlusOutlined />} onClick={() => { milestoneForm.resetFields(); setMilestoneModal(true); }}>
 {t('add_milestone')}
 </Button>
 </Space>
 }
 />

 <Card loading={loading} style={{ marginTop: space.md }}>
 {/* Gantt Chart */}
 {data && rows.length > 0 && minDate && maxDate ? (
 <div style={{ overflowX: 'auto' }}>
 {/* Header */}
 <div style={{ marginBottom: space.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div style={{ fontSize: 14, color: 'var(--ink-500)' }}>
 {minDate.format('YYYY-MM-DD')} → {maxDate.format('YYYY-MM-DD')} ({totalDays} {t('days')})
 </div>
 </div>

 {/* Tasks */}
 <div>
 {rows.map(({ task, leftPercent, widthPercent }) => (
 <div key={task.id} style={{ marginBottom: space.sm }}>
 <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
 <div style={{ width: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => openTaskDrawer(task)}>
 {task.name}
 </div>
 <div style={{ flex: 1, height: 32, background: 'var(--surface-2)', position: 'relative', borderRadius: 4, marginLeft: space.sm }}>
 <div
 style={{
 position: 'absolute',
 left: `${leftPercent}%`,
 width: `${widthPercent}%`,
 height: '100%',
 background: task.billable ? 'var(--success-500)' : 'var(--accent-500)',
 borderRadius: 4,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 color: 'var(--on-accent)',
 fontSize: 12,
 cursor: 'pointer',
 }}
 onClick={() => openTaskDrawer(task)}
 >
 {task.progress}%
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>

 <Divider titlePlacement="left">{t('milestones')}</Divider>
 {data.milestones.map(ms => (
 <div key={ms.id} style={{ marginBottom: space.xs, display: 'flex', alignItems: 'center', gap: space.sm }}>
 <Tag color={ms.done ? 'green' : 'orange'}>{ms.name}</Tag>
 <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{ms.due_date}</span>
 {!ms.done && (
 <Button type="link" onClick={() => completeMilestone(ms.id)}>
 {t('mark_complete')}
 </Button>
 )}
 </div>
 ))}

 <Divider titlePlacement="left">{t('dependencies')}</Divider>
 {data.dependencies.length === 0 && <div style={{ color: 'var(--ink-500)' }}>{t('no_dependencies')}</div>}
 {data.dependencies.map(dep => {
 const pred = data.tasks.find(t => t.id === dep.predecessor_task_id);
 const succ = data.tasks.find(t => t.id === dep.successor_task_id);
 return (
 <div key={dep.id} style={{ marginBottom: space.xs, fontSize: 13 }}>
 {pred?.name || dep.predecessor_task_id} → {succ?.name || dep.successor_task_id} ({dep.type})
 </div>
 );
 })}
 </div>
 ) : (
 <div style={{ textAlign: 'center', color: 'var(--ink-500)', padding: space.xl }}>{t('no_tasks_gantt')}</div>
 )}
 </Card>

 {/* Task Drawer */}
 <FormDialog
 title={selectedTask ? t('edit_task') : t('add_task')}
 open={taskDrawer}
 onClose={() => { setTaskDrawer(false); setSelectedTask(null); }}
 extra={
 <Button type="primary" onClick={() => taskForm.submit()}>
 {t('save')}
 </Button>
 }
 >
 <Form form={taskForm} layout="vertical" onFinish={handleTaskSave}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item label={t('start_date')} name="start_date">
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('end_date')} name="end_date">
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('progress')} name="progress">
 <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
 </Form.Item>
 <Form.Item label={t('billable')} name="billable" valuePropName="checked">
 <Select>
 <Select.Option value={true}>{t('billable')}</Select.Option>
 <Select.Option value={false}>{t('non_billable')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item label={t('status')} name="status">
 <Select>
 <Select.Option value="open">{t('open')}</Select.Option>
 <Select.Option value="in_progress">{t('in_progress')}</Select.Option>
 <Select.Option value="completed">{t('completed')}</Select.Option>
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>

 {/* Dependency Modal */}
 <FormDialog
 title={t('add_dependency')}
 open={depModal}
 onClose={() => setDepModal(false)}
 onOk={() => depForm.submit()}
 >
 <Form form={depForm} layout="vertical" onFinish={handleDepSave}>
 <Form.Item label={t('predecessor')} name="predecessor_task_id" rules={[{ required: true }]}>
 <Select options={taskOptions} showSearch optionFilterProp="label" />
 </Form.Item>
 <Form.Item label={t('successor')} name="successor_task_id" rules={[{ required: true }]}>
 <Select options={taskOptions} showSearch optionFilterProp="label" />
 </Form.Item>
 <Form.Item label={t('type')} name="type" initialValue="finish_to_start">
 <Select>
 <Select.Option value="finish_to_start">Finish to Start</Select.Option>
 <Select.Option value="start_to_start">Start to Start</Select.Option>
 <Select.Option value="finish_to_finish">Finish to Finish</Select.Option>
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>

 {/* Milestone Modal */}
 <FormDialog
 title={t('add_milestone')}
 open={milestoneModal}
 onClose={() => setMilestoneModal(false)}
 onOk={() => milestoneForm.submit()}
 >
 <Form form={milestoneForm} layout="vertical" onFinish={handleMilestoneSave}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item label={t('due_date')} name="due_date" rules={[{ required: true }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('tasks')} name="task_ids">
 <Select mode="multiple" options={taskOptions} showSearch optionFilterProp="label" />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default ProjectGantt;
