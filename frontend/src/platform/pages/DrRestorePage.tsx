/**
 * DrRestorePage — Super-admin disaster-recovery restore console (SF3 / T-SF.3.9).
 *
 * Drives the four-eyes per-tenant restore workflow exposed by
 * `backend/app/api/admin/dr_restore.py`:
 *
 *   1. An admin CREATES a restore request (org_id + backup archive path + mode),
 *      which auto-computes a diff preview (added / changed / unchanged).
 *   2. A DIFFERENT super-admin reviews the diff and APPROVES (the API forbids
 *      self-approval — four-eyes).
 *   3. The approver EXECUTES, which returns the exact `restore-tenant.sh`
 *      command to run on the incident bridge (the web app never runs gcloud).
 *
 * Lives under /platform (PlatformRoute guard => super_admin / platform admin
 * only). Mirrors the look of the other platform pages (PlatformPageHeader +
 * GlassCard + react-query + Antd).
 */
import { useState } from 'react';
import {
  Alert, Button, Drawer, Form, Input, Modal, Select, Space, Statistic, Table, Tag,
  Tooltip, Typography, message,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import GlassCard from '../components/GlassCard';
import PlatformPageHeader from '../components/PlatformPageHeader';

const { Text, Paragraph } = Typography;

type RestoreStatus =
  | 'requested' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed' | 'cancelled';

interface DiffCollection {
  added: number;
  changed: number;
  unchanged: number;
  archive_count: number;
  live_count: number;
  sample_changed_ids: string[];
}
interface DiffPreview {
  org_id: string;
  source_path: string;
  generated_at: string;
  totals: { added: number; changed: number; unchanged: number };
  collections: Record<string, DiffCollection>;
  error?: string;
}
interface RestoreRequestDoc {
  id: string;
  org_id: string;
  source_path: string;
  status: RestoreStatus;
  mode: 'upsert' | 'replace';
  reason: string;
  requested_by: string;
  requested_by_email?: string | null;
  requested_at: string;
  approved_by?: string | null;
  approved_by_email?: string | null;
  approved_at?: string | null;
  executed_at?: string | null;
  result?: Record<string, unknown> | null;
  diff_preview?: DiffPreview | null;
  error_message?: string | null;
}

const STATUS_COLOR: Record<RestoreStatus, string> = {
  requested: 'gold',
  approved: 'blue',
  rejected: 'red',
  executing: 'purple',
  completed: 'green',
  failed: 'red',
  cancelled: 'default',
};

const BASE = '/api/admin/dr/restore';

export default function DrRestorePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [orgFilter, setOrgFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [commandModal, setCommandModal] = useState<{ command: string; note: string } | null>(null);
  const [form] = Form.useForm();

  const listKey = ['platform', 'dr-restore', orgFilter];
  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: async () =>
      (await api.get<{ items: RestoreRequestDoc[]; total: number }>(BASE, {
        params: { org_id: orgFilter || undefined },
      })).data,
  });

  const detail = useQuery({
    queryKey: ['platform', 'dr-restore', 'detail', detailId],
    enabled: !!detailId,
    queryFn: async () => (await api.get<RestoreRequestDoc>(`${BASE}/${detailId}`)).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['platform', 'dr-restore'] });
  };

  const createMut = useMutation({
    mutationFn: async (values: { org_id: string; source_path: string; mode: string; reason: string }) =>
      (await api.post<RestoreRequestDoc>(BASE, { ...values, compute_preview: true })).data,
    onSuccess: (doc) => {
      message.success(t('dr.created', 'Restore request created — pending second-admin approval'));
      setCreateOpen(false);
      form.resetFields();
      invalidate();
      setDetailId(doc.id);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      message.error(err?.response?.data?.detail || t('dr.create_err', 'Could not create request')),
  });

  const actionMut = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' | 'cancel' | 'preview' }) =>
      (await api.post(`${BASE}/${id}/${action}`)).data,
    onSuccess: (_d, vars) => {
      message.success(t('dr.action_ok', 'Done: {{a}}', { a: vars.action }));
      invalidate();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      message.error(err?.response?.data?.detail || t('dr.action_err', 'Action failed')),
  });

  const executeMut = useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ command: string; note: string }>(`${BASE}/${id}/execute`)).data,
    onSuccess: (resp) => {
      setCommandModal({ command: resp.command, note: resp.note });
      invalidate();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      message.error(err?.response?.data?.detail || t('dr.execute_err', 'Execute failed')),
  });

  const renderDiff = (preview?: DiffPreview | null) => {
    if (!preview) return <Text type="secondary">{t('dr.no_preview', 'No diff preview computed.')}</Text>;
    if (preview.error) return <Alert type="warning" showIcon message={preview.error} />;
    const rows = Object.entries(preview.collections)
      .filter(([, c]) => c.added + c.changed + c.unchanged > 0)
      .map(([name, c]) => ({ key: name, name, ...c }));
    return (
      <>
        <Space size="large" style={{ marginBottom: 12 }}>
          <Statistic title={t('dr.added', 'Added')} value={preview.totals.added} valueStyle={{ color: '#3f8600' }} />
          <Statistic title={t('dr.changed', 'Changed')} value={preview.totals.changed} valueStyle={{ color: '#cf9700' }} />
          <Statistic title={t('dr.unchanged', 'Unchanged')} value={preview.totals.unchanged} />
        </Space>
        <Table
          size="small"
          rowKey="key"
          dataSource={rows}
          pagination={false}
          columns={[
            { title: t('dr.collection', 'Collection'), dataIndex: 'name' },
            { title: t('dr.added', 'Added'), dataIndex: 'added' },
            { title: t('dr.changed', 'Changed'), dataIndex: 'changed' },
            { title: t('dr.unchanged', 'Unchanged'), dataIndex: 'unchanged' },
            { title: t('dr.archive', 'In backup'), dataIndex: 'archive_count' },
            { title: t('dr.live', 'In live'), dataIndex: 'live_count' },
          ]}
        />
      </>
    );
  };

  const columns = [
    { title: t('dr.org', 'Organization'), dataIndex: 'org_id', width: 200 },
    {
      title: t('dr.status', 'Status'),
      dataIndex: 'status',
      render: (s: RestoreStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    { title: t('dr.mode', 'Mode'), dataIndex: 'mode', render: (m: string) => <Tag>{m}</Tag> },
    { title: t('dr.requested_by', 'Requested by'), dataIndex: 'requested_by_email' },
    { title: t('dr.approved_by', 'Approved by'), dataIndex: 'approved_by_email' },
    { title: t('created', 'Created'), dataIndex: 'requested_at', render: (v: string) => v?.slice(0, 19) },
    {
      title: t('actions', 'Actions'),
      key: 'actions',
      render: (_: unknown, r: RestoreRequestDoc) => (
        <Space size="small">
          <Button size="small" onClick={() => setDetailId(r.id)}>
            {t('dr.review', 'Review')}
          </Button>
          {r.status === 'requested' && (
            <Tooltip title={t('dr.four_eyes_hint', 'Must be approved by a DIFFERENT super-admin')}>
              <Button size="small" type="primary" onClick={() => actionMut.mutate({ id: r.id, action: 'approve' })}>
                {t('dr.approve', 'Approve')}
              </Button>
            </Tooltip>
          )}
          {r.status === 'approved' && (
            <Button size="small" danger type="primary" onClick={() => executeMut.mutate(r.id)}>
              {t('dr.execute', 'Execute')}
            </Button>
          )}
          {(r.status === 'requested' || r.status === 'approved') && (
            <Button size="small" danger onClick={() => actionMut.mutate({ id: r.id, action: 'reject' })}>
              {t('dr.reject', 'Reject')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const d = detail.data;

  return (
    <>
      <PlatformPageHeader
        title={t('dr.title', 'Disaster recovery — tenant restore')}
        subtitle={t('dr.subtitle', 'Four-eyes per-tenant restore from a backup archive. Diff preview before approval.')}
        actions={
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            {t('dr.new', 'New restore request')}
          </Button>
        }
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('dr.warn_title', 'Destructive privileged operation')}
        description={t(
          'dr.warn_body',
          'A tenant restore overwrites that customer\'s live production data. It requires approval by a second super-admin (four-eyes) and only then can be executed. Execution returns a command to run on the incident bridge.',
        )}
      />

      <GlassCard>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder={t('dr.org', 'Organization ID')}
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
        </Space>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items || []}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </GlassCard>

      {/* Create request */}
      <Modal
        open={createOpen}
        title={t('dr.new', 'New restore request')}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        okText={t('dr.create_btn', 'Create & preview diff')}
        width={620}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)}>
          <Form.Item
            name="org_id"
            label={t('dr.org', 'Organization ID')}
            rules={[{ required: true, message: t('dr.org_req', 'Organization ID is required') }]}
          >
            <Input placeholder="064a4a1a-487b-4835-a42a-4806ba8add72" />
          </Form.Item>
          <Form.Item
            name="source_path"
            label={t('dr.source', 'Backup archive path (GCS)')}
            rules={[{ required: true, message: t('dr.source_req', 'Backup path is required') }]}
            extra={t('dr.source_hint', 'e.g. backups/<org>/2026-05-26/backup_20260526_020000.json.gz')}
          >
            <Input placeholder="backups/<org>/<date>/backup_*.json.gz" />
          </Form.Item>
          <Form.Item name="mode" label={t('dr.mode', 'Mode')} initialValue="upsert">
            <Select
              options={[
                { value: 'upsert', label: t('dr.mode_upsert', 'Upsert (additive merge — safe)') },
                { value: 'replace', label: t('dr.mode_replace', 'Replace (also delete docs absent from backup)') },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label={t('dr.reason', 'Reason')}
            rules={[{ required: true, min: 5, message: t('dr.reason_req', 'A reason (>=5 chars) is required') }]}
          >
            <Input.TextArea rows={3} placeholder={t('dr.reason_ph', 'Why is this restore needed?')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Review drawer */}
      <Drawer
        open={!!detailId}
        onClose={() => setDetailId(null)}
        width={720}
        title={d ? `${t('dr.review', 'Review')} — ${d.org_id}` : t('dr.review', 'Review')}
        loading={detail.isLoading}
        extra={
          d && (
            <Space>
              <Button size="small" onClick={() => actionMut.mutate({ id: d.id, action: 'preview' })}>
                {t('dr.recompute', 'Recompute diff')}
              </Button>
              {d.status === 'requested' && (
                <Button size="small" type="primary" onClick={() => actionMut.mutate({ id: d.id, action: 'approve' })}>
                  {t('dr.approve', 'Approve')}
                </Button>
              )}
              {d.status === 'approved' && (
                <Button size="small" danger type="primary" onClick={() => executeMut.mutate(d.id)}>
                  {t('dr.execute', 'Execute')}
                </Button>
              )}
            </Space>
          )
        }
      >
        {d && (
          <>
            <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
              <Text>
                <Text strong>{t('dr.status', 'Status')}:</Text> <Tag color={STATUS_COLOR[d.status]}>{d.status}</Tag>
                <Tag>{d.mode}</Tag>
              </Text>
              <Text type="secondary">{t('dr.source', 'Backup archive path')}: {d.source_path}</Text>
              <Text type="secondary">{t('dr.reason', 'Reason')}: {d.reason}</Text>
              <Text type="secondary">
                {t('dr.requested_by', 'Requested by')}: {d.requested_by_email || d.requested_by} · {d.requested_at?.slice(0, 19)}
              </Text>
              {d.approved_by && (
                <Text type="secondary">
                  {t('dr.approved_by', 'Approved by')}: {d.approved_by_email || d.approved_by} · {d.approved_at?.slice(0, 19)}
                </Text>
              )}
              {d.error_message && <Alert type="error" showIcon message={d.error_message} />}
            </Space>

            {d.requested_by && d.status === 'requested' && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={t(
                  'dr.four_eyes_hint',
                  'Four-eyes: approval must come from a different super-admin than the requester.',
                )}
              />
            )}

            <Typography.Title level={5}>{t('dr.diff_preview', 'Diff preview')}</Typography.Title>
            {renderDiff(d.diff_preview)}

            {d.result && (
              <>
                <Typography.Title level={5} style={{ marginTop: 16 }}>
                  {t('dr.result', 'Execution result')}
                </Typography.Title>
                <pre style={{ maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(d.result, null, 2)}</pre>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Execute -> command modal */}
      <Modal
        open={!!commandModal}
        title={t('dr.run_command', 'Run on the incident bridge')}
        onCancel={() => setCommandModal(null)}
        onOk={() => {
          if (commandModal) navigator.clipboard?.writeText(commandModal.command);
          message.success(t('dr.copied', 'Command copied'));
        }}
        okText={t('dr.copy', 'Copy command')}
        width={680}
      >
        {commandModal && (
          <>
            <Paragraph type="secondary">{commandModal.note}</Paragraph>
            <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 6, overflowX: 'auto' }}>
              {commandModal.command}
            </pre>
          </>
        )}
      </Modal>
    </>
  );
}
