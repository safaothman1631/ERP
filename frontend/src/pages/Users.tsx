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
  Table,
  Tag,
  Button,
  Modal,
  Select,
  Space,
  Typography,
  Avatar,
  Input,
  Form,
  Dropdown,
  Tooltip,
  Empty,
  message as antMessage,
} from 'antd';
import type { TableColumnsType } from 'antd';
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
        antMessage.success(t('user_created', 'بەکارهێنەر دروستکرا'));
      } else if (formMode === 'invite') {
        const res = await api.post('/api/users/invite', {
          email: values.email,
          name: values.name,
          role_ids: values.role_ids || [],
        });
        setInviteResult(res.data?.invite || null);
        antMessage.success(t('invite_sent', 'بانگهێشت نێردرا'));
      } else if (formMode === 'edit' && editingRow) {
        await api.put(`/api/users/${editingRow.id}`, {
          name: values.name,
          status: values.status,
          role_ids: values.role_ids || [],
        });
        antMessage.success(t('saved', 'پاشەکەوتکرا'));
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
      suspend: t('confirm_suspend', 'دڵنیای لە ناچالاککردن؟'),
      activate: t('confirm_activate', 'دڵنیای لە چالاککردنەوە؟'),
      archive: t('confirm_archive', 'دڵنیای لە ئەرشیفکردن؟'),
      resend: t('confirm_resend', 'بانگهێشت دووبارە بنێرە؟'),
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
          antMessage.success(t('done', 'تەواوبوو'));
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
      antMessage.success(t('password_reset_done', 'وشەی نهێنی نوێ کرایەوە'));
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

  const columns: TableColumnsType<UserRow> = [
    {
      title: t('user', 'بەکارهێنەر'),
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
      title: t('status', 'دۆخ'),
      dataIndex: 'status',
      width: 130,
      render: (s: string) => <Tag color={STATUS_COLOR[s] || 'default'}>{t(`user_status_${s}`, s)}</Tag>,
    },
    {
      title: t('assigned_roles', 'ڕۆڵەکان'),
      dataIndex: 'assigned_roles',
      render: (list: RoleLabel[]) =>
        list?.length ? (
          <Space size={[4, 4]} wrap>
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
      title: t('last_login', 'دواین چوونەژوورەوە'),
      dataIndex: 'last_login_at',
      width: 180,
      render: (v: string | null) => <Text type="secondary">{formatDate(v)}</Text>,
    },
    {
      title: t('actions', 'کردارەکان'),
      key: 'actions',
      width: 120,
      render: (_, row) => {
        const isInvited = row.status === 'invited';
        const isActive = row.status === 'active';
        const isSuspended = row.status === 'suspended';
        const items = [
          { key: 'edit', icon: <EditOutlined />, label: t('edit', 'دەستکاری'), onClick: () => openEdit(row) },
          ...(isInvited
            ? [{ key: 'resend', icon: <MailOutlined />, label: t('resend_invite', 'بانگهێشت دووبارە بنێرە'), onClick: () => action(row, 'resend') }]
            : [{ key: 'reset', icon: <KeyOutlined />, label: t('reset_password', 'وشەی نهێنی بگۆڕە'), onClick: () => openReset(row) }]),
          ...(isActive
            ? [{ key: 'suspend', icon: <StopOutlined />, danger: true, label: t('suspend', 'ناچالاککردن'), onClick: () => action(row, 'suspend') }]
            : []),
          ...(isSuspended
            ? [{ key: 'activate', icon: <CheckCircleOutlined />, label: t('activate', 'چالاککردنەوە'), onClick: () => action(row, 'activate') }]
            : []),
          { type: 'divider' as const },
          { key: 'archive', icon: <DeleteOutlined />, danger: true, label: t('archive', 'ئەرشیف'), onClick: () => action(row, 'archive') },
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
    <div style={{ padding: 24 }}>
      <Title level={3}>
        <TeamOutlined /> {t('users', 'بەکارهێنەران')}
      </Title>

      <Card
        title={
          <Space>
            <span>{rows.length}</span>
            <Text type="secondary">{t('users', 'بەکارهێنەر')}</Text>
          </Space>
        }
        extra={
          <Space wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t('search', 'گەڕان...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Select
              placeholder={t('filter_status', 'دۆخ')}
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
              placeholder={t('filter_role', 'ڕۆڵ')}
              value={roleFilter}
              onChange={setRoleFilter}
              allowClear
              style={{ width: 200 }}
              options={roleOptions}
            />
            <Tooltip title={t('include_archived', 'ئەرشیفەکان پیشان بدە')}>
              <Button
                type={includeArchived ? 'primary' : 'default'}
                icon={<DeleteOutlined />}
                onClick={() => setIncludeArchived((v) => !v)}
              />
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={fetchAll} />
            <Button icon={<MailOutlined />} onClick={openInvite}>
              {t('invite_user', 'بانگهێشت بکە')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('add_user', 'بەکارهێنەری نوێ')}
            </Button>
          </Space>
        }
      >
        <Table<UserRow>
          dataSource={rows}
          rowKey="id"
          loading={loading}
          columns={columns}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{ emptyText: <Empty description={t('no_users', 'هیچ بەکارهێنەرێک نییە')} /> }}
        />
      </Card>

      {/* Form modal: create | edit | invite */}
      <Modal
        open={formOpen}
        title={
          formMode === 'create'
            ? t('add_user', 'بەکارهێنەری نوێ')
            : formMode === 'invite'
              ? t('invite_user', 'بانگهێشت بکە')
              : t('edit_user', 'دەستکاری بەکارهێنەر')
        }
        onCancel={() => setFormOpen(false)}
        onOk={submit}
        okText={formMode === 'invite' ? t('send_invite', 'بانگهێشت بنێرە') : t('save', 'پاشەکەوت')}
        cancelText={t('cancel', 'پاشگەزبوونەوە')}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('name', 'ناو')}
            rules={[{ required: true, min: 2, max: 80 }]}
          >
            <Input autoFocus />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('email', 'ئیمەیڵ')}
            rules={[{ required: true, type: 'email' }]}
          >
            <Input disabled={formMode === 'edit'} />
          </Form.Item>
          {formMode === 'create' && (
            <Form.Item
              name="password"
              label={t('password', 'وشەی نهێنی')}
              rules={[
                { required: true, min: 8 },
                {
                  validator: (_, val) => {
                    if (!val) return Promise.resolve();
                    if (!/[A-Z]/.test(val)) return Promise.reject(new Error(t('password_need_upper', 'پێویستە یەک پیتی گەورە')));
                    if (!/[0-9]/.test(val)) return Promise.reject(new Error(t('password_need_digit', 'پێویستە یەک ژمارە')));
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input.Password />
            </Form.Item>
          )}
          {formMode === 'edit' && (
            <Form.Item name="status" label={t('status', 'دۆخ')}>
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
            label={t('assigned_roles', 'ڕۆڵەکان')}
            tooltip={t('select_roles_hint', '')}
          >
            <Select
              mode="multiple"
              allowClear
              placeholder={t('select_roles', 'ڕۆڵ هەڵبژێرە')}
              options={roleOptions}
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset password modal */}
      <Modal
        open={resetOpen}
        title={t('reset_password', 'گۆڕینی وشەی نهێنی')}
        onCancel={() => setResetOpen(false)}
        onOk={submitReset}
        okText={t('save', 'پاشەکەوت')}
        cancelText={t('cancel', 'پاشگەزبوونەوە')}
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="new_password"
            label={t('new_password', 'وشەی نهێنی نوێ')}
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      {/* Invite result */}
      <Modal
        open={!!inviteResult}
        title={t('invite_link', 'لینکی بانگهێشت')}
        footer={null}
        onCancel={() => setInviteResult(null)}
      >
        <Text>{t('invite_share_hint', 'ئەم لینکە بۆ بەکارهێنەرەکە بنێرە (ئەگەر ئیمەیڵ سێتاپ نەکرابێت):')}</Text>
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
                antMessage.success(t('copied', 'کۆپی کرا'));
              }
            }}
          >
            {t('copy', 'کۆپی')}
          </Button>
          <Text type="secondary">
            {t('expires_in', 'بەسەردەچێت لە ')}
            {inviteResult?.expires_in_days} {t('days', 'ڕۆژ')}
          </Text>
        </Space>
      </Modal>
    </div>
  );
}
