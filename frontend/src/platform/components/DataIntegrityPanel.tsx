import React, { useState } from 'react';
import { Alert, Button, Card, Input, Space, Table, Tag, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../api';

const DEMO_ORG_ID = '064a4a1a-487b-4835-a42a-4806ba8add72';

interface DriftRow {
  kind: string;
  entity_id: string;
  field: string;
  stored: number;
  computed: number;
  delta: number;
}

interface ReconcileSummary {
  org_id: string;
  drift_count: number;
  fixed: boolean;
  drifts: DriftRow[];
}

export default function DataIntegrityPanel() {
  const { t } = useTranslation();
  const [orgId, setOrgId] = useState(DEMO_ORG_ID);
  const [summary, setSummary] = useState<ReconcileSummary | null>(null);

  const scan = useMutation({
    mutationFn: async (fix: boolean) => {
      const method = fix ? 'post' : 'get';
      const res = await api.request<ReconcileSummary>({
        method,
        url: '/api/platform/health/reconcile',
        params: { org_id: orgId, fix: fix || undefined },
      });
      return res.data;
    },
    onSuccess: (data) => setSummary(data),
  });

  const columns = [
    { title: t('platform.reconcile.kind', 'Kind'), dataIndex: 'kind', key: 'kind' },
    { title: t('platform.reconcile.entity', 'Entity'), dataIndex: 'entity_id', key: 'entity_id' },
    { title: t('platform.reconcile.field', 'Field'), dataIndex: 'field', key: 'field' },
    {
      title: t('platform.reconcile.delta', 'Delta'),
      key: 'delta',
      render: (_: unknown, row: DriftRow) => (
        <Tag color={row.delta > 0.01 ? 'error' : 'success'}>{row.delta.toFixed(2)}</Tag>
      ),
    },
    {
      title: t('platform.reconcile.values', 'Stored → Computed'),
      key: 'values',
      render: (_: unknown, row: DriftRow) => (
        <Typography.Text type="secondary">
          {row.stored.toFixed(2)} → {row.computed.toFixed(2)}
        </Typography.Text>
      ),
    },
  ];

  return (
    <Card
      title={t('platform.reconcile.title', 'Data integrity reconcile')}
      style={{ marginTop: 16 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t(
            'platform.reconcile.hint',
            'Compares balance_due, stock_on_hand, and bank balances against movement/payment ledgers.',
          )}
        </Typography.Paragraph>
        <Space wrap>
          <Input
            style={{ minWidth: 320 }}
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder={t('platform.reconcile.org_id', 'Organization ID')}
          />
          <Button loading={scan.isPending} onClick={() => scan.mutate(false)}>
            {t('platform.reconcile.scan', 'Dry-run scan')}
          </Button>
          <Button
            danger
            loading={scan.isPending}
            onClick={() => scan.mutate(true)}
            disabled={!orgId}
          >
            {t('platform.reconcile.fix', 'Apply fix')}
          </Button>
        </Space>
        {summary && (
          <Alert
            type={summary.drift_count === 0 ? 'success' : 'warning'}
            showIcon
            message={
              summary.drift_count === 0
                ? t('platform.reconcile.clean', 'No drift detected')
                : t('platform.reconcile.found', '{{count}} drift(s) found', {
                    count: summary.drift_count,
                  })
            }
            description={
              summary.fixed
                ? t('platform.reconcile.fixed', 'Denormalized fields were updated.')
                : undefined
            }
          />
        )}
        {summary && summary.drifts.some((d) => d.kind === 'item') && (
          <Typography.Paragraph type="secondary">
            {t(
              'platform.reconcile.stock_hint',
              'Item stock drift may need opening_stock set on the product if inventory existed before movements were tracked.',
            )}
          </Typography.Paragraph>
        )}
        {summary && summary.drifts.length > 0 && (
          <Table
            size="small"
            rowKey={(r) => `${r.kind}-${r.entity_id}-${r.field}`}
            dataSource={summary.drifts}
            columns={columns}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Space>
    </Card>
  );
}
