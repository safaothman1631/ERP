import React, { useEffect, useMemo, useState } from 'react';
import { Button, Radio } from 'antd';
import { LeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const PortalInvoices: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('portal.invoices.hiddenCols') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const jwt = sessionStorage.getItem('portal_jwt');
    if (!jwt) {
      message.warning(t('portal.session_expired'));
      navigate('/portal/login');
      return;
    }

    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const jwt = sessionStorage.getItem('portal_jwt');
      const res = await api.get('/api/portal/me/invoices', {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      setInvoices(res.data.invoices || []);
    } catch (_err) {
      message.error(t('portal.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  // Distinct statuses present in the loaded rows → drive client-side tabs/filter.
  const statusOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const inv of invoices) { if (inv?.status) seen.add(String(inv.status)); }
    return Array.from(seen).map((s) => ({ value: s, label: t(s, s) }));
  }, [invoices, t]);

  // Tabs: All + each real status present (with counts) — purely presentational
  // filtering over the already-loaded data (this endpoint has no server params).
  const tabs: KitListTab[] = useMemo(() => [
    { key: 'all', label: t('all', 'All'), count: invoices.length },
    ...statusOptions.map((o) => ({
      key: o.value,
      label: o.label,
      count: invoices.filter((inv) => String(inv?.status) === o.value).length,
    })),
  ], [invoices, statusOptions, t]);

  // Client-side view: tab (status) + search over invoice number.
  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (tab !== 'all' && String(inv?.status) !== tab) return false;
      if (q && !String(inv?.invoice_number ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [invoices, tab, search]);

  const allColumns = [
    {
      title: t('portal.invoice_number'),
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (text: string) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <FileTextOutlined style={{ color: 'var(--ink-400)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{text}</span>
        </span>
      ),
    },
    {
      title: t('portal.date'),
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
    },
    {
      title: t('portal.due_date'),
      dataIndex: 'due_date',
      key: 'due_date',
      render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
    },
    {
      title: t('portal.amount'),
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
          {val?.toLocaleString()} {t('currency')}
        </span>
      ),
    },
    {
      title: t('portal.balance'),
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
          {val?.toLocaleString()} {t('currency')}
        </span>
      ),
    },
    {
      title: t('portal.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusTag status={status} />,
    },
  ];

  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'invoice_number',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('portal.invoices.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <div style={{ padding: '24px', background: 'var(--surface-2)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate('/portal')}
          style={{ marginBottom: 16 }}
        >
          {t('portal.back_to_dashboard')}
        </Button>

        <PageHeader title={t('portal.my_invoices')} />

        <KitListCard
          tabs={tabs}
          activeTab={tab}
          onTabChange={(k) => setTab(k)}
          toolbar={
            <>
              <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <KitFiltersButton
                  activeCount={tab !== 'all' ? 1 : 0}
                  onClear={() => setTab('all')}
                >
                  <Radio.Group
                    value={tab}
                    onChange={(e) => setTab(e.target.value)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <Radio value="all">{t('all', 'All')}</Radio>
                    {statusOptions.map((o) => (
                      <Radio key={o.value} value={o.value}>{o.label}</Radio>
                    ))}
                  </Radio.Group>
                </KitFiltersButton>
                {statusOptions.length > 0 && (
                  <KitStatusFilter
                    label={t('portal.status')}
                    anyLabel={t('all', 'All')}
                    value={tab === 'all' ? '' : tab}
                    onChange={(v) => setTab(v || 'all')}
                    options={statusOptions}
                  />
                )}
              </div>
              <div style={{ marginInlineStart: 'auto' }}>
                <KitListToolbarActions
                  columns={columnsMeta}
                  hiddenCols={hiddenCols}
                  onColumnsChange={persistHidden}
                  onExport={() => {
                    const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key));
                    downloadCsv('portal-invoices', data, cols);
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
            dataSource={data}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: t('portal.no_invoices') }}
          />
        </KitListCard>
      </div>
    </div>
  );
};

export default PortalInvoices;
