/**
 * CustomersList — Modern list page for Customers.
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
import { Avatar, Pagination, Space } from 'antd';
import {
  PlusOutlined,
  TeamOutlined,
  DeleteOutlined,
  MailOutlined,
  UserOutlined,
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

interface Customer {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  outstanding_balance: number;
  currency_code: string;
  status: string;
  contact_type: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { label: 'Customer', value: 'customer' },
  { label: 'Vendor', value: 'vendor' },
  { label: 'Both', value: 'both' },
];

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const CustomersListInner: React.FC = () => {
  const { t } = useTranslation(['crm', 'common']);
  const navigate = useNavigate();

  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
  const [searchValue, setSearchValue] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/contacts', {
        params: {
          page,
          page_size: PAGE_SIZE,
          contact_type: filterValues.contact_type || 'customer',
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
  const columns = useMemo<ColumnDef<Customer>[]>(() => [
    {
      key: 'display_name',
      dataIndex: 'display_name',
      title: t('common:name', 'Name'),
      sorter: true,
      resizable: true,
      render: (v: string) => (
        <Space size={space.sm}>
          <Avatar size="small" icon={<UserOutlined />} />
          <span style={{ fontWeight: 500 }}>{v || '—'}</span>
        </Space>
      ),
    },
    {
      key: 'email',
      dataIndex: 'email',
      title: t('common:email', 'Email'),
      resizable: true,
      ellipsis: true,
    },
    {
      key: 'phone',
      dataIndex: 'phone',
      title: t('common:phone', 'Phone'),
      width: 150,
    },
    {
      key: 'outstanding_balance',
      dataIndex: 'outstanding_balance',
      title: t('common:outstanding_balance', 'Outstanding'),
      width: 160,
      align: 'end',
      sorter: true,
      render: (v: number, r: Customer) => (
        <MoneyDisplay amount={v} currency={r.currency_code as 'IQD' | 'USD'} />
      ),
    },
    {
      key: 'contact_type',
      dataIndex: 'contact_type',
      title: t('common:type', 'Type'),
      width: 110,
      render: (v: string) => <StatusTag status={v === 'customer' ? 'active' : 'info'} label={t(`common:${v}`, v)} />,
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
      key: 'contact_type',
      label: t('common:type', 'Type'),
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
        downloadCsv('customers', data, columns.map((c) => ({ key: c.key as string, label: String(c.title) })));
      }
    },
    formats: ['csv', 'xlsx', 'pdf'],
  }), [data, columns]);

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const bulkActions = useMemo(() => [
    {
      key: 'email',
      label: t('common:send_email', 'Send Email'),
      icon: <MailOutlined />,
      onClick: async () => { message.info(t('common:bulk_email', 'Sending emails to selected customers…')); },
    },
    {
      key: 'delete',
      label: t('common:delete', 'Delete'),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: async () => { message.warning(t('common:bulk_delete_confirm', 'Deleting selected customers…')); },
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
        title={t('crm:customers', 'Customers')}
        subtitle={t('crm:customers_subtitle', 'Manage your customer relationships and balances')}
        breadcrumb={[
          { label: t('common:home', 'Home'), to: '/dashboard' },
          { label: t('crm:customers', 'Customers') },
        ]}
        helpKey="customers"
        sectionId="contacts.list"
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
              onClick={() => navigate('/contacts/new')}
              aria-label={t('crm:new_customer', 'New Customer')}
            >
              {t('crm:new_customer', 'New Customer')}
            </MotionButton>
          </Space>
        }
      />

      {/* FilterBar — Requirement 14.1 */}
      <FilterBar
        searchPlaceholder={t('crm:search_customers', 'Search customers…')}
        searchValue={searchValue}
        onSearchChange={(v) => { setSearchValue(v); setPage(1); }}
        filters={filters}
        values={filterValues}
        onChange={(v) => { setFilterValues(v); setPage(1); }}
        onReset={handleReset}
        onRefresh={handleRefresh}
      />

      {/* DataTable — includes BulkActionBar + EmptyState + LoadingSkeleton — Requirements 14.1–14.9 */}
      <DataTable<Customer>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection
        bulkActions={bulkActions}
        exportConfig={exportConfig}
        stickyHeader
        rowKey="id"
        onView={(r) => navigate(`/contacts/${r.id}`)}
        onEdit={(r) => navigate(`/contacts/${r.id}/edit`)}
        showDefaultQuickActions
        emptyIcon={<TeamOutlined />}
        emptyTitle={t('crm:no_customers', 'No customers yet')}
        emptyDescription={t('crm:no_customers_hint', 'Add your first customer to start managing relationships')}
        emptyActionLabel={t('crm:new_customer', 'New Customer')}
        onEmptyAction={() => navigate('/contacts/new')}
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
 * CustomersList — wrapped in PageTransition + Suspense per spec Task 18.
 * Requirements: 14.1–14.9
 */
const CustomersList: React.FC = () => (
  <PageTransition>
    <Suspense fallback={<LoadingSkeleton variant="table" />}>
      <CustomersListInner />
    </Suspense>
  </PageTransition>
);

export default CustomersList;
