import { Button, InputNumber, Space, Switch, Table, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import GlassCard from '../components/GlassCard';
import PlatformPageHeader from '../components/PlatformPageHeader';

interface FlagRow {
  id: string;
  key?: string;
  enabled?: boolean;
  rollout_percent?: number;
}

export default function FeatureFlagsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'feature-flags'],
    queryFn: async () => (await api.get<{ items: FlagRow[] }>('/api/platform/feature-flags')).data.items,
  });

  const save = useMutation({
    mutationFn: (row: FlagRow) => api.put(`/api/platform/feature-flags/${row.id || row.key}`, {
      key: row.id || row.key,
      enabled: row.enabled,
      rollout_percent: row.rollout_percent,
    }),
    onSuccess: () => {
      message.success(t('platform.flag_saved', 'Flag saved'));
      void qc.invalidateQueries({ queryKey: ['platform', 'feature-flags'] });
    },
  });

  return (
    <>
      <PlatformPageHeader title={t('platform.nav.flags', 'Feature flags')} />
      <GlassCard>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data || []}
          columns={[
            { title: t('key', 'Key'), dataIndex: 'id' },
            {
              title: t('platform.enabled', 'Enabled'),
              render: (_, row) => (
                <Switch
                  checked={!!row.enabled}
                  onChange={checked => save.mutate({ ...row, enabled: checked })}
                />
              ),
            },
            {
              title: t('platform.rollout', 'Rollout %'),
              render: (_, row) => (
                <Space>
                  <InputNumber min={0} max={100} value={row.rollout_percent ?? 100} onChange={v => save.mutate({ ...row, rollout_percent: v ?? 100 })} />
                  <Button size="small" onClick={() => save.mutate(row)}>{t('save', 'Save')}</Button>
                </Space>
              ),
            },
          ]}
        />
      </GlassCard>
    </>
  );
}
