import React, { useEffect, useMemo, useState } from 'react';
import { DatePicker, Button, Select, Radio } from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { message } from '../../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import dayjs from 'dayjs';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { RangePicker } = DatePicker;

const AutomationLogs: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<any>({
    workflow_id: null,
    status: null,
    date_range: null,
  });
  const [tab, setTab] = useState<'all' | 'ok' | 'error'>('all');
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('automation_logs.hiddenCols') || '[]'); } catch { return []; }
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/automation/logs', { params: { limit: 200 } });
      let filtered = res.data.items || [];

      // Client-side filtering (since backend doesn't have complex query)
      if (filters.workflow_id) {
        filtered = filtered.filter((log: any) => log.workflow_id === filters.workflow_id);
      }
      if (filters.status) {
        filtered = filtered.filter((log: any) => log.status === filters.status);
      }
      if (filters.date_range && filters.date_range.length === 2) {
        const [start, end] = filters.date_range;
        filtered = filtered.filter((log: any) => {
          const logDate = dayjs(log.ran_at);
          return logDate.isAfter(start) && logDate.isBefore(end);
        });
      }

      setLogs(filtered);
    } catch {
      // message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const res = await api.get('/api/automation/workflows');
      setWorkflows(res.data.items || []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    void fetchLogs();
    void fetchWorkflows();
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [filters]);

  // Kit list tabs (All / Success / Error) — wired to status filter.
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    { key: 'ok', label: t('automation.status_ok', 'Success') },
    { key: 'error', label: t('automation.status_error', 'Error') },
  ];

  const handleTabChange = (k: string) => {
    setTab(k as typeof tab);
    setFilters({ ...filters, status: k === 'all' ? null : k });
  };

  const openView = (record: any) => {
    message.info(record.result || record.workflow_name || t('automation.workflow', 'Workflow'));
  };

  const allColumns = [
    {
      title: t('automation.workflow'),
      dataIndex: 'workflow_name',
      key: 'workflow_name',
      render: (v: string, record: any) => (
        <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v || record.job_name || 'N/A'}</span>
      ),
    },
    {
      title: t('automation.ran_at'),
      dataIndex: 'ran_at',
      key: 'ran_at',
      render: (v: string) => (
        <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
          {new Date(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: t('automation.trigger'),
      dataIndex: 'trigger',
      key: 'trigger',
      render: (v: string) => (
        <span style={{
          display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
        }}>{v || 'auto'}</span>
      ),
    },
    {
      title: t('automation.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <StatusTag status={v === 'ok' ? 'success' : 'error'} label={v} />,
    },
    {
      title: t('automation.result'),
      dataIndex: 'result',
      key: 'result',
      render: (v: string) => v
        ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: '', key: 'actions', width: 56, align: 'center' as const,
      render: (_: any, record: any) => (
        <KitRowActions
          ariaLabel={t('actions')}
          actions={[
            { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openView(record) },
          ]}
        />
      ),
    },
  ];
  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'workflow_name' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('automation_logs.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  const activeFilterCount = (filters.workflow_id ? 1 : 0) + (filters.date_range ? 1 : 0);

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [logs, search]);

  return (
    <div>
      <PageHeader
        title={t('automation.logs')}
        subtitle={t('automation.logs_subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
            {t('refresh')}
          </Button>
        }
      />

      <SectionCard padded={false}>
        <KitListCard
          tabs={tabs}
          activeTab={tab}
          onTabChange={handleTabChange}
          toolbar={
            <>
              <KitSearchInput
                value={search}
                onChange={(v) => setSearch(v)}
                placeholder={t('search')}
              />
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <KitFiltersButton
                  activeCount={activeFilterCount}
                  onClear={() => setFilters({ ...filters, workflow_id: null, date_range: null })}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBlockEnd: 6 }}>
                        {t('automation.filter_workflow')}
                      </div>
                      <Select
                        style={{ width: '100%' }}
                        allowClear
                        placeholder={t('automation.filter_workflow')}
                        value={filters.workflow_id ?? undefined}
                        onChange={(v) => setFilters({ ...filters, workflow_id: v ?? null })}
                        options={workflows.map((wf) => ({ label: wf.name, value: wf.id }))}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBlockEnd: 6 }}>
                        {t('date', 'Date')}
                      </div>
                      <RangePicker
                        style={{ width: '100%' }}
                        value={filters.date_range}
                        onChange={(dates) => setFilters({ ...filters, date_range: dates })}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBlockEnd: 6 }}>
                        {t('automation.filter_status')}
                      </div>
                      <Radio.Group
                        value={tab}
                        onChange={(e) => handleTabChange(e.target.value)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                      >
                        <Radio value="all">{t('all', 'All')}</Radio>
                        <Radio value="ok">{t('automation.status_ok', 'Success')}</Radio>
                        <Radio value="error">{t('automation.status_error', 'Error')}</Radio>
                      </Radio.Group>
                    </div>
                  </div>
                </KitFiltersButton>
                <KitStatusFilter
                  label={t('automation.status', 'Status')}
                  anyLabel={t('all', 'All')}
                  value={tab === 'all' ? '' : tab}
                  onChange={(v) => handleTabChange(v || 'all')}
                  options={[
                    { value: 'ok', label: t('automation.status_ok', 'Success') },
                    { value: 'error', label: t('automation.status_error', 'Error') },
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
                    downloadCsv('automation_logs', logs, cols);
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
            dataSource={filteredLogs}
            columns={columns}
            loading={loading}
            rowKey={(r) => `${r.id || r.ran_at}`}
          />
        </KitListCard>
      </SectionCard>
    </div>
  );
};

export default AutomationLogs;
