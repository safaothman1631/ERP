import React, { useMemo, useState, useEffect } from 'react';
import { Button, Space, Empty, Radio } from 'antd';
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

const VendorPortalBills: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('vendor_portal_bills.hiddenCols') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    loadBills();
  }, [statusFilter]);

  const loadBills = async () => {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/api/vendor-portal/me/bills?status=${statusFilter}`
        : '/api/vendor-portal/me/bills';
      const res = await vendorApi.get(url);
      setBills(res.data.bills || []);
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

  // Status segments — wired to the SAME `statusFilter` server param the page already supports.
  const statusOptions = [
    { value: 'pending_review', label: t('vendor_portal.pending_review') },
    { value: 'approved', label: t('vendor_portal.approved') },
    { value: 'paid', label: t('vendor_portal.paid') },
  ];

  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    ...statusOptions.map((o) => ({ key: o.value, label: o.label })),
  ];

  const allColumns = [
    {
      title: t('vendor_portal.bill_number'),
      dataIndex: 'bill_number',
      key: 'bill_number',
      render: (v: string) => (
        <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v || '—'}</span>
      ),
    },
    {
      title: t('vendor_portal.bill_date'),
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
    },
    {
      title: t('vendor_portal.due_date'),
      dataIndex: 'due_date',
      key: 'due_date',
      render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
    },
    {
      title: t('vendor_portal.bill_status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const kinds: Record<string, StatusKind> = {
          pending_review: 'warning',
          draft: 'default',
          approved: 'info',
          open: 'info',
          paid: 'success',
          partially_paid: 'partial',
          void: 'error',
        };
        return (
          <StatusTag status={kinds[status] || 'default'} label={t(`vendor_portal.${status}`) || status} />
        );
      },
    },
    {
      title: t('invoices.total'),
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {val?.toFixed(2) || '0.00'}
        </span>
      ),
    },
    {
      title: t('invoices.balance'),
      dataIndex: 'balance_due',
      key: 'balance_due',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {val?.toFixed(2) || '0.00'}
        </span>
      ),
    },
    {
      title: t('vendor_portal.po_number'),
      dataIndex: 'po_id',
      key: 'po_id',
      render: (poId: string) => poId
        ? (
          <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', fontFamily: 'var(--font-mono)',
          }}>{poId}</span>
        )
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
  ];

  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const filteredData = useMemo(() => {
    if (!search) return bills;
    const q = search.toLowerCase();
    return bills.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [bills, search]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'bill_number',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('vendor_portal_bills.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <div>
      <PageHeader
        title={t('vendor_portal.my_bills')}
        extra={
          <Space>
            <Button onClick={() => navigate('/vendor-portal/submit-bill')}>
              {t('vendor_portal.submit_bill')}
            </Button>
            <Button onClick={() => navigate('/vendor-portal')}>
              {t('back')}
            </Button>
          </Space>
        }
      />

      <KitListCard
        tabs={tabs}
        activeTab={statusFilter || 'all'}
        onTabChange={(k) => setStatusFilter(k === 'all' ? '' : k)}
        toolbar={
          <>
            <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <KitFiltersButton
                activeCount={statusFilter ? 1 : 0}
                onClear={() => setStatusFilter('')}
              >
                <Radio.Group
                  value={statusFilter || 'all'}
                  onChange={(e) => setStatusFilter(e.target.value === 'all' ? '' : e.target.value)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <Radio value="all">{t('all', 'All')}</Radio>
                  {statusOptions.map((o) => (
                    <Radio key={o.value} value={o.value}>{o.label}</Radio>
                  ))}
                </Radio.Group>
              </KitFiltersButton>
              <KitStatusFilter
                label={t('filter_by_status')}
                anyLabel={t('all', 'All')}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={statusOptions}
              />
            </div>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key));
                  downloadCsv('vendor-portal-bills', bills, cols);
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
          columns={columns}
          loading={loading}
          rowKey="id"
          locale={{
            emptyText: <Empty description={t('vendor_portal.no_bills')} />,
          }}
        />
      </KitListCard>
    </div>
  );
};

export default VendorPortalBills;
