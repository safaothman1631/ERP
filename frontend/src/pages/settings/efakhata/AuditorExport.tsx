/**
 * Settings → e-Fakhata → Auditor export (growth-to-100 § R4 / G4a).
 *
 * Lets an admin request a ZIP export for a date range. The endpoint
 * responds 202 with a batch_id; we poll ``GET /api/efakhata/auditor-export/{id}``
 * until ``status === 'ready'`` and then surface the signed URL.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../../api';

const { Title, Paragraph, Text } = Typography;

interface ExportBatch {
  id: string;
  status: 'pending' | 'ready' | 'failed';
  start_date: string;
  end_date: string;
  requested_by: string;
  invoice_count: number;
  gcs_path?: string | null;
  signed_url?: string | null;
  signed_url_expires_at?: string | null;
  created_at?: string;
  completed_at?: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'processing',
  ready: 'green',
  failed: 'red',
};

const AuditorExportPage: React.FC = () => {
  const { t } = useTranslation('efakhata');
  const [form] = Form.useForm();
  const [items, setItems] = useState<ExportBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/efakhata/auditor-export');
      setItems(res.data.items || []);
    } catch {
      // soft fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBatches();
    // Light polling — every 15s — for in-progress batches.
    const id = setInterval(() => {
      if (items.some((b) => b.status === 'pending')) {
        void fetchBatches();
      }
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (values: { range: [Dayjs, Dayjs] }) => {
    if (!values.range || values.range.length !== 2) {
      message.error(t('range_required', 'Choose a date range'));
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/efakhata/auditor-export', {
        start_date: values.range[0].format('YYYY-MM-DD'),
        end_date: values.range[1].format('YYYY-MM-DD'),
      });
      message.success(t('queued_ok', 'Export queued — refresh in a moment'));
      form.resetFields();
      setTimeout(() => void fetchBatches(), 1500);
    } catch {
      message.error(t('queue_failed', 'Could not queue export'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>{t('export_title', 'Tax auditor export')}</Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t(
          'export_help',
          'Generates a ZIP with every signed e-Fakhata XML + PDF + manifest for the chosen range. The download link is valid for 7 days.',
        )}
      />

      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline" form={form} onFinish={handleSubmit}>
          <Form.Item name="range" rules={[{ required: true }]}>
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {t('request_button', 'Request export')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title={t('past_exports', 'Past exports')}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: t('col_range', 'Range'),
              render: (_: unknown, row: ExportBatch) =>
                `${row.start_date} → ${row.end_date}`,
            },
            {
              title: t('col_invoices', 'Invoices'),
              dataIndex: 'invoice_count',
              width: 100,
            },
            {
              title: t('col_status', 'Status'),
              dataIndex: 'status',
              width: 120,
              render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
            },
            {
              title: t('col_requested_by', 'Requested by'),
              dataIndex: 'requested_by',
            },
            {
              title: t('col_created', 'Created'),
              dataIndex: 'created_at',
            },
            {
              title: t('col_download', 'Download'),
              key: 'download',
              render: (_: unknown, row: ExportBatch) =>
                row.status === 'ready' && row.signed_url ? (
                  <a href={row.signed_url} target="_blank" rel="noreferrer">
                    {t('download_zip', 'Download ZIP')}
                  </a>
                ) : row.status === 'failed' ? (
                  <Text type="danger">—</Text>
                ) : (
                  <Text type="secondary">{t('building', 'building…')}</Text>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AuditorExportPage;
