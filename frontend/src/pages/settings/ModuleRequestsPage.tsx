import { useCallback, useEffect, useState } from 'react';
import {
  Button, Checkbox, Input, Modal, Space, Typography, message, Alert,
} from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { MODULES, type ModuleKey } from '../../onboarding/industries';
import { useOnboardingStore } from '../../onboarding/store';
import { usePermission } from '../../hooks/usePermission';

const { Text } = Typography;

interface RequestRow {
  id: string;
  user_name?: string;
  user_email?: string;
  requested_modules: ModuleKey[];
  status: string;
  note?: string;
  created_at?: string;
}

export default function ModuleRequestsPage() {
  const { t } = useTranslation();
  const { isAdmin, isOwner } = usePermission();
  const loadForOrg = useOnboardingStore(s => s.loadForOrg);
  const orgId = useOnboardingStore(s => s.orgId);

  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [selectedMods, setSelectedMods] = useState<ModuleKey[]>([]);
  const [rejectReason, setRejectReason] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: RequestRow[] }>('/api/onboarding/module-requests', {
        params: { status: 'pending' },
      });
      setItems(res.data.items || []);
    } catch {
      message.error(t('modreq_load_error', 'Could not load requests'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  if (!isAdmin && !isOwner) {
    return (
      <Alert type="error" showIcon message={t('access_denied', 'Access denied')} />
    );
  }

  const openApprove = (row: RequestRow) => {
    setApproveId(row.id);
    setSelectedMods([...(row.requested_modules || [])]);
  };

  const doApprove = async () => {
    if (!approveId) return;
    try {
      await api.post(`/api/onboarding/module-requests/${approveId}/approve`, {
        approved_modules: selectedMods,
      });
      message.success(t('modreq_approved_toast', 'Request approved'));
      setApproveId(null);
      await fetchItems();
      if (orgId) await loadForOrg(orgId, { canManageSettings: true });
    } catch {
      message.error(t('modreq_approve_error', 'Approve failed'));
    }
  };

  const doReject = async () => {
    if (!rejectId) return;
    try {
      await api.post(`/api/onboarding/module-requests/${rejectId}/reject`, { reason: rejectReason });
      message.success(t('modreq_rejected_toast', 'Request rejected'));
      setRejectId(null);
      setRejectReason('');
      await fetchItems();
    } catch {
      message.error(t('modreq_reject_error', 'Reject failed'));
    }
  };

  const modLabel = (k: ModuleKey) => {
    const m = MODULES.find(x => x.key === k);
    return m ? t(m.labelKey, m.title) : k;
  };

  const columns = [
    {
      title: t('modreq_user', 'User'),
      dataIndex: 'user_name',
      render: (_: unknown, row: RequestRow) => (
        <div>
          <Text strong>{row.user_name || row.user_email || '—'}</Text>
          {row.user_email && <div><Text type="secondary" style={{ fontSize: 12 }}>{row.user_email}</Text></div>}
        </div>
      ),
    },
    {
      title: t('modreq_requested', 'Requested modules'),
      dataIndex: 'requested_modules',
      render: (mods: ModuleKey[]) => (
        <Space wrap size={[4, 4]}>
          {(mods || []).map(k => <StatusTag key={k} status="default" label={modLabel(k)} />)}
        </Space>
      ),
    },
    {
      title: t('modreq_note', 'Note'),
      dataIndex: 'note',
      render: (v: string) => v || '—',
    },
    {
      title: t('actions', 'Actions'),
      key: 'actions',
      render: (_: unknown, row: RequestRow) => (
        <Space>
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openApprove(row)}>
            {t('approve', 'Approve')}
          </Button>
          <Button size="small" danger icon={<CloseOutlined />} onClick={() => setRejectId(row.id)}>
            {t('reject', 'Reject')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('modreq_page_title', 'Module requests')}
        subtitle={t('modreq_page_sub', 'Review and approve module access requests from your team.')}
      />
      <SectionCard title={t('modreq_pending_queue', 'Pending queue')} padded={false}>
        <ResponsiveTableAdapter
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={false}
        />
      </SectionCard>

      <Modal
        open={!!approveId}
        title={t('modreq_approve_modal', 'Approve modules')}
        onOk={doApprove}
        onCancel={() => setApproveId(null)}
        okText={t('approve', 'Approve')}
      >
        <Checkbox.Group
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          value={selectedMods}
          onChange={v => setSelectedMods(v as ModuleKey[])}
        >
          {selectedMods.map(k => (
            <Checkbox key={k} value={k}>{modLabel(k)}</Checkbox>
          ))}
        </Checkbox.Group>
      </Modal>

      <Modal
        open={!!rejectId}
        title={t('modreq_reject_modal', 'Reject request')}
        onOk={doReject}
        onCancel={() => { setRejectId(null); setRejectReason(''); }}
        okButtonProps={{ danger: true }}
        okText={t('reject', 'Reject')}
      >
        <Typography.Paragraph>{t('modreq_reject_confirm', 'Optionally provide a reason:')}</Typography.Paragraph>
        <Input.TextArea
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          rows={3}
          placeholder={t('modreq_reason_ph', 'Reason…')}
        />
      </Modal>
    </div>
  );
}
