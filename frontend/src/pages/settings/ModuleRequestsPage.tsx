import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Checkbox, Input, Modal, Typography, message, Alert,
} from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, type ColumnVisibilityItem } from '../../design-system';
import KitListCard from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { MODULES, type ModuleKey } from '../../onboarding/industries';
import { useOnboardingStore } from '../../onboarding/store';
import { usePermission } from '../../hooks/usePermission';

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
  const [search, setSearch] = useState('');
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [selectedMods, setSelectedMods] = useState<ModuleKey[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('modreq.hiddenCols') || '[]'); } catch { return []; }
  });

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [items, search]);

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

  const modLabel = useCallback((k: ModuleKey) => {
    const m = MODULES.find(x => x.key === k);
    return m ? t(m.labelKey, m.title) : k;
  }, [t]);

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

  const allColumns = [
    {
      title: t('modreq_user', 'User'),
      dataIndex: 'user_name',
      key: 'user_name',
      render: (_: unknown, row: RequestRow) => {
        const primary = row.user_name || row.user_email || '—';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'var(--accent-soft)', color: 'var(--accent-500)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>{initialsOf(primary)}</span>
            <div>
              <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{primary}</span>
              {row.user_email && (
                <div style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                  {row.user_email}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: t('modreq_requested', 'Requested modules'),
      dataIndex: 'requested_modules',
      key: 'requested_modules',
      render: (mods: ModuleKey[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(mods || []).map(k => (
            <span key={k} style={{
              display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
            }}>{modLabel(k)}</span>
          ))}
        </div>
      ),
    },
    {
      title: t('modreq_note', 'Note'),
      dataIndex: 'note',
      key: 'note',
      render: (v: string) => v
        ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: '', key: 'actions', width: 56, align: 'center' as const,
      render: (_: unknown, row: RequestRow) => (
        <KitRowActions
          ariaLabel={t('actions', 'Actions')}
          actions={[
            { key: 'approve', icon: <CheckOutlined />, label: t('approve', 'Approve'), onClick: () => openApprove(row) },
            { type: 'divider' },
            { key: 'reject', icon: <CloseOutlined />, label: t('reject', 'Reject'), danger: true, onClick: () => setRejectId(row.id) },
          ]}
        />
      ),
    },
  ];

  const columns = allColumns.filter((c) => !hiddenCols.includes(c.key));
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'user_name' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('modreq.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <div>
      <PageHeader
        title={t('modreq_page_title', 'Module requests')}
        subtitle={t('modreq_page_sub', 'Review and approve module access requests from your team.')}
      />
      <KitListCard
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => { setSearch(v); }}
              placeholder={t('search')}
            />
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta.filter((c) => c.key !== 'actions')}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('module-requests', items, cols);
                }}
                onPrint={() => window.print()}
                onImport={() => message.info(t('coming_soon', 'Coming soon'))}
                onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
                onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
              />
            </div>
          </>
        }
      >
        <ResponsiveTableAdapter
          rowKey="id"
          loading={loading}
          dataSource={filteredItems}
          columns={columns}
          pagination={false}
        />
      </KitListCard>

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
