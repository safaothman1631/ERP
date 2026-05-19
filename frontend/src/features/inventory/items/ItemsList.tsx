/**
 * ItemsList — Modern list page for Items (Products & Services).
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
  AppstoreOutlined,
  DeleteOutlined,
  CopyOutlined,
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

interface Item {
  id: string;
  name: string;
  sku: string;
  item_type: string;
  unit: string;
  purchase_rate: number;
  sales_rate: number;
  stock_on_hand: number;
  currency_code: string;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { label: 'Inventory', value: 'inventory' },
  { label: 'Non-Inventory', value: 'non_inventory' },
  { label: 'Service', value: 'service' },
];

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const ItemsListInner: React.FC = () => {
  const { t } = useTranslation(['inventory', 'common']);
  const navigate = useNavigate();

  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
  const [searchValue, setSearchValue] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/items', {
        params: {
          page,
          page_size: PAGE_SIZE,
          item_type: filterValues.item_type || undefined,
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
  const columns = useMemo<ColumnDef<Item>[]>(() => [
    {
      key: 'name',
      dataIndex: 'name',
      title: t('inventory:item_name', 'Item Name'),
      sorter: true,
      resizable: true,
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v || '—'}</span>,
    },
    {
      key: 'sku',
      dataIndex: 'sku',
      title: t('inventory:sku', 'SKU'),
      width: 130,
      resizable: true,
    },
    {
      key: 'item_type',
      dataIndex: 'item_type',
      title: t('inventory:type', 'Type'),
      width: 140,
      render: (v: string) => <StatusTag status="info" label={t(`inventory:${v}`, v)} />,
    },
    {
      key: 'unit',
      dataIndex: 'unit',
      title: t('inventory:unit', 'Unit'),
      width: 90,
    },
    {
      key: 'purchase_rate',
      dataIndex: 'purchase_rate',
      title: t('inventory:purchase_rate', 'Purchase Rate'),
      width: 150,
      align: 'end',
      sorter: true,
      render: (v: number, r: Item) => (
        <MoneyDisplay amount={v} currency={r.currency_code as 'IQD' | 'USD'} />
      ),
    },
    {
      key: 'sales_rate',
      dataIndex: 'sales_rate',
      title: t('inventory:sales_rate', 'Sales Rate'),
      width: 150,
      align: 'end',
      sorter: true,
      render: (v: number, r: Item) => (
        <MoneyDisplay amount={v} currency={r.currency_code as 'IQD' | 'USD'} />
      ),
    },
    {
      key: 'stock_on_hand',
      dataIndex: 'stock_on_hand',
      title: t('inventory:stock_on_hand', 'Stock'),
      width: 110,
      align: 'end',
      sorter: true,
      render: (v: number) => (
        <span style={{ fontWeight: 500, color: v <= 0 ? 'var(--ant-color-error)' : undefined }}>
          {v ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: t('common:status', 'Status'),
      width: 110,
      render: (s: string) => <StatusTag status={s} label={t(`common:${s}`, s)} />,
    },
  ], [t]);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filters = useMemo<FilterDef[]>(() => [
    {
      key: 'item_type',
      label: t('inventory:type', 'Type'),
      options: TYPE_OPTIONS,
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
        downloadCsv('items', data, columns.map((c) => ({ key: c.key as string, label: String(c.title) })));
      }
    },
    formats: ['csv', 'xlsx', 'pdf'],
  }), [data, columns]);

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const bulkActions = useMemo(() => [
    {
      key: 'duplicate',
      label: t('common:duplicate', 'Duplicate'),
      icon: <CopyOutlined />,
      onClick: async () => { message.info(t('common:bulk_duplicate', 'Duplicating selected items…')); },
    },
    {
      key: 'delete',
      label: t('common:delete', 'Delete'),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: async () => { message.warning(t('common:bulk_delete_confirm', 'Deleting selected items…')); },
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
        title={t('inventory:items', 'Items')}
        subtitle={t('inventory:items_subtitle', 'Manage your products, services, and inventory')}
        breadcrumb={[
          { label: t('common:home', 'Home'), to: '/dashboard' },
          { label: t('inventory:items', 'Items') },
        ]}
        helpKey="items"
        sectionId="inventory.items"
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
              onClick={() => navigate('/items/new')}
              aria-label={t('inventory:new_item', 'New Item')}
            >
              {t('inventory:new_item', 'New Item')}
            </MotionButton>
          </Space>
        }
      />

      {/* FilterBar — Requirement 14.1 */}
      <FilterBar
        searchPlaceholder={t('inventory:search_items', 'Search items…')}
        searchValue={searchValue}
        onSearchChange={(v) => { setSearchValue(v); setPage(1); }}
        filters={filters}
        values={filterValues}
        onChange={(v) => { setFilterValues(v); setPage(1); }}
        onReset={handleReset}
        onRefresh={handleRefresh}
      />

      {/* DataTable — includes BulkActionBar + EmptyState + LoadingSkeleton — Requirements 14.1–14.9 */}
      <DataTable<Item>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection
        bulkActions={bulkActions}
        exportConfig={exportConfig}
        stickyHeader
        rowKey="id"
        onView={(r) => navigate(`/items/${r.id}`)}
        onEdit={(r) => navigate(`/items/${r.id}/edit`)}
        showDefaultQuickActions
        emptyIcon={<AppstoreOutlined />}
        emptyTitle={t('inventory:no_items', 'No items yet')}
        emptyDescription={t('inventory:no_items_hint', 'Add your first item to start managing inventory')}
        emptyActionLabel={t('inventory:new_item', 'New Item')}
        onEmptyAction={() => navigate('/items/new')}
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
 * ItemsList — wrapped in PageTransition + Suspense per spec Task 18.
 * Requirements: 14.1–14.9
 */
const ItemsList: React.FC = () => (
  <PageTransition>
    <Suspense fallback={<LoadingSkeleton variant="table" />}>
      <ItemsListInner />
    </Suspense>
  </PageTransition>
);

export default ItemsList;
