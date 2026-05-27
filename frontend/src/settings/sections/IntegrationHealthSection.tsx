import React, { useCallback, useEffect, useState } from 'react';
import { Button, Space, Tag } from 'antd';
import { ClusterOutlined, RightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../api';
import SectionCard from '../../components/ui/SectionCard';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

type IntegrationStatus = 'ok' | 'preview' | 'missing';

interface IntegrationHealthRow {
  key: string;
  label: string;
  status: IntegrationStatus;
  configure_url: string;
  message: string;
}

const STATUS_COLOR: Record<IntegrationStatus, string> = {
  ok: 'green',
  preview: 'orange',
  missing: 'red',
};

const IntegrationHealthSection: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<IntegrationHealthRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/settings/integration-health');
      setRows(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = (status: IntegrationStatus) => {
    if (status === 'ok') return t('int_health_ok', 'OK');
    if (status === 'preview') return t('int_health_preview', 'Preview');
    return t('int_health_missing', 'Missing');
  };

  return (
    <SectionCard
      icon={<ClusterOutlined />}
      title={t('int_health_title', 'Integration health')}
      description={t(
        'int_health_desc',
        'Live readiness of e-invoice, payments, messaging, and outbound integrations.',
      )}
      loading={loading}
    >
      <ResponsiveTableAdapter
        rowKey="key"
        dataSource={rows}
        pagination={false}
        size="middle"
        columns={[
          {
            title: t('int_health_integration', 'Integration'),
            dataIndex: 'label',
            key: 'label',
          },
          {
            title: t('status', 'Status'),
            dataIndex: 'status',
            key: 'status',
            render: (status: IntegrationStatus) => (
              <Tag color={STATUS_COLOR[status] || 'default'}>{statusLabel(status)}</Tag>
            ),
          },
          {
            title: t('int_health_detail', 'Detail'),
            dataIndex: 'message',
            key: 'message',
            render: (msg: string) => msg || '—',
          },
          {
            title: t('action', 'Action'),
            key: 'action',
            width: 140,
            render: (_: unknown, row: IntegrationHealthRow) => (
              <Link to={row.configure_url}>
                <Button type="link" size="small" icon={<RightOutlined />}>
                  {t('configure', 'Configure')}
                </Button>
              </Link>
            ),
          },
        ]}
      />
      <Space style={{ marginTop: 12 }}>
        <Button size="small" onClick={load} loading={loading}>
          {t('refresh', 'Refresh')}
        </Button>
      </Space>
    </SectionCard>
  );
};

export default IntegrationHealthSection;
