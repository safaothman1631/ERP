import { useState } from 'react';
import { Button, Input, Space, Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import GlassCard from '../components/GlassCard';
import PlatformPageHeader from '../components/PlatformPageHeader';

export default function PlatformAuditPage() {
  const { t } = useTranslation();
  const [orgId, setOrgId] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'audit', orgId, action],
    queryFn: async () => (await api.get('/api/platform/audit', { params: { org_id: orgId || undefined, action: action || undefined } })).data,
  });

  const exportCsv = () => {
    window.open(`/api/platform/audit/export?org_id=${encodeURIComponent(orgId)}`, '_blank');
  };

  return (
    <>
      <PlatformPageHeader
        title={t('platform.audit.title', 'Audit log')}
        actions={<Button onClick={exportCsv}>{t('platform.export_csv', 'Export CSV')}</Button>}
      />
      <GlassCard>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder={t('platform.org_id', 'Organization ID')} value={orgId} onChange={e => setOrgId(e.target.value)} style={{ width: 220 }} />
          <Input placeholder={t('platform.action_prefix', 'Action prefix')} value={action} onChange={e => setAction(e.target.value)} style={{ width: 220 }} />
        </Space>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items || []}
          columns={[
            { title: t('created', 'Created'), dataIndex: 'created_at' },
            { title: t('platform.org', 'Organization'), dataIndex: 'org_id' },
            { title: t('platform.action', 'Action'), dataIndex: 'action' },
            { title: t('platform.user', 'User'), dataIndex: 'user_id' },
          ]}
          pagination={{ pageSize: 25 }}
        />
      </GlassCard>
    </>
  );
}