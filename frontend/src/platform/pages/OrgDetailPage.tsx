import { Button, Space, Tabs, Tag, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import api from '../../api';
import { useAuthStore } from '../../store';
import { useImpersonationStore } from '../store/impersonationStore';
import GlassCard from '../components/GlassCard';
import PlatformPageHeader from '../components/PlatformPageHeader';
import LicenseEditorPage from './LicenseEditorPage';

export default function OrgDetailPage() {
  const { orgId = '' } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { login, token, userId, orgId: myOrgId, userName } = useAuthStore();
  const saveAdmin = useImpersonationStore(s => s.saveAdminSession);

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'org', orgId],
    queryFn: async () => (await api.get(`/api/platform/orgs/${orgId}`)).data,
    enabled: !!orgId,
  });

  const suspend = useMutation({
    mutationFn: (status: 'active' | 'suspended') => api.patch(`/api/platform/orgs/${orgId}`, { status }),
    onSuccess: () => {
      message.success(t('platform.org_updated', 'Organization updated'));
      void qc.invalidateQueries({ queryKey: ['platform', 'org', orgId] });
    },
  });

  const enterOrg = async () => {
    const users = await api.get<{ items: { id: string; role?: string }[] }>('/api/platform/users', { params: { org_id: orgId, limit: 50 } });
    const owner = users.data.items.find(u => u.role === 'owner' || u.role === 'admin') || users.data.items[0];
    if (!owner) {
      message.error(t('platform.no_owner', 'No user found for this organization'));
      return;
    }
    if (token && userId && myOrgId && userName) {
      saveAdmin({ token, userId, orgId: myOrgId, userName, userRole: localStorage.getItem('userRole') });
    }
    const res = await api.post('/api/platform/impersonate', { target_user_id: owner.id });
    login(res.data.access_token, res.data.user_id, res.data.org_id, res.data.user_name, res.data.role);
    window.location.href = '/dashboard';
  };

  if (isLoading) return <GlassCard>{t('loading', 'Loading…')}</GlassCard>;
  if (!data) return <GlassCard>{t('platform.org_not_found', 'Organization not found')}</GlassCard>;

  return (
    <>
      <PlatformPageHeader
        title={data.name}
        subtitle={orgId}
        actions={(
          <Space>
            <Link to="/platform/orgs"><Button>{t('back', 'Back')}</Button></Link>
            {data.status === 'suspended' ? (
              <Button onClick={() => suspend.mutate('active')}>{t('platform.unsuspend', 'Unsuspend')}</Button>
            ) : (
              <Button danger onClick={() => suspend.mutate('suspended')}>{t('platform.suspend', 'Suspend')}</Button>
            )}
            <Button type="primary" onClick={enterOrg}>{t('platform.enter_org', 'Enter organization')}</Button>
          </Space>
        )}
      />
      <Tag color={data.status === 'suspended' ? 'red' : 'green'}>{data.status}</Tag>
      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'overview',
            label: t('platform.tab.overview', 'Overview'),
            children: (
              <GlassCard>
                <p>{t('platform.users_count', 'Users')}: {data.user_count}</p>
                <p>{t('platform.bundle', 'Bundle')}: {data.license?.bundle_id || '—'}</p>
              </GlassCard>
            ),
          },
          {
            key: 'license',
            label: t('platform.tab.license', 'License'),
            children: <LicenseEditorPage orgIdProp={orgId} embedded />,
          },
        ]}
      />
    </>
  );
}
