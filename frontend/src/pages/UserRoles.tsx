import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Modal, Select, Space, Typography, Avatar, Input } from 'antd';
import { UserOutlined, SafetyOutlined, SearchOutlined } from '@ant-design/icons';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';

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

export default function UserRoles() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api.get('/api/rbac/users'),
        api.get('/api/rbac/roles'),
      ]);
      setUsers(u.data);
      setRoles(dedupeBy(r.data, (role: any) => role.id || role.code));
    } catch { message.error(t('error')); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openAssign = (u: any) => {
    setEditing(u);
    setSelectedRoleIds(dedupeBy(u.assigned_roles || [], (role: any) => role.id).map((role: any) => role.id));
  };

  const saveAssignment = async () => {
    try {
      await api.put(`/api/rbac/users/${editing.id}/roles`, { role_ids: selectedRoleIds });
      message.success(t('saved'));
      setEditing(null);
      fetchAll();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || t('error'));
    }
  };

  const filtered = users.filter(u =>
    !search ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}><SafetyOutlined /> {t('user_roles') || 'Users & Role Assignment'}</Title>

      <Card
        title={`${filtered.length} ${t('users') || 'users'}`}
        extra={
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('search') || 'Search...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
        }
      >
        <Table
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: t('user') || 'User',
              render: (_, u) => (
                <Space>
                  <Avatar icon={<UserOutlined />} />
                  <div>
                    <div><strong>{u.full_name || u.email}</strong></div>
                    <div style={{ fontSize: 12, color: '#888' }}>{u.email}</div>
                  </div>
                </Space>
              ),
            },
            {
              title: t('legacy_role') || 'Legacy Role',
              dataIndex: 'legacy_role',
              render: (r) => r ? <Tag color={r === 'admin' ? 'red' : 'blue'}>{r}</Tag> : '-',
            },
            {
              title: t('assigned_roles') || 'Assigned Roles',
              dataIndex: 'assigned_roles',
              render: (list: any[]) =>
                list?.length
                  ? dedupeBy(list, (role: any) => role.id).map(r => <Tag color="green" key={r.id}>{r.name}</Tag>)
                  : <span style={{ color: '#aaa' }}>—</span>,
            },
            {
              title: t('status') || 'Status',
              dataIndex: 'is_active',
              render: (v) => v ? <Tag color="success">Active</Tag> : <Tag color="default">Inactive</Tag>,
            },
            {
              title: '',
              render: (_, u) => (
                <Button type="link" onClick={() => openAssign(u)}>
                  {t('assign_roles') || 'Assign Roles'}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={`${t('assign_roles') || 'Assign Roles'}: ${editing?.full_name || editing?.email || ''}`}
        open={!!editing}
        onOk={saveAssignment}
        onCancel={() => setEditing(null)}
        width={600}
      >
        <p>{t('select_roles_hint') || 'Select roles to assign to this user. Multiple roles stack permissions.'}</p>
        <Select
          mode="multiple"
          value={selectedRoleIds}
          onChange={setSelectedRoleIds}
          style={{ width: '100%' }}
          placeholder={t('select_roles') || 'Select roles'}
          options={roles.map((r: any) => ({
            label: `${r.name} (${r.code})`,
            value: r.id,
          }))}
        />
      </Modal>
    </div>
  );
}
