import React, { useMemo, useState } from 'react';
import { Button, Space, Select, Typography, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { EyeOutlined, PrinterOutlined, RollbackOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import api from '../../api';
import { useListQuery } from '../../api/queries/useListQuery';
import { listQueryKeys } from '../../api/queries/keys';
import { message } from '../../utils/message';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PageHeader, StatusTag, KeyValueGrid, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../../design-system';
import type { StatusKind } from '../../design-system';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Title, Text } = Typography;

// Map POS order states → StatusTag semantic kinds (auto-flip tokens, light + dark).
const ORDER_STATUS: Record<string, StatusKind> = {
 draft: 'draft',
 quotation: 'pending',
 paid: 'paid',
 invoiced: 'sent',
 cancelled: 'cancelled',
 refunded: 'warning',
};

const POSOrders: React.FC = () => {
 const { t } = useTranslation();
 const [page, setPage] = useState(1);
 const [stateFilter, setStateFilter] = useState('');
 const [showQuotationsOnly, setShowQuotationsOnly] = useState(false);
 const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
 const [selectedOrder, setSelectedOrder] = useState<any>(null);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('posOrders.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

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

 const columns = [
 {
 title: t('pos.order_number'),
 dataIndex: 'order_number',
 key: 'order_number',
 render: (text: string) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-500)' }}>{text}</span>,
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
 render: (name: string) => name || t('pos.walk_in_customer'),
 },
 {
 title: t('pos.cashier'),
 dataIndex: 'cashier_name',
 key: 'cashier_name',
 },
 {
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 render: (val: number) => formatCurrency(val),
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
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button
 icon={<EyeOutlined />}
 onClick={() => viewOrderDetail(record.id)}
 >
 {t('view')}
 </Button>
 <Button
 icon={<PrinterOutlined />}
 onClick={handlePrint}
 >
 {t('print')}
 </Button>
 {(record.state === 'quotation' || record.state === 'draft') && (
 <Button
 icon={<ShoppingCartOutlined />}
 type="primary"
 onClick={() => handleConvertToOrder(record)}
 >
 {t('pos.convert_to_order')}
 </Button>
 )}
 {record.state === 'paid' && !record.is_refund && (
 <Button
 icon={<RollbackOutlined />}
 danger
 onClick={handleRefund}
 >
 {t('pos.refund')}
 </Button>
 )}
 </Space>
 ),
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

 return (
 <div>
 <PageHeader title={t('pos.orders')} />

 <div
 style={{
 display: 'flex',
 gap: 'var(--space-sm)',
 flexWrap: 'wrap',
 alignItems: 'center',
 marginBlockEnd: 'var(--space-lg)',
 paddingBlock: 'var(--space-sm)',
 paddingInline: 'var(--space-md)',
 background: 'var(--surface)',
 border: '1px solid var(--border)',
 borderRadius: 'var(--radius-lg)',
 boxShadow: 'var(--shadow-sm)',
 }}
 >
 <Select
 placeholder={t('status')}
 value={stateFilter || undefined}
 onChange={v => { setStateFilter(v || ''); setPage(1); }}
 allowClear
 style={{ width: 150 }}
 disabled={showQuotationsOnly}
 >
 <Select.Option value="draft">{t('pos.order_draft')}</Select.Option>
 <Select.Option value="paid">{t('pos.order_paid')}</Select.Option>
 <Select.Option value="invoiced">{t('pos.order_invoiced')}</Select.Option>
 <Select.Option value="cancelled">{t('pos.order_cancelled')}</Select.Option>
 </Select>

 {/* Sprint 6.3 - Quotations filter */}
 <Space>
 <Text style={{ color: 'var(--ink-700)' }}>{t('pos.show_quotations_only')}</Text>
 <Switch
 checked={showQuotationsOnly}
 onChange={(checked) => {
 setShowQuotationsOnly(checked);
 setStateFilter('');
 setPage(1);
 }}
 />
 </Space>
 <div style={{ flex: 1, minWidth: 0 }} />
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('pos-orders', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </div>

 <ResponsiveTableAdapter
 dataSource={data}
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 pagination={{
 current: page,
 total,
 pageSize: 25,
 onChange: setPage,
 }}
 />

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
