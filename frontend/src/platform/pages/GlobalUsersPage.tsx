import { useState } from 'react';
import { Button, Input, Space, Table, Tag, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import GlassCard from '../components/GlassCard';
import PlatformPageHeader from '../components/PlatformPageHeader';

interface UserRow {
  id: string;
  email?: string;
  display_name?: string;
  org_id?: string;
  role?: string;
  is_active?: boolean;
  locked_until?: string | null;
}

export default function GlobalUsersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'users', q],
    queryFn: async () => (await api.get<{ items: UserRow[] }>('/api/platform/users', { params: { q: q || undefined } })).data.items,
  });

  const unlock = useMutation({
    mutationFn: (id: string) => api.post(`/api/platform/users/${id}/unlock`),
    onSuccess: () => {
      message.success(t('platform.user_unlocked', 'User unlocked'));
      void qc.invalidateQueries({ queryKey: ['platform', 'users'] });
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.post(`/api/platform/users/${id}/deactivate`),
    onSuccess: () => {
      message.success(t('platform.user_deactivated', 'User deactivated'));
      void qc.invalidateQueries({ queryKey: ['platform', 'users'] });
    },
  });

  return (
    <>
      <PlatformPageHeader
        title={t('platform.users.title', 'Users')}
        subtitle={t('platform.users.subtitle', 'Cross-organization user search')}
      />
      <GlassCard>
        <Input.Search placeholder={t('platform.search_users', 'Search email or name')} onSearch={setQ} style={{ maxWidth: 360, marginBottom: 16 }} />
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data || []}
          columns={[
            { title: t('email', 'Email'), dataIndex: 'email' },
            { title: t('name', 'Name'), dataIndex: 'display_name' },
            { title: t('platform.org', 'Organization'), dataIndex: 'org_id', ellipsis: true },
            { title: t('role', 'Role'), dataIndex: 'role' },
            {
              title: t('status', 'Status'),
              render: (_, row) => (
                <Space>
                  <Tag color={row.is_active === false ? 'red' : 'green'}>{row.is_active === false ? 'inactive' : 'active'}</Tag>
                  {row.locked_until && <Tag color="orange">{t('platform.locked', 'Locked')}</Tag>}
                </Space>
              ),
            },
            {
              title: t('actions', 'Actions'),
              render: (_, row) => (
                <Space>
                  {row.locked_until && <Button size="small" onClick={() => unlock.mutate(row.id)}>{t('platform.unlock', 'Unlock')}</Button>}
                  {row.is_active !== false && <Button size="small" danger onClick={() => deactivate.mutate(row.id)}>{t('platform.deactivate', 'Deactivate')}</Button>}
                </Space>
              ),
            },
          ]}
        />
      </GlassCard>
    </>
  );
}
