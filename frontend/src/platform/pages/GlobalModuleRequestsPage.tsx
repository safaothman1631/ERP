import { useState } from 'react';
import {
  Button, Checkbox, Input, Modal, Space, Table, Tag, Typography, message, Alert,
} from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import GlassCard from '../components/GlassCard';
import PlatformPageHeader from '../components/PlatformPageHeader';
import { MODULES, type ModuleKey } from '../../onboarding/industries';

interface RequestRow {
  id: string;
  org_id: string;
  org_name?: string;
  user_name?: string;
  user_email?: string;
  status: string;
  requested_modules?: ModuleKey[];
  note?: string;
  created_at?: string;
}

export default function GlobalModuleRequestsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editRow, setEditRow] = useState<RequestRow | null>(null);
  const [selectedMods, setSelectedMods] = useState<ModuleKey[]>([]);
  const [licensePool, setLicensePool] = useState<ModuleKey[]>([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'module-requests'],
    queryFn: async () => (await api.get<{ items: RequestRow[] }>('/api/platform/module-requests')).data.items,
  });

  const modLabel = (k: ModuleKey) => {
    const m = MODULES.find(x => x.key === k);
    return m ? t(m.labelKey, m.title) : k;
  };

  const inLicensePool = (k: ModuleKey) =>
    licensePool.length === 0 || licensePool.includes(k);

  const openEdit = async (row: RequestRow) => {
    setEditRow(row);
    setSelectedMods([...(row.requested_modules || [])]);
    try {
      const res = await api.get<{ license?: { allowed_modules?: ModuleKey[] } }>(
        `/api/platform/orgs/${row.org_id}/license`,
      );
      setLicensePool(res.data.license?.allowed_modules || []);
    } catch {
      setLicensePool([]);
    }
  };

  const closeEdit = () => {
    setEditRow(null);
    setSelectedMods([]);
    setLicensePool([]);
  };

  const approve = useMutation({
    mutationFn: ({ id, modules }: { id: string; modules: ModuleKey[] }) =>
      api.post(`/api/platform/module-requests/${id}/approve`, { approved_modules: modules }),
    onSuccess: () => {
      message.success(t('platform.request_approved', 'Approved'));
      closeEdit();
      void qc.invalidateQueries({ queryKey: ['platform', 'module-requests'] });
      void qc.invalidateQueries({ queryKey: ['platform', 'stats'] });
    },
    onError: () => {
      message.error(t('modreq_approve_error', 'Approve failed'));
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, reason: r }: { id: string; reason?: string }) =>
      api.post(`/api/platform/module-requests/${id}/reject`, { reason: r }),
    onSuccess: () => {
      message.success(t('platform.request_rejected', 'Rejected'));
      setRejectId(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['platform', 'module-requests'] });
    },
  });

  const doApprove = () => {
    if (!editRow) return;
    const valid = selectedMods.filter(inLicensePool);
    if (!valid.length) {
      message.warning(t('platform.modreq_none_valid', 'Select at least one module allowed by the org license'));
      return;
    }
    approve.mutate({ id: editRow.id, modules: valid });
  };

  const requestedModules = editRow?.requested_modules || [];

  return (
    <>
      <PlatformPageHeader
        title={t('platform.requests.title', 'Module requests')}
        subtitle={t('platform.requests.subtitle', 'Global approval queue')}
      />
      <GlassCard>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data || []}
          columns={[
            { title: t('platform.org', 'Organization'), render: (_, r) => r.org_name || r.org_id },
            {
              title: t('modreq_user', 'User'),
              render: (_, r) => (
                <div>
                  <Typography.Text strong>{r.user_name || r.user_email || '—'}</Typography.Text>
                  {r.user_email && (
                    <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.user_email}</Typography.Text></div>
                  )}
                </div>
              ),
            },
            {
              title: t('modreq_requested', 'Requested modules'),
              render: (_, r) => (
                <Space wrap size={[4, 4]}>
                  {(r.requested_modules || []).map(k => <Tag key={k}>{modLabel(k)}</Tag>)}
                </Space>
              ),
            },
            { title: t('modreq_note', 'Note'), dataIndex: 'note', render: v => v || '—' },
            { title: t('status', 'Status'), dataIndex: 'status', render: s => <Tag>{s}</Tag> },
            { title: t('created', 'Created'), dataIndex: 'created_at' },
            {
              title: t('actions', 'Actions'),
              render: (_, row) => row.status === 'pending' ? (
                <Space wrap>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => void openEdit(row)}
                  >
                    {t('edit', 'Edit')}
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => void openEdit(row)}
                  >
                    {t('approve', 'Approve')}
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => setRejectId(row.id)}
                  >
                    {t('reject', 'Reject')}
                  </Button>
                </Space>
              ) : null,
            },
          ]}
        />
      </GlassCard>

      <Modal
        open={!!editRow}
        title={t('platform.modreq_edit_title', 'Customize approved modules')}
        onOk={doApprove}
        onCancel={closeEdit}
        okText={t('approve', 'Approve')}
        confirmLoading={approve.isPending}
        width={520}
      >
        {editRow && (
          <>
            <Typography.Paragraph type="secondary">
              {t('platform.modreq_edit_hint', 'Choose which requested modules to enable for this organization. Uncheck any you do not want to grant.')}
            </Typography.Paragraph>
            {editRow.note && (
              <Alert type="info" showIcon style={{ marginBottom: 12 }} message={editRow.note} />
            )}
            <Checkbox.Group
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              value={selectedMods}
              onChange={v => setSelectedMods(v as ModuleKey[])}
            >
              {requestedModules.map(k => {
                const allowed = inLicensePool(k);
                return (
                  <Checkbox key={k} value={k} disabled={!allowed}>
                    {modLabel(k)}
                    {!allowed && (
                      <Typography.Text type="danger" style={{ marginInlineStart: 8, fontSize: 12 }}>
                        ({t('platform.modreq_not_in_license', 'not in license pool')})
                      </Typography.Text>
                    )}
                  </Checkbox>
                );
              })}
            </Checkbox.Group>
            <Space style={{ marginTop: 12 }}>
              <Button size="small" onClick={() => setSelectedMods(requestedModules.filter(inLicensePool))}>
                {t('select_all', 'Select all')}
              </Button>
              <Button size="small" onClick={() => setSelectedMods([])}>
                {t('clear', 'Clear')}
              </Button>
            </Space>
          </>
        )}
      </Modal>

      <Modal
        open={!!rejectId}
        title={t('platform.reject_request', 'Reject request')}
        onCancel={() => { setRejectId(null); setReason(''); }}
        onOk={() => rejectId && reject.mutate({ id: rejectId, reason })}
        okButtonProps={{ danger: true }}
        okText={t('reject', 'Reject')}
      >
        <Typography.Paragraph>{t('modreq_reject_confirm', 'Optionally provide a reason:')}</Typography.Paragraph>
        <Input.TextArea value={reason} onChange={e => setReason(e.target.value)} rows={3} />
      </Modal>
    </>
  );
}
