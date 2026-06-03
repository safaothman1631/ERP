import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, message, Radio } from 'antd';
import {
  PlusOutlined, ReloadOutlined, SwapOutlined,
  EyeOutlined, CopyOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import ExportButton from '../components/ExportButton';
import ChatterWidget from '../components/chatter/ChatterWidget';
import { PageHeader, DataTable, StatusTag, type ColumnVisibilityItem } from '../design-system';
import type { ColumnDef } from '../design-system/DataTable';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { FormDialog } from '../components/responsive/FormDialog';

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  stage_id?: string;
  expected_revenue?: number;
  probability?: number;
  status?: string;
}

interface Stage { id: string; name: string; color?: string; }

const SOURCES = ['website', 'referral', 'event', 'cold_call', 'import', 'whatsapp', 'other'];

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function CRMLeads() {
  const { t } = useTranslation();
  const [stages, setStages] = useState<Stage[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState<Lead | null>(null);
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [createForm] = Form.useForm();
  const [convertForm] = Form.useForm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('crmLeads.hiddenCols') || '[]'); } catch { return []; }
  });

  const leadsQuery = useListQuery<Lead, { items?: Lead[]; total?: number }>({
    queryKey: listQueryKeys.crmLeads({ page_size: 200 }),
    queryFn: () => api.get('/api/crm/leads', { params: { page_size: 200 } }),
  });
  const leads = leadsQuery.data?.items ?? [];
  const loading = leadsQuery.isLoading || leadsQuery.isFetching;

  const loadStages = async () => {
    try {
      const s = await api.get('/api/crm/stages');
      setStages(s.data.items || []);
    } catch {
      message.error(t('error'));
    }
  };

  const load = async () => {
    await Promise.all([leadsQuery.refetch(), loadStages()]);
  };

  useEffect(() => { void loadStages(); }, []);

  const onCreate = async () => {
    const v = await createForm.validateFields();
    try {
      await api.post('/api/crm/leads', v);
      message.success(t('saved'));
      setCreateOpen(false);
      createForm.resetFields();
      await leadsQuery.refetch();
    } catch { message.error(t('error')); }
  };

  const onConvert = async () => {
    if (!convertOpen) return;
    const v = await convertForm.validateFields();
    try {
      await api.post(`/api/crm/leads/${convertOpen.id}/convert`, v);
      message.success(t('converted'));
      setConvertOpen(null);
      convertForm.resetFields();
      await leadsQuery.refetch();
    } catch { message.error(t('error')); }
  };

  const onArchive = async (id: string) => {
    try {
      await api.delete(`/api/crm/leads/${id}`);
      await leadsQuery.refetch();
    } catch { message.error(t('error')); }
  };

  // Convert: opens the convert dialog prefilled (existing logic preserved).
  const openConvert = (r: Lead) => {
    setConvertOpen(r);
    convertForm.setFieldsValue({ amount: r.expected_revenue || 0, probability: r.probability || 50 });
  };

  // Duplicate: open the create form pre-filled with this lead's values (no id/status).
  const openDuplicate = (r: Lead) => {
    const { id: _id, status: _status, ...rest } = r;
    createForm.setFieldsValue({ ...rest, name: `${r.name ?? ''} (${t('copy', 'copy')})` });
    setCreateOpen(true);
  };

  const stageName = (id?: string) => stages.find((s) => s.id === id)?.name || '—';

  // Presentation-only client-side narrowing of the already-loaded list (the
  // query still fetches the full page_size:200 set — no endpoint/param change).
  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter && (l.status || 'open') !== statusFilter) return false;
      if (sourceFilter && (l.source || '') !== sourceFilter) return false;
      if (q) {
        const hay = `${l.name || ''} ${l.company || ''} ${l.email || ''} ${l.phone || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, statusFilter, sourceFilter]);

  // Kit list tabs (All / Open / Converted) — the leads' real status values.
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    { key: 'open', label: t('open', 'Open') },
    { key: 'converted', label: t('converted', 'Converted') },
  ];

  const columns: ColumnDef<Lead>[] = [
    {
      title: t('name'), dataIndex: 'name', key: 'name',
      render: (v: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-soft)', color: 'var(--accent-500)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>{initialsOf(v)}</span>
          <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
        </div>
      ),
    },
    {
      title: t('company'), dataIndex: 'company', key: 'company',
      render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
    },
    {
      title: t('email'), dataIndex: 'email', key: 'email',
      render: (v: string) => v
        ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('phone'), dataIndex: 'phone', key: 'phone',
      render: (v: string) => v
        ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('source'), dataIndex: 'source', key: 'source',
      render: (v: string) => v
        ? (
          <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
          }}>{t(v, v)}</span>
        )
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('stage'), key: 'stage_id',
      render: (_: unknown, r: Lead) => <span style={{ color: 'var(--ink-700)' }}>{stageName(r.stage_id)}</span>,
    },
    {
      title: t('expected_revenue'), dataIndex: 'expected_revenue', key: 'expected_revenue', align: 'right' as const,
      render: (v?: number) => (v ?? null) !== null
        ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
            {Number(v).toLocaleString()} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
          </span>
        )
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (s?: string) => <StatusTag status={s || 'open'} label={t(s || 'open')} />,
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'center' as const,
      render: (_: unknown, r: Lead) => (
        <KitRowActions
          ariaLabel={t('actions')}
          actions={[
            { key: 'view', icon: <EyeOutlined />, label: t('view'), onClick: () => setViewLead(r) },
            { key: 'convert', icon: <SwapOutlined />, label: t('convert'), disabled: r.status === 'converted', onClick: () => openConvert(r) },
            { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => openDuplicate(r) },
            { type: 'divider' },
            { key: 'archive', icon: <InboxOutlined />, label: t('archive'), danger: true, onClick: () => onArchive(r.id) },
          ]}
        />
      ),
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'name' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('crmLeads.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  const activeFilterCount = (sourceFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  return (
    <div>
      <PageHeader
        title={t('leads')}
        subtitle={t('leads_subtitle', 'Sales pipeline leads')}
        sectionId="crm.leads"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
            <ExportButton endpoint="/api/export/customers" filename="leads" />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('new_lead')}
            </Button>
          </Space>
        }
      />

      <KitListCard
        tabs={tabs}
        activeTab={statusFilter || 'all'}
        onTabChange={(k) => { setStatusFilter(k === 'all' ? '' : k); setPage(1); }}
        toolbar={
          <>
            <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('search')} />
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <KitFiltersButton
                activeCount={activeFilterCount}
                onClear={() => { setSourceFilter(''); setStatusFilter(''); setPage(1); }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>{t('source')}</span>
                  <Radio.Group
                    value={sourceFilter}
                    onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <Radio value="">{t('all', 'All')}</Radio>
                    {SOURCES.map((s) => <Radio key={s} value={s}>{t(s, s)}</Radio>)}
                  </Radio.Group>
                </div>
              </KitFiltersButton>
              <KitStatusFilter
                label={t('status', 'Status')}
                anyLabel={t('all', 'All')}
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setPage(1); }}
                options={[
                  { value: 'open', label: t('open', 'Open') },
                  { value: 'converted', label: t('converted', 'Converted') },
                ]}
              />
            </div>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta.filter((c) => c.key !== 'actions')}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('crm-leads', filteredLeads, cols);
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
        <DataTable
          rowKey="id"
          loading={loading}
          dataSource={filteredLeads}
          columns={visibleColumns}
          pagination={{ current: page, pageSize: 20, onChange: setPage }}
        />
      </KitListCard>

      <FormDialog
        title={viewLead?.name || t('lead')}
        open={!!viewLead}
        onClose={() => setViewLead(null)}
        hideFooter
      >
        {viewLead?.id && <ChatterWidget entityType="lead" entityId={viewLead.id} />}
      </FormDialog>

      <FormDialog
        title={t('new_lead')}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onOk={onCreate}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label={t('name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="company" label={t('company')}><Input /></Form.Item>
          <Form.Item name="email" label={t('email')}><Input /></Form.Item>
          <Form.Item name="phone" label={t('phone')}><Input /></Form.Item>
          <Form.Item name="source" label={t('source')}>
            <Select options={SOURCES.map((s) => ({ value: s, label: s }))} allowClear />
          </Form.Item>
          <Form.Item name="stage_id" label={t('stage')}>
            <Select options={stages.map((s) => ({ value: s.id, label: s.name }))} allowClear />
          </Form.Item>
          <Form.Item name="expected_revenue" label={t('expected_revenue')}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="probability" label={t('probability')}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
        </Form>
      </FormDialog>

      <FormDialog
        title={t('convert_to_opportunity')}
        open={!!convertOpen}
        onClose={() => setConvertOpen(null)}
        onOk={onConvert}
      >
        <Form form={convertForm} layout="vertical" initialValues={{ amount: 0, probability: 50 }}>
          <Form.Item name="amount" label={t('amount')}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="probability" label={t('probability')}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="close_date" label={t('close_date')}>
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="stage_id" label={t('stage')}>
            <Select options={stages.map((s) => ({ value: s.id, label: s.name }))} allowClear />
          </Form.Item>
        </Form>
      </FormDialog>
    </div>
  );
}
