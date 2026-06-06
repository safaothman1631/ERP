import React, { useEffect, useMemo, useState } from 'react';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

const Journals: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('journals.hiddenCols') || '[]'); } catch { return []; }
  });
  const _isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/journals', { params: { page, page_size: 20 } });
      setData(res.data.items); setTotal(res.data.total);
    } catch { message.error(t('error')); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page]);

  // Kit cell renderers — mono ref/number, mono date, mono money + IQD suffix,
  // StatusTag for status, muted chip for the (non-manual) source type.
  const columns = [
    {
      title: '#', dataIndex: 'entry_number', key: 'entry_number',
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
      ),
    },
    {
      title: t('date'), dataIndex: 'date', key: 'date',
      render: (d: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{d?.substring(0, 10)}</span>
      ),
    },
    {
      title: t('description'), dataIndex: 'description', key: 'description',
      render: (v: string) => <span style={{ color: 'var(--ink-900)' }}>{v || '—'}</span>,
    },
    {
      title: t('debit'), dataIndex: 'total_debit', key: 'total_debit',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
          {v?.toLocaleString()} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
        </span>
      ),
    },
    {
      title: t('credit'), dataIndex: 'total_credit', key: 'total_credit',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
          {v?.toLocaleString()} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
        </span>
      ),
    },
    { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={s} label={t(s)} /> },
    {
      title: t('source', 'Source'), dataIndex: 'source_type', key: 'source_type',
      render: (s: string) => s && s !== 'manual'
        ? (
          <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
          }}>{t(s, s)}</span>
        )
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'entry_number',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('journals.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  // Client-side search across all row values — backend has no search param.
  const filteredData = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [data, search]);

  return (
    <div>
      <PageHeader title={t('journals')} subtitle={t('journals_subtitle', 'Accounting journals')} sectionId="accounting.journals" />
      <KitListCard
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder={t('search')}
            />
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('journals', filteredData, cols);
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
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
        />
      </KitListCard>
    </div>
  );
};

export default Journals;
