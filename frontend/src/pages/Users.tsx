/**
 * User Management page (admin).
 *
 * Replaces the older `/user-roles` page by combining list + create + edit +
 * lifecycle (suspend / activate / archive) + invite + role assignment in a
 * single screen, modelled after Zoho People / Odoo `res.users` admin views.
 */
import { useEffect, useMemo, useState } from 'react';
import {
 Card,
 Tag,
 Button,
 Select,
 Space,
 Typography,
 Avatar,
 Input,
 Form,
 Dropdown,
 Tooltip,
 Empty,
 message as antMessage, Modal } from 'antd';

import {
 UserOutlined,
 TeamOutlined,
 PlusOutlined,
 MailOutlined,
 SearchOutlined,
 MoreOutlined,
 KeyOutlined,
 StopOutlined,
 CheckCircleOutlined,
 DeleteOutlined,
 EditOutlined,
 ReloadOutlined,
 CopyOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';
import { HelpIcon } from '../help/HelpIcon';

const { Title, Text } = Typography;

// ── Types ──
interface RoleLabel {
 id: string;
 code?: string;
 name?: string;
 name_ku?: string;
}

interface UserRow {
 id: string;
 email: string;
 name?: string;
 status: 'invited' | 'active' | 'suspended' | 'archived';
 is_active: boolean;
 legacy_role?: string;
 auth_provider?: string;
 is_2fa_enabled?: boolean;
 last_login_at?: string | null;
 invited_at?: string | null;
 accepted_at?: string | null;
 created_at?: string | null;
 role_ids: string[];
 assigned_roles: RoleLabel[];
}

interface RoleOption {
 id: string;
 code?: string;
 name?: string;
 name_ku?: string;
}

type FormMode = 'create' | 'edit' | 'invite';

const STATUS_COLOR: Record<string, string> = {
 active: 'success',
 invited: 'processing',
 suspended: 'warning',
 archived: 'default',
};

function formatDate(value?: string | null): string {
 if (!value) return '—';
 try {
 const d = new Date(value);
 if (Number.isNaN(d.getTime())) return '—';
 return d.toLocaleString();
 } catch {
 return '—';
 }
}

export default function Users() {
 const { t } = useTranslation();
 const [rows, setRows] = useState<UserRow[]>([]);
 const [roles, setRoles] = useState<RoleOption[]>([]);
 const [loading, setLoading] = useState(false);

 // AddGate: wire Selective Add for users section (R9.1, R9.5)
 const addGate = useAddGate('users.list');

 const [statusFilter, setStatusFilter] = useState<string | undefined>();
 const [roleFilter, setRoleFilter] = useState<string | undefined>();
 const [includeArchived, setIncludeArchived] = useState(false);
 const [search, setSearch] = useState('');

 const [formOpen, setFormOpen] = useState(false);
 const [formMode, setFormMode] = useState<FormMode>('create');
 const [editingRow, setEditingRow] = useState<UserRow | null>(null);
 const [form] = Form.useForm();

 const [resetOpen, setResetOpen] = useState(false);
 const [resetForm] = Form.useForm();

 const [inviteResult, setInviteResult] = useState<{ accept_url: string; expires_in_days: number } | null>(null);

 const fetchAll = async () => {
 setLoading(true);
 try {
 const params: Record<string, string | boolean> = {};
 if (statusFilter) params.status = statusFilter;
 if (roleFilter) params.role_id = roleFilter;
 if (search) params.q = search;
 if (includeArchived) params.include_archived = true;
 const [u, r] = await Promise.all([
 api.get('/api/users', { params }),
 api.get('/api/rbac/roles'),
 ]);
 setRows(u.data.items || []);
 setRoles(r.data || []);
 } catch (e) {
 antMessage.error(t('error', 'Error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchAll();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [statusFilter, roleFilter, includeArchived]);

 // Debounce search separately
 useEffect(() => {
 const id = setTimeout(() => {
 fetchAll();
 }, 350);
 return () => clearTimeout(id);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [search]);

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(rows.length); }, [rows.length, addGate.setRecordCount]);

 const openCreate = () => {
 setFormMode('create');
 setEditingRow(null);
 form.resetFields();
 setFormOpen(true);
 };

 const openInvite = () => {
 setFormMode('invite');
 setEditingRow(null);
 form.resetFields();
 setFormOpen(true);
 };

 const openEdit = (row: UserRow) => {
 setFormMode('edit');
 setEditingRow(row);
 form.setFieldsValue({
 name: row.name,
 email: row.email,
 status: row.status,
 role_ids: row.role_ids,
 });
 setFormOpen(true);
 };

 const submit = async () => {
 try {
 const values = await form.validateFields();
 if (formMode === 'create') {
 await api.post('/api/users', {
 email: values.email,
 name: values.name,
 password: values.password,
 role_ids: values.role_ids || [],
 });
 antMessage.success(t('user_created', 'User created'));
 } else if (formMode === 'invite') {
 const res = await api.post('/api/users/invite', {
 email: values.email,
 name: values.name,
 role_ids: values.role_ids || [],
 });
 setInviteResult(res.data?.invite || null);
 antMessage.success(t('invite_sent', 'Invitation sent'));
 } else if (formMode === 'edit' && editingRow) {
 await api.put(`/api/users/${editingRow.id}`, {
 name: values.name,
 status: values.status,
 role_ids: values.role_ids || [],
 });
 antMessage.success(t('saved', 'Saved'));
 }
 setFormOpen(false);
 fetchAll();
 } catch (e: unknown) {
 const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
 if (detail) {
 antMessage.error(detail);
 } else if ((e as { errorFields?: unknown[] }).errorFields) {
 // Form validation error — antd shows inline; nothing to do
 } else {
 antMessage.error(t('error', 'Error'));
 }
 }
 };

 const action = async (row: UserRow, kind: 'suspend' | 'activate' | 'archive' | 'resend') => {
 const labels: Record<string, string> = {
 suspend: t('confirm_suspend', 'Are you sure you want to suspend?'),
 activate: t('confirm_activate', 'Are you sure you want to activate?'),
 archive: t('confirm_archive', 'Archive this record?'),
 resend: t('confirm_resend', 'Resend the invitation?'),
 };
 Modal.confirm({
 title: labels[kind],
 content: `${row.name || row.email}`,
 okType: kind === 'archive' || kind === 'suspend' ? 'danger' : 'primary',
 onOk: async () => {
 try {
 if (kind === 'suspend') await api.post(`/api/users/${row.id}/suspend`);
 else if (kind === 'activate') await api.post(`/api/users/${row.id}/activate`);
 else if (kind === 'archive') await api.delete(`/api/users/${row.id}`);
 else if (kind === 'resend') {
 const res = await api.post(`/api/users/invite/${row.id}/resend`);
 setInviteResult({ accept_url: res.data.accept_url, expires_in_days: res.data.expires_in_days });
 }
 antMessage.success(t('done', 'Done'));
 fetchAll();
 } catch (e: unknown) {
 const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
 antMessage.error(detail || t('error', 'Error'));
 }
 },
 });
 };

 const openReset = (row: UserRow) => {
 setEditingRow(row);
 resetForm.resetFields();
 setResetOpen(true);
 };

 const submitReset = async () => {
 try {
 const values = await resetForm.validateFields();
 if (!editingRow) return;
 await api.post(`/api/users/${editingRow.id}/reset-password`, {
 new_password: values.new_password,
 });
 antMessage.success(t('password_reset_done', 'Password has been reset'));
 setResetOpen(false);
 } catch (e: unknown) {
 const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
 if (detail) antMessage.error(detail);
 }
 };

 const roleOptions = useMemo(
 () =>
 roles.map((r) => ({
 label: r.name_ku || r.name || r.code || r.id,
 value: r.id,
 })),
 [roles],
 );

 const columns: any[] = [
 {
 title: t('user', 'User'),
 key: 'user',
 render: (_, u) => (
 <Space>
 <Avatar style={{ backgroundColor: '#6366f1' }} icon={<UserOutlined />}>
 {(u.name || u.email || '?').charAt(0).toUpperCase()}
 </Avatar>
 <div>
 <div><strong>{u.name || u.email}</strong></div>
 <div style={{ fontSize: 12, color: '#888' }}>{u.email}</div>
 </div>
 </Space>
 ),
 },
 {
 title: t('status', 'Status'),
 dataIndex: 'status',
 width: 130,
 render: (s: string) => <Tag color={STATUS_COLOR[s] || 'default'}>{t(`user_status_${s}`, s)}</Tag>,
 },
 {
 title: t('assigned_roles', 'Assigned Roles'),
 dataIndex: 'assigned_roles',
 render: (list: RoleLabel[]) =>
 list?.length ? (
 <Space wrap>
 {list.map((r) => (
 <Tag color="blue" key={r.id}>
 {r.name_ku || r.name || r.code}
 </Tag>
 ))}
 </Space>
 ) : (
 <Text type="secondary">—</Text>
 ),
 },
 {
 title: t('last_login', 'Last Login'),
 dataIndex: 'last_login_at',
 width: 180,
 render: (v: string | null) => <Text type="secondary">{formatDate(v)}</Text>,
 },
 {
 title: t('actions', 'Actions'),
 key: 'actions',
 width: 120,
 render: (_, row) => {
 const isInvited = row.status === 'invited';
 const isActive = row.status === 'active';
 const isSuspended = row.status === 'suspended';
 const items = [
 { key: 'edit', icon: <EditOutlined />, label: t('edit', 'Edit'), onClick: () => openEdit(row) },
 ...(isInvited
 ? [{ key: 'resend', icon: <MailOutlined />, label: t('resend_invite', 'Resend invitation'), onClick: () => action(row, 'resend') }]
 : [{ key: 'reset', icon: <KeyOutlined />, label: t('reset_password', 'Reset password'), onClick: () => openReset(row) }]),
 ...(isActive
 ? [{ key: 'suspend', icon: <StopOutlined />, danger: true, label: t('suspend', 'Suspend'), onClick: () => action(row, 'suspend') }]
 : []),
 ...(isSuspended
 ? [{ key: 'activate', icon: <CheckCircleOutlined />, label: t('activate', 'Activate'), onClick: () => action(row, 'activate') }]
 : []),
 { type: 'divider' as const },
 { key: 'archive', icon: <DeleteOutlined />, danger: true, label: t('archive', 'Archive'), onClick: () => action(row, 'archive') },
 ];
 return (
 <Dropdown menu={{ items }} trigger={['click']}>
 <Button type="text" icon={<MoreOutlined />} />
 </Dropdown>
 );
 },
 },
 ];

 return (
 <div style={{ padding: 24 }} data-addgate-section="users.list" data-section-id="users.list">
 <Title level={3} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
 <TeamOutlined /> {t('users', 'Users')}
 <HelpIcon sectionId="users.list" />
 </Title>

 <Card
 title={
 <Space>
 <span>{rows.length}</span>
 <Text type="secondary">{t('users', 'Users')}</Text>
 </Space>
 }
 extra={
 <Space wrap>
 <Input
 prefix={<SearchOutlined />}
 placeholder={t('search', 'Search')}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 style={{ width: 220 }}
 allowClear
 />
 <Select
 placeholder={t('filter_status', 'Filter by Status')}
 value={statusFilter}
 onChange={setStatusFilter}
 allowClear
 style={{ width: 140 }}
 options={[
 { value: 'active', label: t('user_status_active', 'Active') },
 { value: 'invited', label: t('user_status_invited', 'Invited') },
 { value: 'suspended', label: t('user_status_suspended', 'Suspended') },
 { value: 'archived', label: t('user_status_archived', 'Archived') },
 ]}
 />
 <Select
 placeholder={t('filter_role', 'Filter by role')}
 value={roleFilter}
 onChange={setRoleFilter}
 allowClear
 style={{ width: 200 }}
 options={roleOptions}
 />
 <Tooltip title={t('include_archived', 'Show archived')}>
 <Button
 type={includeArchived ? 'primary' : 'default'}
 icon={<DeleteOutlined />}
 onClick={() => setIncludeArchived((v) => !v)}
 />
 </Tooltip>
 <Button icon={<ReloadOutlined />} onClick={fetchAll} />
 <Button icon={<MailOutlined />} onClick={openInvite}>
 {t('invite_user', 'Invite')}
 </Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} data-add-action="users.list">
 {t('add_user', 'Add user')}
 </Button>
 </Space>
 }
 >
 <ResponsiveTableAdapter<UserRow>
 dataSource={rows}
 rowKey="id"
 loading={loading}
 columns={columns}
 pagination={{ pageSize: 20, showSizeChanger: true }}
 locale={{ emptyText: <Empty description={t('no_users', 'No users')} /> }}
 />
 </Card>

 {/* Form modal: create | edit | invite */}
 <FormDialog
 open={formOpen}
 title={
 formMode === 'create'
 ? t('add_user', 'Add user')
 : formMode === 'invite'
 ? t('invite_user', 'Invite')
 : t('edit_user', 'Edit user')
 }
 onClose={() => setFormOpen(false)}
 onOk={submit}
 >
 <Form form={form} layout="vertical">
 <Form.Item
 name="name"
 label={t('name', 'Name')}
 rules={[{ required: true, min: 2, max: 80 }]}
 >
 <Input autoFocus />
 </Form.Item>
 <Form.Item
 name="email"
 label={t('email', 'Email')}
 rules={[{ required: true, type: 'email' }]}
 >
 <Input disabled={formMode === 'edit'} />
 </Form.Item>
 {formMode === 'create' && (
 <Form.Item
 name="password"
 label={t('password', 'Password')}
 rules={[
 { required: true, min: 8 },
 {
 validator: (_, val) => {
 if (!val) return Promise.resolve();
 if (!/[A-Z]/.test(val)) return Promise.reject(new Error(t('password_need_upper', 'Password must contain at least one uppercase letter')));
 if (!/[0-9]/.test(val)) return Promise.reject(new Error(t('password_need_digit', 'Password must contain at least one digit')));
 return Promise.resolve();
 },
 },
 ]}
 >
 <Input.Password />
 </Form.Item>
 )}
 {formMode === 'edit' && (
 <Form.Item name="status" label={t('status', 'Status')}>
 <Select
 options={[
 { value: 'active', label: t('user_status_active', 'Active') },
 { value: 'suspended', label: t('user_status_suspended', 'Suspended') },
 { value: 'archived', label: t('user_status_archived', 'Archived') },
 ]}
 />
 </Form.Item>
 )}
 <Form.Item
 name="role_ids"
 label={t('assigned_roles', 'Assigned Roles')}
 tooltip={t('select_roles_hint', '')}
 >
 <Select
 mode="multiple"
 allowClear
 placeholder={t('select_roles', 'Select roles')}
 options={roleOptions}
 optionFilterProp="label"
 />
 </Form.Item>
 </Form>
 </FormDialog>

 {/* Reset password modal */}
 <FormDialog
 open={resetOpen}
 title={t('reset_password', 'Reset password')}
 onClose={() => setResetOpen(false)}
 onOk={submitReset}
 >
 <Form form={resetForm} layout="vertical">
 <Form.Item
 name="new_password"
 label={t('new_password', 'New Password')}
 rules={[{ required: true, min: 8 }]}
 >
 <Input.Password autoFocus />
 </Form.Item>
 </Form>
 </FormDialog>

 {/* Invite result */}
 <FormDialog
 open={!!inviteResult}
 title={t('invite_link', 'Invitation link')}
 hideFooter onClose={() => setInviteResult(null)}
 >
 <Text>{t('invite_share_hint', 'Share this link with the user (in case email is not configured):')}</Text>
 <Input.TextArea
 value={inviteResult?.accept_url}
 readOnly
 autoSize={{ minRows: 2, maxRows: 4 }}
 style={{ marginTop: 12 }}
 />
 <Space style={{ marginTop: 12 }}>
 <Button
 icon={<CopyOutlined />}
 onClick={() => {
 if (inviteResult?.accept_url) {
 navigator.clipboard.writeText(inviteResult.accept_url);
 antMessage.success(t('copied', 'Copied'));
 }
 }}
 >
 {t('copy', 'Copy')}
 </Button>
 <Text type="secondary">
 {t('expires_in', 'Expires in ')}
 {inviteResult?.expires_in_days} {t('days', 'days')}
 </Text>
 </Space>
 </FormDialog>
 </div>
 );
}
