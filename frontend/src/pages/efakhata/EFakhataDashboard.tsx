/**
 * Iraq e-Fakhata submissions dashboard (growth-to-100 § R4 / G4a).
 *
 * Lists every MoF submission for the active tenant with status badges,
 * filter chips, and a click-through to the detail view. The list is
 * paged on the server side via ``GET /api/efakhata/submissions``.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  DatePicker,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, FilterBar, SectionCard, StatusTag } from '../../design-system';
import type { StatusKind } from '../../design-system';

const { Text } = Typography;

interface Submission {
  id: string;
  invoice_id: string;
  status:
    | 'pending'
    | 'submitting'
    | 'submitted'
    | 'acknowledged'
    | 'rejected'
    | 'failed'
    | 'cancelled';
  attempts: number;
  mof_ack_number?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at?: string;
  next_attempt_at?: string;
}

const STATUS_KIND: Record<string, StatusKind> = {
  pending: 'default',
  submitting: 'info',
  submitted: 'info',
  acknowledged: 'success',
  rejected: 'error',
  failed: 'warning',
  cancelled: 'default',
};

const EFakhataDashboard: React.FC = () => {
  const { t } = useTranslation('efakhata');
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (dateRange) {
        params.from_date = dateRange[0].toISOString();
        params.to_date = dateRange[1].toISOString();
      }
      const res = await api.get('/api/efakhata/submissions', { params });
      setItems(res.data.items || []);
    } catch (_err) {
      message.error(t('list_load_failed', 'Failed to load submissions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateRange]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  const columns: ColumnsType<Submission> = [
    {
      title: t('col_invoice', 'Invoice'),
      dataIndex: 'invoice_id',
      render: (id: string) => (
        <Link to={`/invoices/${id}`}>
          <Text code>{id}</Text>
        </Link>
      ),
    },
    {
      title: t('col_status', 'Status'),
      dataIndex: 'status',
      render: (s: string) => <StatusTag status={STATUS_KIND[s] ?? 'default'} label={s} />,
    },
    { title: t('col_attempts', 'Attempts'), dataIndex: 'attempts', width: 100 },
    {
      title: t('col_ack', 'MoF Ack'),
      dataIndex: 'mof_ack_number',
      render: (v: string | null) => (v ? <Text code>{v}</Text> : '—'),
    },
    {
      title: t('col_error', 'Last error'),
      dataIndex: 'error_message',
      render: (msg: string | null, row: Submission) =>
        msg ? (
          <Text type="danger">
            {row.error_code ? `[${row.error_code}] ` : ''}
            {msg}
          </Text>
        ) : (
          '—'
        ),
    },
    {
      title: t('col_actions', 'Actions'),
      key: 'actions',
      width: 120,
      render: (_: unknown, row: Submission) => (
        <Link to={`/efakhata/submissions/${row.id}`}>
          {t('view', 'View')} →
        </Link>
      ),
    },
  ];

  return (
    <div style={{ padding: 'var(--space-xl, 24px)' }}>
      <PageHeader title={t('title', 'e-Fakhata submissions')} />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t(
          'mof_disclaimer',
          'Iraq Ministry of Finance e-invoicing — wire format pending final MoF spec (R7.X).',
        )}
      />
      <FilterBar
        filters={[
          {
            key: 'status',
            label: t('filter_status', 'Status'),
            options: [
              { value: 'pending', label: 'pending' },
              { value: 'submitting', label: 'submitting' },
              { value: 'submitted', label: 'submitted' },
              { value: 'acknowledged', label: 'acknowledged' },
              { value: 'rejected', label: 'rejected' },
              { value: 'failed', label: 'failed' },
              { value: 'cancelled', label: 'cancelled' },
            ],
          },
        ]}
        values={{ status: statusFilter }}
        onChange={(v) => setStatusFilter((v.status as string) || undefined)}
        onRefresh={() => void fetchSubmissions()}
        extra={
          <DatePicker.RangePicker
            value={dateRange ?? undefined}
            onChange={(v) => setDateRange(v as [Dayjs, Dayjs] | null)}
          />
        }
      />

      <SectionCard padded={false}>
        {Object.keys(counts).length > 0 && (
          <Space wrap style={{ padding: 'var(--space-md, 12px)', borderBottom: '1px solid var(--border)' }}>
            {Object.entries(counts).map(([k, v]) => (
              <StatusTag key={k} status={STATUS_KIND[k] ?? 'default'} label={`${k}: ${v}`} />
            ))}
          </Space>
        )}

        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{ pageSize: 25 }}
        />
      </SectionCard>
    </div>
  );
};

export default EFakhataDashboard;
