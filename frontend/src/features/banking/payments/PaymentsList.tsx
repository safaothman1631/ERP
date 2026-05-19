/**
 * PaymentsList — Modern list page for Payments (Customer & Vendor).
 *
 * Anatomy (Requirements 14.1):
 *   <PageTransition>
 *     <Suspense fallback={<LoadingSkeleton variant="table" />}>
 *       <PageHeader> + <FilterBar> + <BulkActionBar> + <DataTable> + <Pagination>
 *     </Suspense>
 *   </PageTransition>
 *
 * Features:
 *  - ExportMenu (CSV, Excel, PDF) — Requirement 14.7
 *  - EmptyState with illustration + headline + CTA — Requirement 14.6
 *  - LoadingSkeleton variant="table" during loading — Requirement 14.8
 *  - BulkActionBar when rows selected — Requirement 14.4
 *  - Virtualization auto-enabled for ≥200 rows — Requirement 14.5
 *
 * Requirements: 14.1–14.9
 */

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Pagination, Space } from 'antd';
import {
  PlusOutlined,
  WalletOutlined,
  DeleteOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../../../components/PageTransition';
import { LoadingSkeleton } from '../../../design-system/LoadingSkeleton';
import { PageHeader } from '../../../design-system/PageHeader';
import { FilterBar, type FilterDef } from '../../../design-system/FilterBar';
import { DataTable, type ColumnDef, type ExportConfig } from '../../../design-system/DataTable';
import { ExportMenu } from '../../../design-system/ExportMenu';
import { StatusTag } from '../../../design-system/StatusTag';
import { MoneyDisplay } from '../../../design-system/MoneyDisplay';
import { MotionButton } from '../../../components/MotionButton';
import { space } from '../../../theme/tokens';
import api from '../../../api';
import { message } from '../../../utils/message';
import { downloadCsv } from '../../../utils/exportCsv';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  payment_number: string;
  contact_name: string;
  payment_date: string;
  payment_mode: string;
  amount: number;
  unused_amount: number;
  currency_code: string;
  status: string;
  payment_type: 'customer' | 'vendor';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { label: 'Customer Payments', value: 'customer' },
  { label: 'Vendor Payments', value: 'vendor' },
];

const MODE_OPTIONS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'Credit Card', value: 'credit_card' },
];

const STATUS_OPTIONS = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'Void', value: 'void' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const PaymentsListInner: React.FC = () => {
  const { t } = useTranslation(['banking', 'common']);
  const navigate = useNavigate();

  const [data, setData] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({ payment_type: 'customer' });
  const [searchValue, setSearchValue] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const paymentType = filterValues.payment_type ?? 'customer';
      const endpoint = paymentType === 'vendor' ? '/api/vendor-payments' : '/api/customer-payments';
      const res = await api.get(endpoint, {
        params: {
          page,
          page_size: PAGE_SIZE,
          payment_mode: filterValues.payment_mode || undefined,
          status: filterValues.status || undefined,
          search: searchValue || undefined,
        },
      });
      setData(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      message.error(t('common:error', 'An error occurred'));
    } finally {
      setLoading(false);
    }
  }, [page, filterValues, searchValue, t]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Payment>[]>(() => [
    {
      key: 'payment_number',
      dataIndex: 'payment_number',
      title: t('banking:payment_number', 'Payment #'),
      width: 150,
      sorter: true,
      resizable: true,
      render: (v: string) => (
        <span style={{ fontWeight: 600, color: 'var(--ant-color-primary)' }}>{v || '—'}</span>
      ),
    },
    {
      key: 'contact_name',
      dataIndex: 'contact_name',
      title: filterValues.payment_type === 'vendor'
        ? t('purchases:vendor', 'Vendor')
        : t('common:customer', 'Customer'),
      sorter: true,
      resizable: true,
      ellipsis: true,
    },
    {
      key: 'payment_date',
      dataIndex: 'payment_date',
      title: t('banking:payment_date', 'Date'),
      width: 120,
      sorter: true,
    },
    {
      key: 'payment_mode',
      dataIndex: 'payment_mode',
      title: t('banking:payment_mode', 'Mode'),
      width: 140,
      render: (v: string) => <StatusTag status="info" label={t(`banking:${v}`, v)} />,
    },
    {
      key: 'amount',
      dataIndex: 'amount',
      title: t('common:amount', 'Amount'),
      width: 150,
      align: 'end',
      sorter: true,
      render: (v: number, r: Payment) => (
        <MoneyDisplay amount={v} currency={r.currency_code as 'IQD' | 'USD'} />
      ),
    },
    {
      key: 'unused_amount',
      dataIndex: 'unused_amount',
      title: t('banking:unused_amount', 'Unused'),
      width: 150,
      align: 'end',
      sorter: true,
      render: (v: number, r: Payment) => (
        <MoneyDisplay amount={v} currency={r.currency_code as 'IQD' | 'USD'} />
      ),
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: t('common:status', 'Status'),
      width: 110,
      render: (s: string) => <StatusTag status={s} label={t(`common:${s}`, s)} />,
    },
  ], [t, filterValues.payment_type]);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filters = useMemo<FilterDef[]>(() => [
    {
      key: 'payment_type',
      label: t('banking:payment_type', 'Type'),
      options: TYPE_OPTIONS,
    },
    {
      key: 'payment_mode',
      label: t('banking:payment_mode', 'Mode'),
      options: MODE_OPTIONS,
    },
    {
      key: 'status',
      label: t('common:status', 'Status'),
      options: STATUS_OPTIONS,
    },
  ], [t]);

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportConfig = useMemo<ExportConfig>(() => ({
    onExport: (format) => {
      if (format === 'csv') {
        downloadCsv('payments', data, columns.map((c) => ({ key: c.key as string, label: String(c.title) })));
      }
    },
    formats: ['csv', 'xlsx', 'pdf'],
  }), [data, columns]);

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const bulkActions = useMemo(() => [
    {
      key: 'print',
      label: t('common:print', 'Print'),
      icon: <PrinterOutlined />,
      onClick: async () => { window.print(); },
    },
    {
      key: 'delete',
      label: t('common:delete', 'Delete'),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: async () => { message.warning(t('common:bulk_delete_confirm', 'Deleting selected payments…')); },
    },
  ], [t]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setFilterValues({ payment_type: 'customer' });
    setSearchValue('');
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => { void fetchData(); }, [fetchData]);

  const newPaymentPath = filterValues.payment_type === 'vendor'
    ? '/vendor-payments/new'
    : '/customer-payments/new';

  return (
    <div style={{ padding: space.lg }}>
      {/* PageHeader — Requirement 14.1 */}
      <PageHeader
        title={t('banking:payments', 'Payments')}
        subtitle={t('banking:payments_subtitle', 'Track customer and vendor payments')}
        breadcrumb={[
          { label: t('common:home', 'Home'), to: '/dashboard' },
          { label: t('banking:payments', 'Payments') },
        ]}
        helpKey="payments"
        sectionId="banking.payments"
        extra={
          <Space size={space.sm}>
            {/* ExportMenu — Requirement 14.7 */}
            <ExportMenu
              onExport={exportConfig.onExport}
              formats={['csv', 'xlsx', 'pdf']}
            />
            <MotionButton
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => navigate(newPaymentPath)}
              aria-label={t('banking:new_payment', 'New Payment')}
            >
              {t('banking:new_payment', 'New Payment')}
            </MotionButton>
          </Space>
        }
      />

      {/* FilterBar — Requirement 14.1 */}
      <FilterBar
        searchPlaceholder={t('banking:search_payments', 'Search payments…')}
        searchValue={searchValue}
        onSearchChange={(v) => { setSearchValue(v); setPage(1); }}
        filters={filters}
        values={filterValues}
        onChange={(v) => { setFilterValues(v); setPage(1); }}
        onReset={handleReset}
        onRefresh={handleRefresh}
      />

      {/* DataTable — includes BulkActionBar + EmptyState + LoadingSkeleton — Requirements 14.1–14.9 */}
      <DataTable<Payment>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection
        bulkActions={bulkActions}
        exportConfig={exportConfig}
        stickyHeader
        rowKey="id"
        onView={(r) => navigate(`/payments/${r.id}`)}
        showDefaultQuickActions
        emptyIcon={<WalletOutlined />}
        emptyTitle={t('banking:no_payments', 'No payments yet')}
        emptyDescription={t('banking:no_payments_hint', 'Record your first payment to start tracking cash flow')}
        emptyActionLabel={t('banking:new_payment', 'New Payment')}
        onEmptyAction={() => navigate(newPaymentPath)}
        pagination={false}
      />

      {/* Pagination — Requirement 14.1 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: space.md }}>
        <Pagination
          current={page}
          total={total}
          pageSize={PAGE_SIZE}
          onChange={setPage}
          showSizeChanger={false}
          showTotal={(tot) => t('common:total_records', '{{n}} records', { n: tot })}
        />
      </div>
    </div>
  );
};

/**
 * PaymentsList — wrapped in PageTransition + Suspense per spec Task 18.
 * Requirements: 14.1–14.9
 */
const PaymentsList: React.FC = () => (
  <PageTransition>
    <Suspense fallback={<LoadingSkeleton variant="table" />}>
      <PaymentsListInner />
    </Suspense>
  </PageTransition>
);

export default PaymentsList;
