import React, { useMemo, useState } from 'react';
import { Space, Typography, Switch, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import { EyeOutlined, PrinterOutlined, RollbackOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import api from '../../api';
import { useListQuery } from '../../api/queries/useListQuery';
import { listQueryKeys } from '../../api/queries/keys';
import { message } from '../../utils/message';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PageHeader, StatusTag, KeyValueGrid, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import type { StatusKind } from '../../design-system';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Title } = Typography;

// Map POS order states → StatusTag semantic kinds (auto-flip tokens, light + dark).
const ORDER_STATUS: Record<string, StatusKind> = {
 draft: 'draft',
 quotation: 'pending',
 paid: 'paid',
 invoiced: 'sent',
 cancelled: 'cancelled',
 refunded: 'warning',
};

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const POSOrders: React.FC = () => {
 const { t } = useTranslation();
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [stateFilter, setStateFilter] = useState('');
 const [showQuotationsOnly, setShowQuotationsOnly] = useState(false);
 const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
 const [selectedOrder, setSelectedOrder] = useState<any>(null);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('posOrders.hiddenCols') || '[]'); } catch { return []; }
 });

 const posOrdersQuery = useListQuery<any, { items?: any[]; total?: number }>({
 queryKey: listQueryKeys.posOrders({
 page,
 page_size: 25,
 state: showQuotationsOnly ? undefined : stateFilter || undefined,
 quotations: showQuotationsOnly,
 }),
 queryFn: () => {
 const params: Record<string, unknown> = { page, page_size: 25 };
 if (!showQuotationsOnly && stateFilter) {
 params.state = stateFilter;
 }
 return showQuotationsOnly
 ? api.get('/api/pos/orders/quotations', { params })
 : api.get('/api/pos/orders', { params });
 },
 });
 const data = posOrdersQuery.data?.items ?? [];
 const total = posOrdersQuery.data?.total ?? 0;
 const loading = posOrdersQuery.isLoading || posOrdersQuery.isFetching;

 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);

 const viewOrderDetail = async (orderId: string) => {
 try {
 const res = await api.get(`/api/pos/orders/${orderId}`);
 setSelectedOrder(res.data);
 setDetailDrawerVisible(true);
 } catch {
 message.error(t('error'));
 }
 };

 const handlePrint = async () => {
 message.info(t('pos.printing'));
 // Implement receipt printing
 };

 const handleRefund = async () => {
 message.info(t('pos.refund_feature'));
 // Implement refund modal
 };

 // Sprint 6.3 - Convert quotation to order
 const handleConvertToOrder = async (_order: any) => {
 // Navigate to terminal with this order pre-loaded
 message.info(t('pos.convert_to_order_info'));
 // In a full implementation, you'd navigate to terminal and load the order
 // navigate(`/pos/terminal/${_order.session_id}?order_id=${_order.id}`);
 };

 // Kit list tabs (All / Draft / Paid / Invoiced / Cancelled) — server-side `state` filter.
 const tabs: KitListTab[] = [
 { key: '', label: t('all', 'All') },
 { key: 'draft', label: t('pos.order_draft') },
 { key: 'paid', label: t('pos.order_paid') },
 { key: 'invoiced', label: t('pos.order_invoiced') },
 { key: 'cancelled', label: t('pos.order_cancelled') },
 ];

 const statusOptions = [
 { value: 'draft', label: t('pos.order_draft') },
 { value: 'paid', label: t('pos.order_paid') },
 { value: 'invoiced', label: t('pos.order_invoiced') },
 { value: 'cancelled', label: t('pos.order_cancelled') },
 ];

 const columns = [
 {
 title: t('pos.order_number'),
 dataIndex: 'order_number',
 key: 'order_number',
 render: (text: string) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--ink-900)' }}>{text}</span>,
 },
 {
 title: t('date'),
 dataIndex: 'date',
 key: 'date',
 render: (date: string) => formatDate(date),
 },
 {
 title: t('customer'),
 dataIndex: 'partner_name',
 key: 'partner_name',
 render: (name: string) => {
 const display = name || t('pos.walk_in_customer');
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(display)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{display}</span>
 </div>
 );
 },
 },
 {
 title: t('pos.cashier'),
 dataIndex: 'cashier_name',
 key: 'cashier_name',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 render: (val: number) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{formatCurrency(val)}</span>,
 },
 {
 title: t('status'),
 dataIndex: 'state',
 key: 'state',
 render: (state: string, record: any) => (
 <Space>
 <StatusTag status={ORDER_STATUS[state] ?? 'default'} label={t(`pos.order_${state}`)} />
 {record.is_refund && <StatusTag status="error" label={t('pos.refund')} />}
 {record.quotation_name && <StatusTag status="pending" label={record.quotation_name} />}
 </Space>
 ),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: any) => {
 const canConvert = record.state === 'quotation' || record.state === 'draft';
 const canRefund = record.state === 'paid' && !record.is_refund;
 return (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view'), onClick: () => viewOrderDetail(record.id) },
 { key: 'print', icon: <PrinterOutlined />, label: t('print'), onClick: handlePrint },
 ...(canConvert ? [{ key: 'convert', icon: <ShoppingCartOutlined />, label: t('pos.convert_to_order'), onClick: () => handleConvertToOrder(record) }] : []),
 ...(canRefund ? [{ key: 'refund', icon: <RollbackOutlined />, label: t('pos.refund'), danger: true, onClick: handleRefund }] : []),
 ]}
 />
 );
 },
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'order_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('posOrders.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const activeFilterCount = (stateFilter ? 1 : 0) + (showQuotationsOnly ? 1 : 0);

 return (
 <div>
 <PageHeader title={t('pos.orders')} />

 <KitListCard
 tabs={tabs}
 activeTab={showQuotationsOnly ? '' : stateFilter}
 onTabChange={(k) => { if (showQuotationsOnly) return; setStateFilter(k); setPage(1); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={activeFilterCount}
 onClear={() => { setStateFilter(''); setShowQuotationsOnly(false); setPage(1); }}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
 <span style={{ color: 'var(--ink-700)', fontSize: 13 }}>{t('pos.show_quotations_only')}</span>
 <Switch
 checked={showQuotationsOnly}
 onChange={(checked) => {
 setShowQuotationsOnly(checked);
 setStateFilter('');
 setPage(1);
 }}
 />
 </div>
 <Radio.Group
 value={stateFilter}
 onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
 disabled={showQuotationsOnly}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 <Radio value="draft">{t('pos.order_draft')}</Radio>
 <Radio value="paid">{t('pos.order_paid')}</Radio>
 <Radio value="invoiced">{t('pos.order_invoiced')}</Radio>
 <Radio value="cancelled">{t('pos.order_cancelled')}</Radio>
 </Radio.Group>
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={showQuotationsOnly ? '' : stateFilter}
 onChange={(v) => { if (showQuotationsOnly) return; setStateFilter(v); setPage(1); }}
 options={statusOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('pos-orders', filteredData, cols);
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
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 pagination={{
 current: page,
 total: search ? filteredData.length : total,
 pageSize: 25,
 onChange: setPage,
 }}
 />
 </KitListCard>

 {/* Order Detail Drawer */}
 <FormDialog
 title={selectedOrder?.order_number}
 open={detailDrawerVisible}
 onClose={() => setDetailDrawerVisible(false)}
 >
 {selectedOrder && (
 <div>
 <div style={{ marginBottom: 16 }}>
 <KeyValueGrid
 columns={2}
 items={[
 { label: t('date'), value: formatDate(selectedOrder.date) },
 { label: t('customer'), value: selectedOrder.partner_name || t('pos.walk_in_customer') },
 { label: t('pos.cashier'), value: selectedOrder.cashier_name },
 { label: t('status'), value: <StatusTag status={ORDER_STATUS[selectedOrder.state] ?? 'default'} label={t(`pos.order_${selectedOrder.state}`)} /> },
 ]}
 />
 </div>

 <Title level={5} style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-900)' }}>{t('pos.order_lines')}</Title>
 <ResponsiveTableAdapter
 dataSource={selectedOrder.lines || []}
 columns={[
 {
 title: t('item'),
 dataIndex: 'item_name',
 key: 'item_name',
 },
 {
 title: t('qty'),
 dataIndex: 'qty',
 key: 'qty',
 },
 {
 title: t('price'),
 dataIndex: 'unit_price',
 key: 'unit_price',
 render: (val: number) => formatCurrency(val),
 },
 {
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 render: (val: number) => formatCurrency(val),
 },
 ]}
 rowKey="id"
 pagination={false}
 style={{ marginBottom: 16 }}
 />

 <KeyValueGrid
 columns={1}
 items={[
 { label: t('subtotal'), value: formatCurrency(selectedOrder.subtotal || 0) },
 { label: t('tax'), value: formatCurrency(selectedOrder.tax_total || 0) },
 { label: t('discount'), value: formatCurrency(selectedOrder.discount_total || 0) },
 { label: t('total'), value: <strong>{formatCurrency(selectedOrder.total || 0)}</strong> },
 ]}
 />

 {selectedOrder.payments && selectedOrder.payments.length > 0 && (
 <>
 <Title level={5} style={{ marginTop: 16, fontFamily: 'var(--font-display)', color: 'var(--ink-900)' }}>{t('pos.payments')}</Title>
 <ResponsiveTableAdapter
 dataSource={selectedOrder.payments}
 columns={[
 {
 title: t('pos.payment_method'),
 dataIndex: 'payment_method_name',
 key: 'payment_method_name',
 },
 {
 title: t('amount'),
 dataIndex: 'amount',
 key: 'amount',
 render: (val: number) => formatCurrency(val),
 },
 ]}
 rowKey="id"
 pagination={false}
 />
 </>
 )}
 </div>
 )}
 </FormDialog>
 </div>
 );
};

export default POSOrders;
