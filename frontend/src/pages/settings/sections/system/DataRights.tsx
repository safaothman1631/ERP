/**
 * Data Rights settings section — GDPR/PDPL self-service (T-SF.2.22).
 *
 * Tenant-admin facing. Lets an org admin:
 *   - Request a full-tenant data export (GDPR Art. 15/20, Iraq PDPL access +
 *     portability) and see the resulting download link / status.
 *   - Request tenant data erasure (GDPR Art. 17, PDPL right to be forgotten)
 *     behind a typed-confirmation modal. Erasure is a two-phase flow: this
 *     opens an `awaiting_confirmation` request that schedules a hard delete
 *     after a grace window; nothing is deleted immediately.
 *
 * Backs the `system.gdpr` registry entry. Conventions (R8.1/R8.2):
 *   - default-exported `React.memo` component, no props.
 *   - `useClassedQuery` (class C — slow-changing) for status reads.
 *   - stable memoized handlers, full i18n (`settings` + `common`).
 *   - strict types: the API response shapes are modelled explicitly.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Input,
  Modal,
  Result,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  CloudDownloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import api from '../../../../api';
import { useClassedQuery } from '../../../../data/useClassedQuery';
import { usePermission } from '../../../../hooks/usePermission';
import { SectionCard, StatusTag, type StatusKind } from '../../../../design-system';
import { message } from '../../../../utils/message';

const { Paragraph, Text } = Typography;

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirror backend `app.api.data_rights` response models
// ─────────────────────────────────────────────────────────────────────────────

type ExportStatus = 'pending' | 'ready' | 'failed';
type ErasureStatus =
  | 'awaiting_confirmation'
  | 'scheduled'
  | 'completed'
  | 'cancelled';

interface ExportRequest {
  id: string;
  kind: 'export';
  status: ExportStatus;
  requested_by?: string | null;
  requested_by_email?: string | null;
  requested_at?: string | null;
  completed_at?: string | null;
  signed_url?: string | null;
  bytes?: number | null;
  document_count?: number | null;
  collections?: Record<string, number> | null;
  error?: string | null;
}

interface ErasureRequest {
  id: string;
  kind: 'erasure';
  status: ErasureStatus;
  requested_by?: string | null;
  requested_by_email?: string | null;
  reason?: string | null;
  requested_at?: string | null;
  confirm_token?: string | null;
  grace_days?: number | null;
  confirmed_at?: string | null;
  scheduled_purge_at?: string | null;
  purged_at?: string | null;
  documents_purged?: number | null;
  cancelled_at?: string | null;
}

const EXPORT_LAST_KEY = ['settings', 'system', 'data-rights', 'last-export'] as const;
const ERASURE_LAST_KEY = ['settings', 'system', 'data-rights', 'last-erasure'] as const;

// The phrase the admin must type to arm the erasure request. Localized label,
// but the typed token itself is fixed/ASCII so it is unambiguous to type.
const ERASE_CONFIRM_TOKEN = 'ERASE';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function errorDetail(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

function fmtBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function exportStatusTag(status: ExportStatus, t: (k: string, o?: object) => string): React.ReactNode {
  const map: Record<ExportStatus, { kind: StatusKind; label: string }> = {
    ready: { kind: 'success', label: t('settings:data_rights.status.ready', { defaultValue: 'Ready' }) },
    pending: { kind: 'warning', label: t('settings:data_rights.status.pending', { defaultValue: 'Pending' }) },
    failed: { kind: 'error', label: t('settings:data_rights.status.failed', { defaultValue: 'Failed' }) },
  };
  const cfg = map[status];
  return <StatusTag status={cfg.kind} label={cfg.label} />;
}

function erasureStatusTag(status: ErasureStatus, t: (k: string, o?: object) => string): React.ReactNode {
  const map: Record<ErasureStatus, { kind: StatusKind; label: string }> = {
    awaiting_confirmation: {
      kind: 'warning',
      label: t('settings:data_rights.erasure_status.awaiting', { defaultValue: 'Awaiting confirmation' }),
    },
    scheduled: {
      kind: 'error',
      label: t('settings:data_rights.erasure_status.scheduled', { defaultValue: 'Scheduled' }),
    },
    completed: {
      kind: 'default',
      label: t('settings:data_rights.erasure_status.completed', { defaultValue: 'Completed' }),
    },
    cancelled: {
      kind: 'default',
      label: t('settings:data_rights.erasure_status.cancelled', { defaultValue: 'Cancelled' }),
    },
  };
  const cfg = map[status];
  return <StatusTag status={cfg.kind} label={cfg.label} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const DataRights: React.FC = React.memo(() => {
  const { t } = useTranslation(['settings', 'common']);
  const qc = useQueryClient();
  const { hasPerm } = usePermission();

  const canExport = hasPerm('privacy.export');
  const canErase = hasPerm('privacy.erasure');

  const [exporting, setExporting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [reason, setReason] = useState('');

  // Last requests are held in the query cache so re-renders / tab switches keep
  // the most recent result visible without re-firing the (expensive) export.
  const { data: lastExport } = useClassedQuery<ExportRequest | null>(
    EXPORT_LAST_KEY,
    () => Promise.resolve(null),
    'C',
    { enabled: false },
  );
  const { data: lastErasure } = useClassedQuery<ErasureRequest | null>(
    ERASURE_LAST_KEY,
    () => Promise.resolve(null),
    'C',
    { enabled: false },
  );

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await api.post<ExportRequest>('/api/data-rights/export');
      qc.setQueryData<ExportRequest | null>(EXPORT_LAST_KEY, res.data);
      if (res.data.status === 'ready') {
        message.success(
          t('settings:data_rights.export_ready', { defaultValue: 'Export ready to download' }),
        );
      } else if (res.data.status === 'pending') {
        message.warning(
          t('settings:data_rights.export_pending', {
            defaultValue: 'Export prepared, but no storage bucket is configured to host the download.',
          }),
        );
      } else {
        message.error(t('settings:data_rights.export_failed', { defaultValue: 'Export failed' }));
      }
    } catch (err) {
      message.error(
        errorDetail(err, t('settings:data_rights.export_failed', { defaultValue: 'Export failed' })),
      );
    } finally {
      setExporting(false);
    }
  }, [qc, t]);

  const refreshExport = useCallback(async () => {
    if (!lastExport?.id) return;
    try {
      const res = await api.get<ExportRequest>(`/api/data-rights/export/${lastExport.id}`);
      qc.setQueryData<ExportRequest | null>(EXPORT_LAST_KEY, res.data);
    } catch (err) {
      message.error(
        errorDetail(err, t('common:load_failed', { defaultValue: 'Failed to load' })),
      );
    }
  }, [lastExport?.id, qc, t]);

  // ── Erasure ────────────────────────────────────────────────────────────────

  const openConfirm = useCallback(() => {
    setConfirmInput('');
    setConfirmOpen(true);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
    setConfirmInput('');
  }, []);

  const confirmArmed = confirmInput.trim().toUpperCase() === ERASE_CONFIRM_TOKEN;

  const handleErasure = useCallback(async () => {
    if (!confirmArmed) return;
    setErasing(true);
    try {
      const trimmedReason = reason.trim();
      const res = await api.post<ErasureRequest>('/api/data-rights/erasure', {
        reason: trimmedReason ? trimmedReason : null,
      });
      qc.setQueryData<ErasureRequest | null>(ERASURE_LAST_KEY, res.data);
      setConfirmOpen(false);
      setConfirmInput('');
      setReason('');
      message.success(
        t('settings:data_rights.erasure_requested', {
          defaultValue: 'Erasure request opened. Save the confirmation token to proceed.',
        }),
      );
    } catch (err) {
      message.error(
        errorDetail(err, t('settings:data_rights.erasure_failed', { defaultValue: 'Erasure request failed' })),
      );
    } finally {
      setErasing(false);
    }
  }, [confirmArmed, reason, qc, t]);

  // ── Derived view bits ──────────────────────────────────────────────────────

  const exportCollections = useMemo(() => {
    const c = lastExport?.collections;
    if (!c) return [];
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [lastExport?.collections]);

  if (!canExport && !canErase) {
    return (
      <Result
        status="403"
        title={t('common:access_denied', { defaultValue: 'Access denied' })}
        subTitle={t('settings:data_rights.no_permission', {
          defaultValue: 'You do not have permission to manage data rights for this organization.',
        })}
      />
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message={t('settings:data_rights.intro_title', { defaultValue: 'GDPR / PDPL data rights' })}
        description={t('settings:data_rights.intro_body', {
          defaultValue:
            'Export or erase this organization’s data to satisfy data-subject requests. These actions affect only your own organization.',
        })}
      />

      {/* ── Export ───────────────────────────────────────────────────────── */}
      <SectionCard
        style={{ marginBottom: 0 }}
        title={
          <Space>
            <CloudDownloadOutlined />
            {t('settings:data_rights.export_title', { defaultValue: 'Export organization data' })}
          </Space>
        }
      >
        <Paragraph type="secondary">
          {t('settings:data_rights.export_desc', {
            defaultValue:
              'Assemble a downloadable archive containing one JSON document per data collection (contacts, invoices, items, and more).',
          })}
        </Paragraph>

        <Space wrap>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={exporting}
            disabled={!canExport}
            onClick={handleExport}
          >
            {t('settings:data_rights.request_export', { defaultValue: 'Request export' })}
          </Button>
          {lastExport?.id && (
            <Button icon={<ReloadOutlined />} onClick={refreshExport}>
              {t('settings:data_rights.refresh_status', { defaultValue: 'Refresh status' })}
            </Button>
          )}
        </Space>

        {lastExport && (
          <Descriptions
            column={1}
            size="small"
            bordered
            style={{ marginBlockStart: 16 }}
            title={t('settings:data_rights.latest_export', { defaultValue: 'Latest export' })}
          >
            <Descriptions.Item label={t('settings:data_rights.col_status', { defaultValue: 'Status' })}>
              {exportStatusTag(lastExport.status, t)}
            </Descriptions.Item>
            {typeof lastExport.document_count === 'number' && (
              <Descriptions.Item label={t('settings:data_rights.col_documents', { defaultValue: 'Documents' })}>
                {lastExport.document_count}
              </Descriptions.Item>
            )}
            {typeof lastExport.bytes === 'number' && lastExport.bytes > 0 && (
              <Descriptions.Item label={t('settings:data_rights.col_size', { defaultValue: 'Archive size' })}>
                {fmtBytes(lastExport.bytes)}
              </Descriptions.Item>
            )}
            {lastExport.requested_at && (
              <Descriptions.Item label={t('settings:data_rights.col_requested_at', { defaultValue: 'Requested at' })}>
                {new Date(lastExport.requested_at).toLocaleString()}
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('settings:data_rights.col_download', { defaultValue: 'Download' })}>
              {lastExport.signed_url ? (
                <Button
                  type="link"
                  icon={<LinkOutlined />}
                  href={lastExport.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ paddingInline: 0 }}
                >
                  {t('settings:data_rights.download_archive', { defaultValue: 'Download archive' })}
                </Button>
              ) : (
                <Text type="secondary">
                  {lastExport.error ||
                    t('settings:data_rights.no_download', { defaultValue: 'No download link available' })}
                </Text>
              )}
            </Descriptions.Item>
            {exportCollections.length > 0 && (
              <Descriptions.Item label={t('settings:data_rights.col_collections', { defaultValue: 'Collections' })}>
                <Space size={[4, 4]} wrap>
                  {exportCollections.map(([name, count]) => (
                    <Tag key={name}>{`${name}: ${count}`}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </SectionCard>

      {/* ── Erasure ──────────────────────────────────────────────────────── */}
      <SectionCard
        style={{ marginBottom: 0 }}
        title={
          <Space>
            <DeleteOutlined />
            {t('settings:data_rights.erasure_title', { defaultValue: 'Erase organization data' })}
          </Space>
        }
      >
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={t('settings:data_rights.erasure_warn_title', { defaultValue: 'This permanently deletes data' })}
          description={t('settings:data_rights.erasure_warn_body', {
            defaultValue:
              'Requesting erasure schedules a permanent, irreversible deletion of this organization’s records after a grace period. Export your data first if you need a copy.',
          })}
          style={{ marginBlockEnd: 16 }}
        />

        <Button
          danger
          type="primary"
          icon={<DeleteOutlined />}
          disabled={!canErase}
          onClick={openConfirm}
        >
          {t('settings:data_rights.request_erasure', { defaultValue: 'Request erasure' })}
        </Button>

        {lastErasure && (
          <Descriptions
            column={1}
            size="small"
            bordered
            style={{ marginBlockStart: 16 }}
            title={t('settings:data_rights.latest_erasure', { defaultValue: 'Latest erasure request' })}
          >
            <Descriptions.Item label={t('settings:data_rights.col_status', { defaultValue: 'Status' })}>
              {erasureStatusTag(lastErasure.status, t)}
            </Descriptions.Item>
            {typeof lastErasure.grace_days === 'number' && (
              <Descriptions.Item label={t('settings:data_rights.col_grace', { defaultValue: 'Grace period' })}>
                {t('settings:data_rights.grace_days', {
                  defaultValue: '{{count}} days',
                  count: lastErasure.grace_days,
                })}
              </Descriptions.Item>
            )}
            {lastErasure.scheduled_purge_at && (
              <Descriptions.Item label={t('settings:data_rights.col_purge_at', { defaultValue: 'Scheduled deletion' })}>
                {new Date(lastErasure.scheduled_purge_at).toLocaleString()}
              </Descriptions.Item>
            )}
            {lastErasure.confirm_token && (
              <Descriptions.Item label={t('settings:data_rights.col_confirm_token', { defaultValue: 'Confirmation token' })}>
                <Text code copyable>
                  {lastErasure.confirm_token}
                </Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </SectionCard>

      {/* ── Erasure confirm modal ────────────────────────────────────────── */}
      <Modal
        open={confirmOpen}
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: 'var(--danger-500)' }} />
            {t('settings:data_rights.confirm_title', { defaultValue: 'Confirm data erasure' })}
          </Space>
        }
        okText={t('settings:data_rights.confirm_ok', { defaultValue: 'Request erasure' })}
        cancelText={t('common:cancel', { defaultValue: 'Cancel' })}
        okButtonProps={{ danger: true, disabled: !confirmArmed, loading: erasing }}
        onOk={handleErasure}
        onCancel={closeConfirm}
        destroyOnClose
      >
        <Paragraph>
          {t('settings:data_rights.confirm_body', {
            defaultValue:
              'You are about to request permanent erasure of this organization’s data. This cannot be undone once the grace period elapses.',
          })}
        </Paragraph>
        <Paragraph>
          <Text strong>
            {t('settings:data_rights.confirm_prompt', {
              defaultValue: 'Type {{token}} to confirm.',
              token: ERASE_CONFIRM_TOKEN,
            })}
          </Text>
        </Paragraph>
        <Input
          autoFocus
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
          placeholder={ERASE_CONFIRM_TOKEN}
          aria-label={t('settings:data_rights.confirm_prompt', {
            defaultValue: 'Type {{token}} to confirm.',
            token: ERASE_CONFIRM_TOKEN,
          })}
        />
        <Input.TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('settings:data_rights.reason_placeholder', {
            defaultValue: 'Reason (optional)',
          })}
          maxLength={2000}
          rows={3}
          style={{ marginBlockStart: 12 }}
        />
      </Modal>
    </Space>
  );
});

DataRights.displayName = 'DataRights';

export default DataRights;
