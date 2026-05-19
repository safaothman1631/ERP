import React, { useEffect, useMemo, useState } from 'react';
import { Button, Tag, Space, Descriptions, Select, Typography, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { EyeOutlined, PrinterOutlined, RollbackOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../../design-system';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
 draft: 'default',
 quotation: 'gold',
 paid: 'green',
 invoiced: 'blue',
 cancelled: 'red',
 refunded: 'orange',
};

const POSOrders: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [stateFilter, setStateFilter] = useState('');
 const [showQuotationsOnly, setShowQuotationsOnly] = useState(false);
 const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
 const [selectedOrder, setSelectedOrder] = useState<any>(null);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('posOrders.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchData = async () => {
 setLoading(true);
 try {
 const params: any = { page, page_size: 25 };
 
 // Sprint 6.3 - Enhanced quotation filtering
 if (showQuotationsOnly) {
 const res = await api.get('/api/pos/orders/quotations', { params });
 setData(res.data.items || []);
 setTotal(res.data.total || 0);
 } else {
 if (stateFilter) params.state = stateFilter;
 const res = await api.get('/api/pos/orders', { params });
 setData(res.data.items || []);
 setTotal(res.data.total || 0);
 }
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, [page, stateFilter, showQuotationsOnly]);

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
 render: (text: string) => <Text strong style={{ color: '#1677ff' }}>{text}</Text>,
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
 <Tag color={statusColors[state]}>{t(`pos.order_${state}`)}</Tag>
 {record.is_refund && <Tag color="red">{t('pos.refund')}</Tag>}
 {record.quotation_name && <Tag color="gold">{record.quotation_name}</Tag>}
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
 try { localStorage.setItem('posOrders.hiddenCols', JSON.stringify(next)); } catch {}
 };

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
 <Title level={2}>{t('pos.orders')}</Title>
 </div>

 <div style={{ marginBottom: 16 }}>
 <Space>
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
 <Text>{t('pos.show_quotations_only')}</Text>
 <Switch 
 checked={showQuotationsOnly} 
 onChange={(checked) => {
 setShowQuotationsOnly(checked);
 setStateFilter('');
 setPage(1);
 }}
 />
 </Space>
 </Space>
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
 <Descriptions bordered column={1} style={{ marginBottom: 16 }}>
 <Descriptions.Item label={t('date')}>
 {formatDate(selectedOrder.date)}
 </Descriptions.Item>
 <Descriptions.Item label={t('customer')}>
 {selectedOrder.partner_name || t('pos.walk_in_customer')}
 </Descriptions.Item>
 <Descriptions.Item label={t('pos.cashier')}>
 {selectedOrder.cashier_name}
 </Descriptions.Item>
 <Descriptions.Item label={t('status')}>
 <Tag color={statusColors[selectedOrder.state]}>
 {t(`pos.order_${selectedOrder.state}`)}
 </Tag>
 </Descriptions.Item>
 </Descriptions>

 <Title level={5}>{t('pos.order_lines')}</Title>
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

 <Descriptions bordered column={1}>
 <Descriptions.Item label={t('subtotal')}>
 {formatCurrency(selectedOrder.subtotal || 0)}
 </Descriptions.Item>
 <Descriptions.Item label={t('tax')}>
 {formatCurrency(selectedOrder.tax_total || 0)}
 </Descriptions.Item>
 <Descriptions.Item label={t('discount')}>
 {formatCurrency(selectedOrder.discount_total || 0)}
 </Descriptions.Item>
 <Descriptions.Item label={<strong>{t('total')}</strong>}>
 <strong>{formatCurrency(selectedOrder.total || 0)}</strong>
 </Descriptions.Item>
 </Descriptions>

 {selectedOrder.payments && selectedOrder.payments.length > 0 && (
 <>
 <Title level={5} style={{ marginTop: 16 }}>{t('pos.payments')}</Title>
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
