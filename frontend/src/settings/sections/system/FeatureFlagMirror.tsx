import React, { useEffect, useState } from 'react';
import { Alert, Table, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePermission } from '../../../hooks/usePermission';
import api from '../../../api';
import SectionCard from '../../../components/ui/SectionCard';
import { ExperimentOutlined } from '@ant-design/icons';

interface FlagRow {
  key: string;
  enabled?: boolean;
  rollout_percent?: number;
}

/** Read-only mirror of org-effective feature flags (vendor manages in Platform Console). */
const FeatureFlagMirror: React.FC = () => {
  const { t } = useTranslation();
  const { isTenantOrgAdmin } = usePermission();
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isTenantOrgAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<FlagRow[] | { flags?: FlagRow[] }>('/feature-flags');
        const list = Array.isArray(data) ? data : (data?.flags ?? []);
        if (!cancelled) setRows(list);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTenantOrgAdmin]);

  if (!isTenantOrgAdmin) return null;

  return (
    <SectionCard
      icon={<ExperimentOutlined />}
      title={t('settings.flags_mirror_title', 'Feature flags (read-only)')}
      description={t(
        'settings.flags_mirror_desc',
        'Flags are managed by your vendor in the platform console. Contact support to request changes.',
      )}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('settings.flags.contact_vendor', 'Contact your vendor to change rollout or enable new features.')}
      />
      <Table
        size="small"
        loading={loading}
        rowKey="key"
        pagination={false}
        dataSource={rows}
        columns={[
          { title: t('settings.flags.col_key', 'Flag'), dataIndex: 'key', key: 'key' },
          {
            title: t('settings.flags.col_enabled', 'Enabled'),
            dataIndex: 'enabled',
            key: 'enabled',
            render: (v: boolean) => (
              <Tag color={v ? 'green' : 'default'}>{v ? t('yes', 'Yes') : t('no', 'No')}</Tag>
            ),
          },
          {
            title: t('settings.flags.col_rollout', 'Rollout %'),
            dataIndex: 'rollout_percent',
            key: 'rollout',
            render: (v: number | undefined) => (v != null ? `${v}%` : '—'),
          },
        ]}
      />
    </SectionCard>
  );
};

export default FeatureFlagMirror;
