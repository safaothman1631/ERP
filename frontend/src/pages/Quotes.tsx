import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Radio } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, FilePdfOutlined, SendOutlined, CheckOutlined, CloseOutlined, FileTextOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions, { type KitRowEntry } from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { space } from '../theme/tokens';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { useAddGate } from '../components/AddGate/useAddGate';

/** Real status segments for quotes — taken from the page's own filter options. */
const STATUS_VALUES = ['draft', 'sent', 'accepted', 'declined', 'invoiced'] as const;

const Quotes: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('quotes.hiddenCols') || '[]'); } catch { return []; }
  });
  const _isDark = useAuthStore((s) => s.theme === 'dark');

  // AddGate: wire Selective Add for quotes section (R9.1, R9.5)
  const addGate = useAddGate('sales.quotes');

  const quotesQuery = useListQuery<any, { items?: any[]; total?: number }>({
    queryKey: listQueryKeys.quotes({ page, status: statusFilter, page_size: 20 }),
    queryFn: () => api.get('/api/quotes', { params: { page, status: statusFilter, page_size: 20 } }),
  });
  const data = quotesQuery.data?.items ?? [];
  const total = quotesQuery.data?.total ?? 0;
  const loading = quotesQuery.isLoading || quotesQuery.isFetching;

  // Client-side search filter — backend has no search param for quotes.
  const filteredData = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row: any) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }, [data, search]);

  // Sync record count into AddGate store (R9.5, R9.6)
  useEffect(() => { addGate.setRecordCount(total); }, [total, addGate.setRecordCount]);

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post(`/api/quotes/${id}/${action}`);
      message.success(t('success'));
      void quotesQuery.refetch();
    } catch { message.error(t('error')); }
  };

  const handleDownloadPdf = async (id: string) => {
    try {
      const res = await api.get(`/api/quotes/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `quote-${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch { message.error(t('error')); }
  };

  // Kit list tabs (All / Draft / Sent / Accepted / Declined / Invoiced) — wired to
  // the SAME `status` server filter the page already uses.
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    ...STATUS_VALUES.map((s) => ({ key: s, label: t(s) })),
  ];
  const activeTab = statusFilter || 'all';

  // Kit cell renderers — mono ref/number, mono dates, kit money, StatusTag (no antd Tag).
  const allColumns = [
    {
      title: '#', dataIndex: 'quote_number', key: 'quote_number',
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
      title: t('expiry_date'), dataIndex: 'expiry_date', key: 'expiry_date',
      render: (d: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{d?.substring(0, 10)}</span>
      ),
    },
    {
      title: t('total'), dataIndex: 'total', key: 'total',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
          {v?.toLocaleString()} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
        </span>
      ),
    },
    {
      title: t('status'), dataIndex: 'status', key: 'status',
      render: (s: string) => <StatusTag status={s} label={t(s)} />,
    },
    {
      title: '', key: 'actions', width: 56, align: 'center' as const,
      render: (_: any, r: any) => {
        const actions: KitRowEntry[] = [];
        if (r.status === 'draft') {
          actions.push({ key: 'send', icon: <SendOutlined />, label: t('send'), onClick: () => handleAction(r.id, 'send') });
        }
        if (r.status === 'sent') {
          actions.push({ key: 'accept', icon: <CheckOutlined />, label: t('accept'), onClick: () => handleAction(r.id, 'accept') });
          actions.push({ key: 'decline', icon: <CloseOutlined />, label: t('decline'), onClick: () => handleAction(r.id, 'decline') });
        }
        if (['draft', 'sent', 'accepted'].includes(r.status)) {
          actions.push({ key: 'to-invoice', icon: <FileTextOutlined />, label: t('convert_to_invoice'), onClick: () => handleAction(r.id, 'convert-to-invoice') });
          actions.push({ key: 'to-so', icon: <ShoppingOutlined />, label: t('convert_to_sales_order'), onClick: () => handleAction(r.id, 'convert-to-sales-order') });
        }
        if (actions.length > 0) actions.push({ type: 'divider' });
        actions.push({ key: 'pdf', icon: <FilePdfOutlined />, label: t('pdf', 'PDF'), onClick: () => handleDownloadPdf(r.id) });
        return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
      },
    },
  ];
  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'quote_number' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('quotes.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <div data-addgate-section="sales.quotes">
      <PageHeader
        title={t('quotes')}
        subtitle={t('quotes_subtitle', 'Quotes for customers')}
        helpKey="quotes"
        sectionId="sales.quotes"
        extra={
          <Space size={space.sm}>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/quotes/new')} data-add-action="sales.quotes">{t('new_quote')}</Button>
          </Space>
        }
      />
      <KitListCard
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(k) => { setStatusFilter(k === 'all' ? '' : k); setPage(1); }}
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder={t('search')}
            />
            {/* Group Filters + Status in a single flex unit so they ALWAYS wrap
                together to the same line — never one stranded on a row by itself. */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <KitFiltersButton
                activeCount={statusFilter ? 1 : 0}
                onClear={() => { setStatusFilter(''); setPage(1); }}
              >
                <Radio.Group
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <Radio value="">{t('all', 'All')}</Radio>
                  {STATUS_VALUES.map((s) => <Radio key={s} value={s}>{t(s)}</Radio>)}
                </Radio.Group>
              </KitFiltersButton>
              <KitStatusFilter
                label={t('status')}
                anyLabel={t('all', 'All')}
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setPage(1); }}
                options={STATUS_VALUES.map((s) => ({ value: s, label: t(s) }))}
              />
            </div>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta.filter((c) => c.key !== 'actions')}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('quotes', data, cols);
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
        <ResponsiveTableAdapter dataSource={filteredData} columns={columns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </KitListCard>
    </div>
  );
};

export default Quotes;
