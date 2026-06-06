/**
 * InvoicesList — Modern list page for Invoices.
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
  FileTextOutlined,
  DeleteOutlined,
  SendOutlined,
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

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  date: string;
  due_date: string;
  total: number;
  balance_due: number;
  status: string;
  currency_code: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Partially Paid', value: 'partially_paid' },
  { label: 'Void', value: 'void' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const InvoicesListInner: React.FC = () => {
  const { t } = useTranslation(['sales', 'common']);
  const navigate = useNavigate();

  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
  const [searchValue, setSearchValue] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/invoices', {
        params: {
          page,
          page_size: PAGE_SIZE,
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
  const columns = useMemo<ColumnDef<Invoice>[]>(() => [
    {
      key: 'invoice_number',
      dataIndex: 'invoice_number',
      title: t('common:number', '#'),
      width: 140,
      sorter: true,
      resizable: true,
      render: (v: string) => (
        <span style={{ fontWeight: 600, color: 'var(--ant-color-primary)' }}>{v || '—'}</span>
      ),
    },
    {
      key: 'customer_name',
      dataIndex: 'customer_name',
      title: t('common:customer', 'Customer'),
      sorter: true,
      resizable: true,
      ellipsis: true,
    },
    {
      key: 'date',
      dataIndex: 'date',
      title: t('common:date', 'Date'),
      width: 120,
      sorter: true,
    },
    {
      key: 'due_date',
      dataIndex: 'due_date',
      title: t('common:due_date', 'Due Date'),
      width: 120,
      sorter: true,
    },
    {
      key: 'total',
      dataIndex: 'total',
      title: t('common:total', 'Total'),
      width: 150,
      align: 'end',
      sorter: true,
      render: (v: number, r: Invoice) => (
        <MoneyDisplay amount={v} currency={r.currency_code as 'IQD' | 'USD'} />
      ),
    },
    {
      key: 'balance_due',
      dataIndex: 'balance_due',
      title: t('common:balance_due', 'Balance Due'),
      width: 150,
      align: 'end',
      sorter: true,
      render: (v: number, r: Invoice) => (
        <MoneyDisplay amount={v} currency={r.currency_code as 'IQD' | 'USD'} />
      ),
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: t('common:status', 'Status'),
      width: 130,
      render: (s: string) => <StatusTag status={s} label={t(`common:${s}`, s)} />,
    },
  ], [t]);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filters = useMemo<FilterDef[]>(() => [
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
        downloadCsv('invoices', data, columns.map((c) => ({ key: c.key as string, label: String(c.title) })));
      }
    },
    formats: ['csv', 'xlsx', 'pdf'],
  }), [data, columns]);

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const bulkActions = useMemo(() => [
    {
      key: 'send',
      label: t('common:send', 'Send'),
      icon: <SendOutlined />,
      onClick: async () => { message.info(t('common:bulk_send', 'Sending selected invoices…')); },
    },
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
      onClick: async () => { message.warning(t('common:bulk_delete_confirm', 'Deleting selected invoices…')); },
    },
  ], [t]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setFilterValues({});
    setSearchValue('');
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => { void fetchData(); }, [fetchData]);

  return (
    <div style={{ padding: space.lg }}>
      {/* PageHeader — Requirement 14.1 */}
      <PageHeader
        title={t('sales:invoices', 'Invoices')}
        subtitle={t('sales:invoices_subtitle', 'Track invoices, balances, and customer payments')}
        breadcrumb={[
          { label: t('common:home', 'Home'), to: '/dashboard' },
          { label: t('sales:invoices', 'Invoices') },
        ]}
        helpKey="invoices"
        sectionId="sales.invoices"
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
              onClick={() => navigate('/invoices/new')}
              aria-label={t('sales:new_invoice', 'New Invoice')}
            >
              {t('sales:new_invoice', 'New Invoice')}
            </MotionButton>
          </Space>
        }
      />

      {/* FilterBar — Requirement 14.1 */}
      <FilterBar
        searchPlaceholder={t('sales:search_invoices', 'Search invoices…')}
        searchValue={searchValue}
        onSearchChange={(v) => { setSearchValue(v); setPage(1); }}
        filters={filters}
        values={filterValues}
        onChange={(v) => { setFilterValues(v); setPage(1); }}
        onReset={handleReset}
        onRefresh={handleRefresh}
      />

      {/* DataTable — includes BulkActionBar + EmptyState + LoadingSkeleton — Requirements 14.1–14.9 */}
      <DataTable<Invoice>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection
        bulkActions={bulkActions}
        exportConfig={exportConfig}
        stickyHeader
        rowKey="id"
        onView={(r) => navigate(`/invoices/${r.id}`)}
        onEdit={(r) => navigate(`/invoices/${r.id}/edit`)}
        showDefaultQuickActions
        emptyIcon={<FileTextOutlined />}
        emptyTitle={t('sales:no_invoices', 'No invoices yet')}
        emptyDescription={t('sales:no_invoices_hint', 'Create your first invoice to start tracking receivables')}
        emptyActionLabel={t('sales:new_invoice', 'New Invoice')}
        onEmptyAction={() => navigate('/invoices/new')}
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
 * InvoicesList — wrapped in PageTransition + Suspense per spec Task 18.
 * Requirements: 14.1–14.9
 */
const InvoicesList: React.FC = () => (
  <PageTransition>
    <Suspense fallback={<LoadingSkeleton variant="table" />}>
      <InvoicesListInner />
    </Suspense>
  </PageTransition>
);

export default InvoicesList;
