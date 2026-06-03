import React, { useEffect, useMemo, useState } from 'react';
import { Button, message } from 'antd';
import type { TableProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import type { StatusKind } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { ListWithEmptyState } from '../../design-system/empty/ListWithEmptyState';
import { downloadCsv } from '../../utils/exportCsv';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface Anomaly {
  id: string;
  entity_type: string;
  entity_id: string;
  score: number;
  reason?: string;
  detected_at?: string;
  status?: string;
  created_at?: string;
}

const AnomaliesList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterEntityType, setFilterEntityType] = useState<string | undefined>();
  const [tab, setTab] = useState<'all' | 'new' | 'reviewed' | 'dismissed'>('all');
  const [searchText, setSearchText] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('anomalies.hiddenCols') || '[]'); } catch { return []; }
  });

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/ai/anomalies', { params: { limit: 500 } });
      setData(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnomalies();
  }, []);

  const acknowledge = async (id: string) => {
    try {
      await api.patch(`/api/ai/anomalies/${id}`, { status: 'reviewed' });
      message.success(t('ai.anomaly_acknowledged'));
      await fetchAnomalies();
    } catch {
      message.error(t('error'));
    }
  };

  const dismiss = async (id: string) => {
    try {
      await api.patch(`/api/ai/anomalies/${id}`, { status: 'dismissed' });
      message.success(t('ai.anomaly_dismissed'));
      await fetchAnomalies();
    } catch {
      message.error(t('error'));
    }
  };

  const handleEntityLink = (entityType: string, _entityId: string) => {
    const routes: Record<string, string> = {
      invoice: '/invoices',
      bill: '/bills',
      payment: '/banking',
      expense: '/expenses',
    };
    const base = routes[entityType];
    if (base) navigate(base);
  };

  // Kit list tabs (All / New / Reviewed / Dismissed) — client-side filtered against status field.
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    { key: 'new', label: t('ai.status_new', 'New') },
    { key: 'reviewed', label: t('ai.status_reviewed', 'Reviewed') },
    { key: 'dismissed', label: t('ai.status_dismissed', 'Dismissed') },
  ];

  const filteredData = data.filter((item) => {
    if (tab !== 'all' && (item.status || 'new') !== tab) return false;
    if (filterEntityType && item.entity_type !== filterEntityType) return false;
    if (searchText) {
      const text = searchText.toLowerCase();
      return (
        item.entity_id?.toLowerCase().includes(text) ||
        item.reason?.toLowerCase().includes(text) ||
        item.entity_type?.toLowerCase().includes(text)
      );
    }
    return true;
  });

  // Kit cell renderers — muted chip for type, mono for id, kit-style status via StatusTag.
  const allColumns = [
    {
      title: t('ai.entity_type'),
      dataIndex: 'entity_type',
      key: 'entity_type',
      render: (val: string) => (
        <span style={{
          display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
        }}>{val}</span>
      ),
    },
    {
      title: t('ai.entity_id'),
      dataIndex: 'entity_id',
      key: 'entity_id',
      render: (val: string) => (
        <span style={{
          color: 'var(--ink-900)', fontWeight: 500,
          fontFamily: 'var(--font-mono)', fontSize: 12.5,
        }}>{val}</span>
      ),
    },
    {
      title: t('ai.anomaly_score'),
      dataIndex: 'score',
      key: 'score',
      render: (val: number) => (
        <StatusTag
          status={val > 0.8 ? 'error' : val > 0.5 ? 'warning' : 'default'}
          label={`${(val * 100).toFixed(0)}%`}
        />
      ),
      sorter: (a: Anomaly, b: Anomaly) => (a.score || 0) - (b.score || 0),
    },
    {
      title: t('ai.reason'),
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (val?: string) => val
        ? <span style={{ color: 'var(--ink-700)' }}>{val}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('ai.detected_at'),
      dataIndex: 'detected_at',
      key: 'detected_at',
      render: (val?: string) => val
        ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
            {val.substring(0, 16).replace('T', ' ')}
          </span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
      sorter: (a: Anomaly, b: Anomaly) => (a.detected_at || '').localeCompare(b.detected_at || ''),
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (val?: string) => {
        const statusKinds: Record<string, StatusKind> = {
          new: 'error',
          reviewed: 'success',
          dismissed: 'default',
        };
        const s = val || 'new';
        return <StatusTag status={statusKinds[s] ?? 'default'} label={t(`ai.status_${s}`, s)} />;
      },
    },
    {
      title: '', key: 'actions', width: 56, align: 'center' as const,
      render: (_: unknown, record: Anomaly) => {
        const actions: Array<
          | { key: string; icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }
          | { type: 'divider' }
        > = [
          {
            key: 'view',
            icon: <EyeOutlined />,
            label: t('view', 'View'),
            onClick: () => handleEntityLink(record.entity_type, record.entity_id),
          },
        ];
        if (record.status !== 'reviewed') {
          actions.push({
            key: 'acknowledge',
            icon: <CheckOutlined />,
            label: t('ai.acknowledge'),
            onClick: () => acknowledge(record.id),
          });
        }
        if (record.status !== 'dismissed') {
          actions.push({ type: 'divider' });
          actions.push({
            key: 'dismiss',
            icon: <CloseOutlined />,
            label: t('ai.dismiss'),
            danger: true,
            onClick: () => dismiss(record.id),
          });
        }
        return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
      },
    },
  ];

  const columns: TableProps<Anomaly>['columns'] = useMemo(
    () => allColumns.filter((c) => !hiddenCols.includes(c.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenCols, t],
  );
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'entity_type' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('anomalies.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  const activeFilterCount = (filterEntityType ? 1 : 0);

  return (
    <div>
      <PageHeader
        title={t('ai.anomalies_title')}
        subtitle={t('ai.anomalies_subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchAnomalies}>
            {t('refresh')}
          </Button>
        }
      />

      <KitListCard
        tabs={tabs}
        activeTab={tab}
        onTabChange={(k) => { setTab(k as typeof tab); }}
        toolbar={
          <>
            <KitSearchInput value={searchText} onChange={(v) => { setSearchText(v); }} placeholder={t('search')} />
            <KitFiltersButton
              activeCount={activeFilterCount}
              onClear={() => { setFilterEntityType(undefined); }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <KitStatusFilter
                  label={t('ai.entity_type')}
                  anyLabel={t('all', 'All')}
                  value={filterEntityType ?? ''}
                  onChange={(v) => setFilterEntityType(v || undefined)}
                  options={[
                    { value: 'invoice', label: 'Invoice' },
                    { value: 'bill', label: 'Bill' },
                    { value: 'payment', label: 'Payment' },
                    { value: 'expense', label: 'Expense' },
                  ]}
                />
              </div>
            </KitFiltersButton>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta.filter((c) => c.key !== 'actions')}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('anomalies', filteredData, cols);
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
        <ListWithEmptyState
          entity="anomaly"
          data={filteredData}
          loading={loading}
          searchQuery={searchText}
          onClearSearch={() => setSearchText('')}
          onRetry={() => void fetchAnomalies()}
          render={(rows) => (
            <ResponsiveTableAdapter
              columns={columns}
              dataSource={rows}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 50, showSizeChanger: true }}
            />
          )}
        />
      </KitListCard>
    </div>
  );
};

export default AnomaliesList;
