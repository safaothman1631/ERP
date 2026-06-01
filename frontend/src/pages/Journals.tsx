import React, { useEffect, useMemo, useState } from 'react';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, StatusTag, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat, FilterBar } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

const Journals: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('journals.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/journals', { params: { page, page_size: 20 } });
      setData(res.data.items); setTotal(res.data.total);
    } catch { message.error(t('error')); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page]);

  const columns = [
    { title: '#', dataIndex: 'entry_number', key: 'entry_number' },
    { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
    { title: t('description'), dataIndex: 'description', key: 'description' },
    { title: t('debit'), dataIndex: 'total_debit', key: 'total_debit', render: (v: number) => v?.toLocaleString() },
    { title: t('credit'), dataIndex: 'total_credit', key: 'total_credit', render: (v: number) => v?.toLocaleString() },
    { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={s} label={t(s)} /> },
    {
      title: '', dataIndex: 'source_type', key: 'source_type',
      render: (s: string) => s !== 'manual' ? <StatusTag status="default" label={t(s, s)} /> : null,
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

  return (
    <div>
      <PageHeader title={t('journals')} subtitle={t('journals_subtitle', 'Accounting journals')} sectionId="accounting.journals" />
      <FilterBar
        extra={
          <>
            <ExportMenu
              formats={['csv']}
              onExport={(f: ExportFormat) => {
                if (f === 'csv') {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('journals', data, cols);
                }
              }}
            />
            <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
          </>
        }
      />
      <ResponsiveTableAdapter
        dataSource={data}
        columns={visibleColumns}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
    </div>
  );
};

export default Journals;
