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
  Button,
  Card,
  DatePicker,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../api';

const { Title, Text } = Typography;

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

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  submitting: 'processing',
  submitted: 'blue',
  acknowledged: 'green',
  rejected: 'red',
  failed: 'orange',
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
      render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
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
    <div style={{ padding: 24 }}>
      <Title level={3}>{t('title', 'e-Fakhata submissions')}</Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t(
          'mof_disclaimer',
          'Iraq Ministry of Finance e-invoicing — wire format pending final MoF spec (R7.X).',
        )}
      />
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            placeholder={t('filter_status', 'Status')}
            style={{ width: 180 }}
            allowClear
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            options={[
              { value: 'pending', label: 'pending' },
              { value: 'submitting', label: 'submitting' },
              { value: 'submitted', label: 'submitted' },
              { value: 'acknowledged', label: 'acknowledged' },
              { value: 'rejected', label: 'rejected' },
              { value: 'failed', label: 'failed' },
              { value: 'cancelled', label: 'cancelled' },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange ?? undefined}
            onChange={(v) => setDateRange(v as [Dayjs, Dayjs] | null)}
          />
          <Button onClick={() => void fetchSubmissions()} loading={loading}>
            {t('refresh', 'Refresh')}
          </Button>
        </Space>

        <Space wrap style={{ marginBottom: 16 }}>
          {Object.entries(counts).map(([k, v]) => (
            <Tag key={k} color={STATUS_COLOR[k] ?? 'default'}>
              {k}: {v}
            </Tag>
          ))}
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{ pageSize: 25 }}
        />
      </Card>
    </div>
  );
};

export default EFakhataDashboard;
