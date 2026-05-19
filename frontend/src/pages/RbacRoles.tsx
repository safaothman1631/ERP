import { useEffect, useState } from 'react';
import { Card, Tag, Button, Form, Input, Select, Space, Typography, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

const { Title } = Typography;

const dedupeBy = <T,>(items: T[], getKey: (item: T) => string) => {
 const seen = new Set<string>();
 return items.filter((item) => {
 const key = getKey(item);
 if (!key || seen.has(key)) {
 return false;
 }
 seen.add(key);
 return true;
 });
};

export default function RbacRoles() {
 const { t } = useTranslation();
 const [roles, setRoles] = useState<any[]>([]);
 const [perms, setPerms] = useState<string[]>([]);
 const [myPerms, setMyPerms] = useState<string[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editing, setEditing] = useState<any>(null);
 const [form] = Form.useForm();

 const fetchAll = async () => {
 setLoading(true);
 try {
 const [r, p, m] = await Promise.all([
 api.get('/api/rbac/roles'),
 api.get('/api/rbac/permissions'),
 api.get('/api/rbac/me/permissions'),
 ]);
 setRoles(dedupeBy(r.data, (role: any) => role.id || role.code));
 setPerms(p.data.permissions);
 setMyPerms(m.data.permissions);
 } catch { message.error(t('error')); }
 setLoading(false);
 };

 useEffect(() => { fetchAll(); }, []);

 const onSave = async () => {
 const values = await form.validateFields();
 try {
 if (editing && !editing.is_system) {
 await api.put(`/api/rbac/roles/${editing.id}`, values);
 } else {
 await api.post('/api/rbac/roles', values);
 }
 message.success(t('saved'));
 setModalOpen(false);
 setEditing(null);
 form.resetFields();
 fetchAll();
 } catch (e: any) {
 message.error(e?.response?.data?.detail || t('error'));
 }
 };

 const onDelete = async (id: string) => {
 Modal.confirm({
 title: t('confirm_delete') || 'Delete?',
 onOk: async () => {
 try {
 await api.delete(`/api/rbac/roles/${id}`);
 message.success(t('deleted'));
 fetchAll();
 } catch (e: any) {
 message.error(e?.response?.data?.detail || t('error'));
 }
 },
 });
 };

 const openEdit = (role?: any) => {
 if (role) {
 setEditing(role);
 form.setFieldsValue(role);
 } else {
 setEditing(null);
 form.resetFields();
 }
 setModalOpen(true);
 };

 return (
 <div style={{ padding: 24 }}>
 <Title level={3}><SafetyOutlined /> RBAC — Roles & Permissions</Title>

 <Card style={{ marginBottom: 16 }}>
 <strong>My permissions:</strong>{' '}
 {myPerms.includes('*') ? <Tag color="red">Superuser (*)</Tag> :
 <span>{myPerms.length} permissions</span>}
 </Card>

 <Card title="Roles" extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>New Role</Button>
 }>
 <ResponsiveTableAdapter
 dataSource={roles}
 rowKey="id"
 loading={loading}
 pagination={false}
 columns={[
 { title: 'Code', dataIndex: 'code', render: (v, r) => (
 <Space>
 <Tag color="blue">{v}</Tag>
 {r.is_system && <Tag color="gold">System</Tag>}
 </Space>
 )},
 { title: 'Name', dataIndex: 'name' },
 { title: 'ناو', dataIndex: 'name_ku' },
 { title: 'Permissions', dataIndex: 'permissions', render: (p: string[]) => (
 p.includes('*') ? <Tag color="red">ALL (*)</Tag> : <Tag>{p.length}</Tag>
 )},
 {
 title: '',
 render: (_: any, r: any) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openEdit(r)} disabled={r.is_system} />
 <Button danger icon={<DeleteOutlined />} onClick={() => onDelete(r.id)} disabled={r.is_system} />
 </Space>
 ),
 },
 ]}
 />
 </Card>

 <FormDialog
 title={editing ? `Edit: ${editing.name}` : 'New Role'}
 open={modalOpen}
 onOk={onSave}
 onClose={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="code" label="Code" rules={[{ required: true }]}>
 <Input placeholder="e.g. sales_viewer" />
 </Form.Item>
 <Form.Item name="name" label="Name (EN)" rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="name_ku" label="ناو (کوردی)">
 <Input />
 </Form.Item>
 <Form.Item name="permissions" label="Permissions" rules={[{ required: true }]}>
 <Select
 mode="multiple"
 showSearch
 placeholder="Select permissions"
 options={perms.map(p => ({ label: p, value: p }))}
 maxTagCount={10}
 />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
