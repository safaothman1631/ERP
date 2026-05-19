import { useEffect, useState } from 'react';
import { Card, Tabs, Button, Form, Input, InputNumber, Switch, Select, message, Popconfirm, Space } from 'antd';
import type { TableProps } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Team { id: string; name: string; description?: string; members: string[]; }
interface Category { id: string; name: string; color: string; }
interface Tag { id: string; name: string; color: string; }
interface SLAPolicy {
 id: string;
 name: string;
 priority: string;
 response_minutes: number;
 resolution_minutes: number;
 business_hours_only: boolean;
}

export default function HelpdeskSettings() {
 const { t } = useTranslation();
 const [teams, setTeams] = useState<Team[]>([]);
 const [categories, setCategories] = useState<Category[]>([]);
 const [tags, setTags] = useState<Tag[]>([]);
 const [slaPolicies, setSlaPolicies] = useState<SLAPolicy[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState<string | null>(null);
 const [editId, setEditId] = useState<string | null>(null);
 const [form] = Form.useForm();

 const loadTeams = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/helpdesk/teams');
 setTeams(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const loadCategories = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/helpdesk/categories');
 setCategories(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const loadTags = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/helpdesk/tags');
 setTags(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const loadSLA = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/helpdesk/sla-policies');
 setSlaPolicies(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadTeams();
 loadCategories();
 loadTags();
 loadSLA();
 }, []);

 const onSave = async (entity: string) => {
 const v = await form.validateFields();
 try {
 if (editId) {
 await api.patch(`/api/helpdesk/${entity}/${editId}`, v);
 message.success(t('updated'));
 } else {
 await api.post(`/api/helpdesk/${entity}`, v);
 message.success(t('created'));
 }
 setModalOpen(null);
 setEditId(null);
 form.resetFields();
 if (entity === 'teams') loadTeams();
 else if (entity === 'categories') loadCategories();
 else if (entity === 'tags') loadTags();
 else if (entity === 'sla-policies') loadSLA();
 } catch {
 message.error(t('error'));
 }
 };

 const onDelete = async (entity: string, id: string) => {
 try {
 await api.delete(`/api/helpdesk/${entity}/${id}`);
 message.success(t('deleted'));
 if (entity === 'teams') loadTeams();
 else if (entity === 'categories') loadCategories();
 else if (entity === 'tags') loadTags();
 else if (entity === 'sla-policies') loadSLA();
 } catch {
 message.error(t('error'));
 }
 };

 const openModal = (entity: string, record?: any) => {
 setModalOpen(entity);
 if (record) {
 setEditId(record.id);
 form.setFieldsValue(record);
 } else {
 setEditId(null);
 form.resetFields();
 }
 };

 const teamCols: TableProps<Team>['columns'] = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('description'), dataIndex: 'description', key: 'description' },
 {
 title: t('actions'),
 key: 'actions',
 render: (_, rec) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openModal('teams', rec)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => onDelete('teams', rec.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 const categoryCols: TableProps<Category>['columns'] = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('color'), dataIndex: 'color', key: 'color', render: (c) => <div style={{ background: c, width: 20, height: 20, borderRadius: 4 }} /> },
 {
 title: t('actions'),
 key: 'actions',
 render: (_, rec) => (
 <Popconfirm title={t('confirm_delete')} onConfirm={() => onDelete('categories', rec.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 ),
 },
 ];

 const tagCols: TableProps<Tag>['columns'] = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('color'), dataIndex: 'color', key: 'color', render: (c) => <div style={{ background: c, width: 20, height: 20, borderRadius: 4 }} /> },
 {
 title: t('actions'),
 key: 'actions',
 render: (_, rec) => (
 <Popconfirm title={t('confirm_delete')} onConfirm={() => onDelete('tags', rec.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 ),
 },
 ];

 const slaCols: TableProps<SLAPolicy>['columns'] = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('helpdesk.priority'), dataIndex: 'priority', key: 'priority' },
 { title: t('helpdesk.response_minutes'), dataIndex: 'response_minutes', key: 'response_minutes' },
 { title: t('helpdesk.resolution_minutes'), dataIndex: 'resolution_minutes', key: 'resolution_minutes' },
 {
 title: t('actions'),
 key: 'actions',
 render: (_, rec) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openModal('sla-policies', rec)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => onDelete('sla-policies', rec.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 const tabItems = [
 {
 key: 'teams',
 label: t('helpdesk.teams'),
 children: (
 <div>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('teams')} style={{ marginBottom: space.md }}>
 {t('helpdesk.add_team')}
 </Button>
 <ResponsiveTableAdapter dataSource={teams} columns={teamCols} rowKey="id" loading={loading} />
 </div>
 ),
 },
 {
 key: 'categories',
 label: t('helpdesk.categories'),
 children: (
 <div>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('categories')} style={{ marginBottom: space.md }}>
 {t('helpdesk.add_category')}
 </Button>
 <ResponsiveTableAdapter dataSource={categories} columns={categoryCols} rowKey="id" loading={loading} />
 </div>
 ),
 },
 {
 key: 'tags',
 label: t('helpdesk.tags'),
 children: (
 <div>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('tags')} style={{ marginBottom: space.md }}>
 {t('helpdesk.add_tag')}
 </Button>
 <ResponsiveTableAdapter dataSource={tags} columns={tagCols} rowKey="id" loading={loading} />
 </div>
 ),
 },
 {
 key: 'sla',
 label: t('helpdesk.sla_policies'),
 children: (
 <div>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('sla-policies')} style={{ marginBottom: space.md }}>
 {t('helpdesk.add_sla_policy')}
 </Button>
 <ResponsiveTableAdapter dataSource={slaPolicies} columns={slaCols} rowKey="id" loading={loading} />
 </div>
 ),
 },
 ];

 return (
 <div style={{ padding: space.lg }}>
 <PageHeader title={t('helpdesk.settings')} subtitle={t('helpdesk.settings_subtitle')} />
 <Card style={{ marginTop: space.md }}>
 <Tabs items={tabItems} />
 </Card>

 <FormDialog
 title={editId ? t('edit') : t('create')}
 open={!!modalOpen}
 onOk={() => onSave(modalOpen!)}
 onCancel={() => {
 setModalOpen(null);
 setEditId(null);
 form.resetFields();
 }}
 >
 <Form form={form} layout="vertical">
 {modalOpen === 'teams' && (
 <>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="description" label={t('description')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 </>
 )}
 {modalOpen === 'categories' && (
 <>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="color" label={t('color')} initialValue="#1890ff">
 <Input type="color" />
 </Form.Item>
 </>
 )}
 {modalOpen === 'tags' && (
 <>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="color" label={t('color')} initialValue="#52c41a">
 <Input type="color" />
 </Form.Item>
 </>
 )}
 {modalOpen === 'sla-policies' && (
 <>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="priority" label={t('helpdesk.priority')} initialValue="medium">
 <Select>
 <Select.Option value="low">{t('helpdesk.priority_low')}</Select.Option>
 <Select.Option value="medium">{t('helpdesk.priority_medium')}</Select.Option>
 <Select.Option value="high">{t('helpdesk.priority_high')}</Select.Option>
 <Select.Option value="urgent">{t('helpdesk.priority_urgent')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="response_minutes" label={t('helpdesk.response_minutes')} initialValue={60}>
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="resolution_minutes" label={t('helpdesk.resolution_minutes')} initialValue={1440}>
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="business_hours_only" valuePropName="checked" initialValue={true}>
 <Switch /> {t('helpdesk.business_hours_only')}
 </Form.Item>
 </>
 )}
 </Form>
 </FormDialog>
 </div>
 );
}
