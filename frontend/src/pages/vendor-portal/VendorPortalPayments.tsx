import React, { useMemo, useState, useEffect } from 'react';
import { Button, Empty, Radio } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import vendorApi from '../../api/vendorPortal';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { PageHeader, StatusTag, type StatusKind, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';

const VendorPortalPayments: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  // Kit list segment (status) — filters the already-loaded rows client-side.
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('vendorPayments.hiddenCols') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const res = await vendorApi.get('/api/vendor-portal/me/payments');
      setPayments(res.data.payments || []);
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.error(t('vendor_portal.token_invalid'));
        navigate('/vendor-portal/login');
      } else {
        message.error(t('portal.load_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Kit list tabs (All / Completed / Pending / Failed) — client-side status segment.
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    { key: 'completed', label: t('completed', 'Completed') },
    { key: 'pending', label: t('pending', 'Pending') },
    { key: 'failed', label: t('failed', 'Failed') },
  ];

  const visiblePayments = useMemo(
    () => (statusFilter === 'all' ? payments : payments.filter((p) => p.status === statusFilter)),
    [payments, statusFilter],
  );
  const filteredPayments = useMemo(() => {
    if (!search) return visiblePayments;
    const q = search.toLowerCase();
    return visiblePayments.filter((row: any) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
    );
  }, [visiblePayments, search]);

  const allColumns = [
    {
      title: t('vendor_portal.payment_date'),
      dataIndex: 'payment_date',
      key: 'payment_date',
      render: (date: string, record: any) => date || record.date || '-',
    },
    {
      title: t('vendor_portal.payment_reference'),
      dataIndex: 'reference',
      key: 'reference',
      render: (ref: string) =>
        ref
          ? <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{ref}</span>
          : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('vendor_portal.payment_method'),
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (method: string) =>
        method
          ? (
            <span style={{
              display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
            }}>{method}</span>
          )
          : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('vendor_portal.payment_amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {val?.toFixed(2) || '0.00'}
        </span>
      ),
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const kinds: Record<string, StatusKind> = {
          completed: 'success',
          pending: 'warning',
          failed: 'error',
        };
        return (
          <StatusTag status={kinds[status] || 'default'} label={status || t('completed')} />
        );
      },
    },
  ];

  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'payment_date',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('vendorPayments.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <div>
      <PageHeader
        title={t('vendor_portal.my_payments')}
        extra={
          <Button onClick={() => navigate('/vendor-portal')}>
            {t('back')}
          </Button>
        }
      />

      <KitListCard
        tabs={tabs}
        activeTab={statusFilter}
        onTabChange={(k) => setStatusFilter(k as typeof statusFilter)}
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => setSearch(v)}
              placeholder={t('search')}
            />
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <KitFiltersButton
                activeCount={statusFilter !== 'all' ? 1 : 0}
                onClear={() => setStatusFilter('all')}
              >
                <Radio.Group
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <Radio value="all">{t('all', 'All')}</Radio>
                  <Radio value="completed">{t('completed', 'Completed')}</Radio>
                  <Radio value="pending">{t('pending', 'Pending')}</Radio>
                  <Radio value="failed">{t('failed', 'Failed')}</Radio>
                </Radio.Group>
              </KitFiltersButton>
              <KitStatusFilter
                label={t('status', 'Status')}
                anyLabel={t('all', 'All')}
                value={statusFilter === 'all' ? '' : statusFilter}
                onChange={(v) => setStatusFilter((v || 'all') as typeof statusFilter)}
                options={[
                  { value: 'completed', label: t('completed', 'Completed') },
                  { value: 'pending', label: t('pending', 'Pending') },
                  { value: 'failed', label: t('failed', 'Failed') },
                ]}
              />
            </div>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key));
                  downloadCsv('vendor-payments', filteredPayments, cols);
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
          dataSource={filteredPayments}
          columns={columns}
          loading={loading}
          rowKey="id"
          locale={{
            emptyText: <Empty description={t('vendor_portal.no_payments')} />,
          }}
        />
      </KitListCard>
    </div>
  );
};

export default VendorPortalPayments;
