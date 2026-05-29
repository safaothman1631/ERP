/**
 * Settings → Payments → Reconciliation (launch-readiness § R4.14).
 *
 * Displays open issues from the nightly reconciliation job:
 *   * unmatched_inbound  — provider settled a payment we don't know about
 *   * unmatched_outbound — we marked succeeded but provider hasn't settled
 *   * amount_mismatch    — amounts disagree
 *
 * Each row exposes three resolution actions: Match Manually, Investigate,
 * Ignore (with audit reason).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../design-system';
import api from '../../../api';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface QueueIssue {
  id: string;
  provider_slug: string;
  kind: 'unmatched_inbound' | 'unmatched_outbound' | 'amount_mismatch';
  description: string;
  settlement_date: string;
  provider_reference?: string;
  local_payment_id?: string;
  expected_amount?: string;
  actual_amount?: string;
  status: 'open' | 'resolved';
}

const KIND_COLORS: Record<QueueIssue['kind'], string> = {
  unmatched_inbound: 'orange',
  unmatched_outbound: 'red',
  amount_mismatch: 'gold',
};

const ReconciliationPage: React.FC = () => {
  const { t } = useTranslation();
  const [issues, setIssues] = useState<QueueIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [providerFilter, setProviderFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [actionTarget, setActionTarget] = useState<QueueIssue | null>(null);
  const [actionKind, setActionKind] = useState<'match' | 'investigate' | 'ignore'>('investigate');
  const [actionReason, setActionReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { status: 'open' };
      if (providerFilter) params.provider = providerFilter;
      if (dateRange) {
        params.from = dateRange[0].toISOString();
        params.to = dateRange[1].toISOString();
      }
      const res = await api.get<{ items: QueueIssue[] }>(
        '/api/payments/reconciliation',
        { params },
      );
      setIssues(res.data.items ?? []);
    } catch {
      message.error(t('payments.recon.loadFailed', 'Failed to load reconciliation queue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [providerFilter, dateRange]);

  const handleResolve = async () => {
    if (!actionTarget) return;
    if (!actionReason.trim()) {
      message.warning(t('payments.recon.reasonRequired', 'Please provide a reason'));
      return;
    }
    try {
      await api.post(`/api/payments/reconciliation/${actionTarget.id}/resolve`, {
        resolution: actionKind,
        reason: actionReason,
      });
      message.success(t('payments.recon.resolved', 'Issue resolved'));
      setActionTarget(null);
      setActionReason('');
      load();
    } catch {
      message.error(t('payments.recon.resolveFailed', 'Resolve failed'));
    }
  };

  const columns = useMemo(() => [
    {
      title: t('payments.recon.provider', 'Provider'),
      dataIndex: 'provider_slug',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: t('payments.recon.kind', 'Kind'),
      dataIndex: 'kind',
      render: (v: QueueIssue['kind']) => <Tag color={KIND_COLORS[v]}>{v.replace('_', ' ')}</Tag>,
    },
    {
      title: t('payments.recon.description', 'Description'),
      dataIndex: 'description',
    },
    {
      title: t('payments.recon.settledOn', 'Settlement date'),
      dataIndex: 'settlement_date',
    },
    {
      title: t('payments.recon.expected', 'Expected'),
      dataIndex: 'expected_amount',
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('payments.recon.actual', 'Actual'),
      dataIndex: 'actual_amount',
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('common.actions', 'Actions'),
      render: (_: unknown, row: QueueIssue) => (
        <Space size="small">
          <Tooltip title={t('payments.recon.match', 'Match Manually')}>
            <Button size="small" onClick={() => { setActionTarget(row); setActionKind('match'); }}>
              {t('payments.recon.match', 'Match')}
            </Button>
          </Tooltip>
          <Tooltip title={t('payments.recon.investigate', 'Investigate')}>
            <Button size="small" onClick={() => { setActionTarget(row); setActionKind('investigate'); }}>
              {t('payments.recon.investigate', 'Investigate')}
            </Button>
          </Tooltip>
          <Tooltip title={t('payments.recon.ignore', 'Ignore')}>
            <Button size="small" danger onClick={() => { setActionTarget(row); setActionKind('ignore'); }}>
              {t('payments.recon.ignore', 'Ignore')}
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ], [t]);

  return (
    <div>
      <PageHeader
        title={t('payments.recon.title', 'Reconciliation Queue')}
        subtitle={t(
          'payments.recon.subtitle',
          'Discrepancies between provider settlements and local Payments.',
        )}
      />
      <Card style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder={t('payments.recon.filterProvider', 'Filter by provider')}
            value={providerFilter}
            onChange={setProviderFilter}
            style={{ minWidth: 180 }}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'cod', label: 'COD' },
              { value: 'stripe', label: 'Stripe' },
              { value: 'fastpay', label: 'FastPay' },
              { value: 'qi', label: 'Qi Card' },
              { value: 'zain', label: 'Zain Cash' },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={v => setDateRange(v as [Dayjs, Dayjs] | null)}
          />
        </Space>
      </Card>
      <Table<QueueIssue>
        rowKey="id"
        loading={loading}
        dataSource={issues}
        columns={columns}
        locale={{ emptyText: <Empty description={t('payments.recon.empty', 'No open issues')} /> }}
      />
      <Modal
        open={!!actionTarget}
        title={t('payments.recon.resolveTitle', 'Resolve issue')}
        onCancel={() => setActionTarget(null)}
        onOk={handleResolve}
        okText={t('common.confirm', 'Confirm')}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{actionTarget?.description}</Text>
          <Select
            value={actionKind}
            onChange={setActionKind}
            style={{ width: '100%' }}
            options={[
              { value: 'match', label: t('payments.recon.match', 'Match Manually') },
              { value: 'investigate', label: t('payments.recon.investigate', 'Investigate') },
              { value: 'ignore', label: t('payments.recon.ignore', 'Ignore') },
            ]}
          />
          <Input.TextArea
            rows={3}
            placeholder={t('payments.recon.reasonPlaceholder', 'Audit reason')}
            value={actionReason}
            onChange={e => setActionReason(e.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default ReconciliationPage;
