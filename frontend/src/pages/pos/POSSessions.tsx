import React, { useEffect, useMemo, useState } from 'react';
import { Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import type { StatusKind } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

// Map POS session states → StatusTag semantic kinds (auto-flip tokens, light + dark).
const SESSION_STATUS: Record<string, StatusKind> = {
  opening: 'info',
  opened: 'active',
  closing: 'warning',
  closed: 'closed',
};

const POSSessions: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stateFilter, setStateFilter] = useState('');
  const [configFilter, setConfigFilter] = useState('');
  const [search, setSearch] = useState('');
  const [configs, setConfigs] = useState<any[]>([]);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('posSessions.hiddenCols') || '[]'); } catch { return []; }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 25 };
      if (stateFilter) params.state = stateFilter;
      if (configFilter) params.config_id = configFilter;

      const res = await api.get('/api/pos/sessions', { params });
      setData(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/api/pos/configs', { params: { page_size: 100 } });
      setConfigs(res.data.items || []);
    } catch { /* noop */ }
  };

  useEffect(() => {
    fetchData();
  }, [page, stateFilter, configFilter]);

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Kit list tabs (All / Open / Closed) — wired to the same server `state` param.
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    { key: 'opened', label: t('pos.state_opened') },
    { key: 'closed', label: t('pos.state_closed') },
  ];

  const columns = [
    {
      title: t('pos.config'),
      dataIndex: 'config_name',
      key: 'config_name',
    },
    {
      title: t('pos.cashier'),
      dataIndex: 'cashier_name',
      key: 'cashier_name',
    },
    {
      title: t('pos.opened_at'),
      dataIndex: 'opened_at',
      key: 'opened_at',
      render: (date: string) => formatDate(date),
    },
    {
      title: t('pos.closed_at'),
      dataIndex: 'closed_at',
      key: 'closed_at',
      render: (date: string) => date ? formatDate(date) : '-',
    },
    {
      title: t('pos.total_sales'),
      dataIndex: 'total_sales',
      key: 'total_sales',
      render: (val: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
          {formatCurrency(val || 0)}
        </span>
      ),
    },
    {
      title: t('pos.orders'),
      dataIndex: 'total_orders',
      key: 'total_orders',
    },
    {
      title: t('status'),
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => (
        <StatusTag status={SESSION_STATUS[state] ?? 'default'} label={t(`pos.state_${state}`)} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <KitRowActions
          ariaLabel={t('actions')}
          actions={[
            { key: 'view', icon: <EyeOutlined />, label: t('view'), onClick: () => navigate(`/pos/sessions/${record.id}`) },
            ...(record.state === 'opened'
              ? [{ key: 'resume', icon: <PlayCircleOutlined />, label: t('pos.resume'), onClick: () => navigate(`/pos/terminal/${record.id}`) }]
              : []),
          ]}
        />
      ),
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'config_name' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('posSessions.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  const activeFilterCount = (stateFilter ? 1 : 0) + (configFilter ? 1 : 0);

  const filteredData = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [data, search]);

  return (
    <div>
      <PageHeader title={t('pos.sessions')} />

      <KitListCard
        tabs={tabs}
        activeTab={stateFilter || 'all'}
        onTabChange={(k) => { setStateFilter(k === 'all' ? '' : k); setPage(1); }}
        toolbar={
          <>
            <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('search')} />
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <KitFiltersButton
              activeCount={activeFilterCount}
              onClear={() => { setConfigFilter(''); setStateFilter(''); setPage(1); }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ marginBlockEnd: 6, color: 'var(--ink-600)', fontSize: 12.5, fontWeight: 600 }}>
                    {t('pos.config')}
                  </div>
                  <Radio.Group
                    value={configFilter}
                    onChange={(e) => { setConfigFilter(e.target.value); setPage(1); }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <Radio value="">{t('all', 'All')}</Radio>
                    {configs.map((cfg) => (
                      <Radio key={cfg.id} value={cfg.id}>{cfg.name_ku || cfg.name}</Radio>
                    ))}
                  </Radio.Group>
                </div>
                <div>
                  <div style={{ marginBlockEnd: 6, color: 'var(--ink-600)', fontSize: 12.5, fontWeight: 600 }}>
                    {t('status')}
                  </div>
                  <Radio.Group
                    value={stateFilter}
                    onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <Radio value="">{t('all', 'All')}</Radio>
                    <Radio value="opened">{t('pos.state_opened')}</Radio>
                    <Radio value="closed">{t('pos.state_closed')}</Radio>
                  </Radio.Group>
                </div>
              </div>
            </KitFiltersButton>
            <KitStatusFilter
              label={t('status')}
              anyLabel={t('all', 'All')}
              value={stateFilter}
              onChange={(v) => { setStateFilter(v || ''); setPage(1); }}
              options={[
                { value: 'opened', label: t('pos.state_opened') },
                { value: 'closed', label: t('pos.state_closed') },
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
                  downloadCsv('pos-sessions', data, cols);
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
          dataSource={filteredData}
          columns={visibleColumns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total: search ? filteredData.length : total,
            pageSize: 25,
            onChange: setPage,
          }}
        />
      </KitListCard>
    </div>
  );
};

export default POSSessions;
