/**
 * e-Fakhata submission detail (growth-to-100 § R4 / G4a).
 *
 * Renders the full timeline of a single submission: every state transition
 * the queue went through, plus the raw MoF acknowledgement when present.
 * Admins can cancel the submission while it is still pending.
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Popconfirm,
  Spin,
  Steps,
  Typography,
  message,
} from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, DetailLayout, SectionCard, KeyValueGrid, StatusTag } from '../../design-system';
import type { StatusKind } from '../../design-system';

const { Text, Paragraph } = Typography;

interface HistoryEntry {
  at: string;
  status: string;
  actor?: string;
}

interface SubmissionDetail {
  id: string;
  invoice_id: string;
  status: string;
  attempts: number;
  mof_ack_number?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at?: string;
  next_attempt_at?: string;
  history: HistoryEntry[];
}

const STATUS_ORDER = [
  'pending',
  'submitting',
  'submitted',
  'acknowledged',
];

const STATUS_KIND: Record<string, StatusKind> = {
  pending: 'default',
  submitting: 'info',
  submitted: 'info',
  acknowledged: 'success',
  rejected: 'error',
  failed: 'warning',
  cancelled: 'default',
};

const SubmissionDetailPage: React.FC = () => {
  const { t } = useTranslation('efakhata');
  const { sid } = useParams<{ sid: string }>();
  const [record, setRecord] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!sid) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/efakhata/submissions/${sid}`);
      setRecord(res.data);
    } catch (_e) {
      message.error(t('not_found', 'Submission not found'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  const handleCancel = async () => {
    if (!sid) return;
    try {
      await api.post(`/api/efakhata/submissions/${sid}/cancel`);
      message.success(t('cancelled_ok', 'Submission cancelled'));
      void load();
    } catch (_e) {
      message.error(t('cancel_failed', 'Cancel failed'));
    }
  };

  if (loading || !record) return <Spin style={{ margin: 64 }} />;

  const currentStep = STATUS_ORDER.indexOf(record.status);
  const errored = ['rejected', 'failed', 'cancelled'].includes(record.status);

  const canCancel = !['acknowledged', 'cancelled', 'rejected'].includes(record.status);

  return (
    <DetailLayout
      header={
        <PageHeader
          title={`${t('detail_title', 'Submission')} ${record.id.slice(0, 8)}`}
          subtitle={<Link to="/efakhata">← {t('back', 'Back to dashboard')}</Link>}
          tag={<StatusTag status={STATUS_KIND[record.status] ?? 'default'} label={record.status} />}
        />
      }
      toolbar={
        canCancel ? (
          <Popconfirm
            title={t(
              'cancel_confirm',
              'Cancel this submission? This stops retries permanently.',
            )}
            onConfirm={handleCancel}
          >
            <Button danger>{t('cancel_button', 'Cancel submission (admin only)')}</Button>
          </Popconfirm>
        ) : undefined
      }
    >
      <SectionCard>
        <KeyValueGrid
          columns={2}
          items={[
            { label: t('invoice', 'Invoice'), value: <Link to={`/invoices/${record.invoice_id}`}>{record.invoice_id}</Link> },
            { label: t('status', 'Status'), value: <StatusTag status={STATUS_KIND[record.status] ?? 'default'} label={record.status} /> },
            { label: t('attempts', 'Attempts'), value: record.attempts },
            { label: t('mof_ack', 'MoF Ack number'), value: record.mof_ack_number ? <Text code>{record.mof_ack_number}</Text> : '—' },
            { label: t('created_at', 'Created'), value: record.created_at ?? '—' },
            { label: t('next_attempt', 'Next retry'), value: record.next_attempt_at ?? '—' },
          ]}
        />
      </SectionCard>

      {!errored && (
        <SectionCard>
          <Steps
            current={currentStep >= 0 ? currentStep : 0}
            items={STATUS_ORDER.map((s) => ({ title: s }))}
          />
        </SectionCard>
      )}

      {record.error_message && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <>
              {record.error_code ? <strong>[{record.error_code}] </strong> : null}
              {record.error_message}
            </>
          }
        />
      )}

      <SectionCard title={t('timeline', 'Timeline')}>
        {record.history.length === 0 ? (
          <Paragraph type="secondary">{t('no_history', 'No history yet')}</Paragraph>
        ) : (
          <ul style={{ paddingInlineStart: 16 }}>
            {record.history.map((h, i) => (
              <li key={i}>
                <Text type="secondary">{h.at}</Text>{' — '}
                <StatusTag status={STATUS_KIND[h.status] ?? 'default'} label={h.status} />
                {h.actor ? <Text type="secondary"> ({h.actor})</Text> : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </DetailLayout>
  );
};

export default SubmissionDetailPage;
