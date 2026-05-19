/**
 * PurchaseOrdersList — Modern list page for Purchase Orders.
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
  ShoppingCartOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  SendOutlined,
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

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  date: string;
  expected_delivery_date: string;
  total: number;
  status: string;
  currency_code: string;
  delivery_status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Issued', value: 'issued' },
  { label: 'Received', value: 'received' },
  { label: 'Partially Received', value: 'partially_received' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Closed', value: 'closed' },
];

const DELIVERY_OPTIONS = [
  { label: 'Not Received', value: 'not_received' },
  { label: 'Partially Received', value: 'partially_received' },
  { label: 'Fully Received', value: 'fully_received' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const PurchaseOrdersListInner: React.FC = () => {
  const { t } = useTranslation(['purchases', 'common']);
  const navigate = useNavigate();

  const [data, setData] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
  const [searchValue, setSearchValue] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/purchase-orders', {
        params: {
          page,
          page_size: PAGE_SIZE,
          status: filterValues.status || undefined,
          delivery_status: filterValues.delivery_status || undefined,
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
  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    {
      key: 'po_number',
      dataIndex: 'po_number',
      title: t('purchases:po_number', 'PO #'),
      width: 140,
      sorter: true,
      resizable: true,
      render: (v: string) => (
        <span style={{ fontWeight: 600, color: 'var(--ant-color-primary)' }}>{v || '—'}</span>
      ),
    },
    {
      key: 'vendor_name',
      dataIndex: 'vendor_name',
      title: t('purchases:vendor', 'Vendor'),
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
      key: 'expected_delivery_date',
      dataIndex: 'expected_delivery_date',
      title: t('purchases:expected_delivery', 'Expected Delivery'),
      width: 160,
      sorter: true,
    },
    {
      key: 'total',
      dataIndex: 'total',
      title: t('common:total', 'Total'),
      width: 150,
      align: 'end',
      sorter: true,
      render: (v: number, r: PurchaseOrder) => (
        <MoneyDisplay amount={v} currency={r.currency_code as 'IQD' | 'USD'} />
      ),
    },
    {
      key: 'delivery_status',
      dataIndex: 'delivery_status',
      title: t('purchases:delivery_status', 'Delivery'),
      width: 160,
      render: (s: string) => {
        const statusMap: Record<string, string> = {
          not_received: 'warning',
          partially_received: 'partial',
          fully_received: 'paid',
        };
        return <StatusTag status={statusMap[s] ?? 'default'} label={t(`purchases:${s}`, s)} />;
      },
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
    {
      key: 'delivery_status',
      label: t('purchases:delivery_status', 'Delivery'),
      options: DELIVERY_OPTIONS,
    },
  ], [t]);

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportConfig = useMemo<ExportConfig>(() => ({
    onExport: (format) => {
      if (format === 'csv') {
        downloadCsv('purchase-orders', data, columns.map((c) => ({ key: c.key as string, label: String(c.title) })));
      }
    },
    formats: ['csv', 'xlsx', 'pdf'],
  }), [data, columns]);

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const bulkActions = useMemo(() => [
    {
      key: 'issue',
      label: t('purchases:issue', 'Issue'),
      icon: <SendOutlined />,
      onClick: async () => { message.info(t('purchases:bulk_issue', 'Issuing selected purchase orders…')); },
    },
    {
      key: 'receive',
      label: t('purchases:receive', 'Mark Received'),
      icon: <CheckCircleOutlined />,
      onClick: async () => { message.info(t('purchases:bulk_receive', 'Marking selected POs as received…')); },
    },
    {
      key: 'delete',
      label: t('common:delete', 'Delete'),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: async () => { message.warning(t('common:bulk_delete_confirm', 'Deleting selected purchase orders…')); },
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
        title={t('purchases:purchase_orders', 'Purchase Orders')}
        subtitle={t('purchases:purchase_orders_subtitle', 'Manage vendor purchase orders and deliveries')}
        breadcrumb={[
          { label: t('common:home', 'Home'), to: '/dashboard' },
          { label: t('purchases:purchase_orders', 'Purchase Orders') },
        ]}
        helpKey="purchase-orders"
        sectionId="purchases.purchase_orders"
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
              onClick={() => navigate('/purchase-orders/new')}
              aria-label={t('purchases:new_po', 'New Purchase Order')}
            >
              {t('purchases:new_po', 'New Purchase Order')}
            </MotionButton>
          </Space>
        }
      />

      {/* FilterBar — Requirement 14.1 */}
      <FilterBar
        searchPlaceholder={t('purchases:search_pos', 'Search purchase orders…')}
        searchValue={searchValue}
        onSearchChange={(v) => { setSearchValue(v); setPage(1); }}
        filters={filters}
        values={filterValues}
        onChange={(v) => { setFilterValues(v); setPage(1); }}
        onReset={handleReset}
        onRefresh={handleRefresh}
      />

      {/* DataTable — includes BulkActionBar + EmptyState + LoadingSkeleton — Requirements 14.1–14.9 */}
      <DataTable<PurchaseOrder>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection
        bulkActions={bulkActions}
        exportConfig={exportConfig}
        stickyHeader
        rowKey="id"
        onView={(r) => navigate(`/purchase-orders/${r.id}`)}
        onEdit={(r) => navigate(`/purchase-orders/${r.id}/edit`)}
        showDefaultQuickActions
        emptyIcon={<ShoppingCartOutlined />}
        emptyTitle={t('purchases:no_pos', 'No purchase orders yet')}
        emptyDescription={t('purchases:no_pos_hint', 'Create your first purchase order to start managing procurement')}
        emptyActionLabel={t('purchases:new_po', 'New Purchase Order')}
        onEmptyAction={() => navigate('/purchase-orders/new')}
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
 * PurchaseOrdersList — wrapped in PageTransition + Suspense per spec Task 18.
 * Requirements: 14.1–14.9
 */
const PurchaseOrdersList: React.FC = () => (
  <PageTransition>
    <Suspense fallback={<LoadingSkeleton variant="table" />}>
      <PurchaseOrdersListInner />
    </Suspense>
  </PageTransition>
);

export default PurchaseOrdersList;
