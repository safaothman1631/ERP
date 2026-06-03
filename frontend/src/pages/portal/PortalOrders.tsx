import React, { useEffect, useMemo, useState } from 'react';
import { Button, Radio } from 'antd';
import { LeftOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import { PageHeader, StatusTag, type StatusKind, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

/** Order status → semantic StatusTag kind (preserves the page's existing mapping). */
const STATUS_KIND: Record<string, StatusKind> = {
  draft: 'default',
  confirmed: 'info',
  processing: 'warning',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'error',
};

const STATUS_KEYS = ['draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type StatusTab = 'all' | (typeof STATUS_KEYS)[number];

const PortalOrders: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('portalOrders.hiddenCols') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const jwt = sessionStorage.getItem('portal_jwt');
    if (!jwt) {
      message.warning(t('portal.session_expired'));
      navigate('/portal/login');
      return;
    }

    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const jwt = sessionStorage.getItem('portal_jwt');
      const res = await api.get('/api/portal/me/orders', {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      setOrders(res.data.orders || []);
    } catch (_err) {
      message.error(t('portal.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  // Client-side status filter (this page loads all orders; no server filter param).
  const filteredOrders = useMemo(
    () => {
      const byTab = tab === 'all' ? orders : orders.filter((o) => o.status === tab);
      if (!search) return byTab;
      const q = search.toLowerCase();
      return byTab.filter((row: any) =>
        Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
      );
    },
    [orders, tab, search],
  );

  // Kit list tabs (All + each order status) — drive the same client filter.
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    ...STATUS_KEYS.map((s) => ({ key: s, label: t(`portal.status_${s}`, s) })),
  ];

  const allColumns = [
    {
      title: t('portal.order_id'),
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ShoppingOutlined style={{ color: 'var(--ink-400)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>
            {text.slice(0, 8)}...
          </span>
        </span>
      ),
    },
    {
      title: t('portal.order_date'),
      dataIndex: 'order_date',
      key: 'order_date',
      render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
    },
    {
      title: t('portal.source'),
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => (
        <span style={{
          display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
        }}>{source || 'manual'}</span>
      ),
    },
    {
      title: t('portal.total'),
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
      title: t('portal.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusTag status={STATUS_KIND[status] || 'default'} label={status} />,
    },
  ];

  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'id',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('portalOrders.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
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

        <PageHeader title={t('portal.my_orders')} />

        <KitListCard
          tabs={tabs}
          activeTab={tab}
          onTabChange={(k) => { setTab(k as StatusTab); setPage(1); }}
          toolbar={
            <>
              <KitSearchInput
                value={search}
                onChange={(v) => { setSearch(v); setPage(1); }}
                placeholder={t('search')}
              />
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <KitFiltersButton
                  activeCount={tab !== 'all' ? 1 : 0}
                  onClear={() => { setTab('all'); setPage(1); }}
                >
                  <Radio.Group
                    value={tab}
                    onChange={(e) => { setTab(e.target.value); setPage(1); }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <Radio value="all">{t('all', 'All')}</Radio>
                    {STATUS_KEYS.map((s) => (
                      <Radio key={s} value={s}>{t(`portal.status_${s}`, s)}</Radio>
                    ))}
                  </Radio.Group>
                </KitFiltersButton>
                <KitStatusFilter
                  label={t('portal.status')}
                  anyLabel={t('all', 'All')}
                  value={tab === 'all' ? '' : tab}
                  onChange={(v) => { setTab((v || 'all') as StatusTab); setPage(1); }}
                  options={STATUS_KEYS.map((s) => ({ value: s, label: t(`portal.status_${s}`, s) }))}
                />
              </div>
              <div style={{ marginInlineStart: 'auto' }}>
                <KitListToolbarActions
                  columns={columnsMeta}
                  hiddenCols={hiddenCols}
                  onColumnsChange={persistHidden}
                  onExport={() => {
                    const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key));
                    downloadCsv('orders', filteredOrders, cols);
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
            dataSource={filteredOrders}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ current: page, pageSize: 20, onChange: setPage }}
            locale={{ emptyText: t('portal.no_orders') }}
          />
        </KitListCard>
      </div>
    </div>
  );
};

export default PortalOrders;
