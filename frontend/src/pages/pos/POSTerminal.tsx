import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
 Layout, Card, Button, Input, Row, Col, Space, Typography, Tag, Form,
 InputNumber, Tabs, Divider, Badge, Empty, Select
} from 'antd';
import {
 ShoppingCartOutlined, DeleteOutlined, MinusOutlined, PlusOutlined,
 DollarOutlined, PrinterOutlined, UserOutlined, BarcodeOutlined,
 CloseOutlined, CheckOutlined, CreditCardOutlined, WifiOutlined,
 SyncOutlined, SaveOutlined, FileTextOutlined, TruckOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { formatCurrency } from '../../utils/formatters';
import { useBarcodeScanner } from '../../components/pos/BarcodeScanner';
import POSCustomerSelector from '../../components/pos/POSCustomerSelector';
import POSQuotationDialog from '../../components/pos/POSQuotationDialog';
import POSShipLaterDialog from '../../components/pos/POSShipLaterDialog';
import { FormDialog } from '../../components/responsive/FormDialog';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';
import { useLoadingState } from '../../hooks/useLoadingState';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;

interface CartLine {
 item_id: string;
 item_name: string;
 sku: string;
 qty: number;
 unit_price: number;
 discount_percent: number;
 tax_rate: number;
 total: number;
}

const POSTerminal: React.FC = () => {
 const { sessionId } = useParams<{ sessionId: string }>();
 const { t } = useTranslation();
 const navigate = useNavigate();

 const [session, setSession] = useState<any>(null);
 const [config, setConfig] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const { showSkeleton } = useLoadingState(loading);
 const [items, setItems] = useState<any[]>([]);
 const [categories, setCategories] = useState<any[]>([]);
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [searchQuery, setSearchQuery] = useState('');
 
 // Cart state
 const [cart, setCart] = useState<CartLine[]>([]);
 const [customer, setCustomer] = useState<any>(null);
 const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
 
 // Payment modal
 const [paymentModalVisible, setPaymentModalVisible] = useState(false);
 const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
 const [selectedPayments, setSelectedPayments] = useState<any[]>([]);
 const [paymentForm] = Form.useForm();
 
 // Sprint 6.3 - New modals
 const [customerSelectorVisible, setCustomerSelectorVisible] = useState(false);
 const [quotationDialogVisible, setQuotationDialogVisible] = useState(false);
 const [shipLaterDialogVisible, setShipLaterDialogVisible] = useState(false);
 
 // Offline sync
 const [isOnline, setIsOnline] = useState(navigator.onLine);
 const [syncQueue, setSyncQueue] = useState<any[]>([]);

 // Sprint 6.3 - Barcode scanner integration
 const handleBarcodeScan = async (code: string) => {
 try {
 const res = await api.get('/api/pos/products/lookup', { params: { barcode: code } });
 const products = res.data.items || [];
 
 if (products.length === 1) {
 // Exact match - add to cart automatically
 const item = products[0];
 addToCart({
 id: item.id,
 name: item.name,
 name_ku: item.name_ku,
 sku: item.sku,
 selling_price: item.price,
 });
 message.success(t('pos.item_added'));
 } else if (products.length > 1) {
 // Multiple matches - show picker (simplified: add first one)
 addToCart({
 id: products[0].id,
 name: products[0].name,
 selling_price: products[0].price,
 });
 message.info(t('pos.multiple_matches'));
 } else {
 message.warning(t('pos.product_not_found'));
 }
 } catch (error) {
 message.error(t('error'));
 }
 };

 const { isScanning } = useBarcodeScanner(handleBarcodeScan, true);

 useEffect(() => {
 if (sessionId) {
 loadSession();
 loadItems();
 loadPaymentMethods();
 }

 // Monitor online/offline status
 window.addEventListener('online', () => setIsOnline(true));
 window.addEventListener('offline', () => setIsOnline(false));

 return () => {
 window.removeEventListener('online', () => setIsOnline(true));
 window.removeEventListener('offline', () => setIsOnline(false));
 };
 }, [sessionId]);

 const loadSession = async () => {
 try {
 const res = await api.get(`/api/pos/sessions/${sessionId}`);
 setSession(res.data);
 
 if (res.data.config_id) {
 const configRes = await api.get(`/api/pos/configs/${res.data.config_id}`);
 setConfig(configRes.data);
 }
 } catch {
 message.error(t('error'));
 navigate('/pos');
 } finally {
 setLoading(false);
 }
 };

 const loadItems = async () => {
 try {
 const res = await api.get('/api/items', { params: { page_size: 1000 } });
 setItems(res.data.items || []);
 } catch {
 // Offline mode - load from cache
 }
 };

 const loadPaymentMethods = async () => {
 try {
 const res = await api.get('/api/pos/payment-methods', { params: { is_active: true, page_size: 100 } });
 setPaymentMethods(res.data.items || []);
 } catch {}
 };

 // Sprint 6.3 - Enhanced search with lookup endpoint
 const handleSearch = async (value: string) => {
 setSearchQuery(value);
 
 if (value && value.length > 2) {
 try {
 const res = await api.get('/api/pos/products/lookup', { params: { q: value } });
 const products = res.data.items || [];
 
 if (products.length > 0) {
 // Merge with existing items (avoid duplicates)
 const existingIds = new Set(items.map((i: any) => i.id));
 const newItems = products.filter((p: any) => !existingIds.has(p.id));
 
 if (newItems.length > 0) {
 setItems([...items, ...newItems.map((p: any) => ({
 id: p.id,
 name: p.name,
 name_ku: p.name_ku,
 sku: p.sku,
 selling_price: p.price,
 barcode: p.barcode,
 category_id: p.category_id,
 }))]);
 }
 }
 } catch (error) {
 // Fallback to local filtering
 }
 }
 };

 const addToCart = (item: any) => {
 const existingLine = cart.find(l => l.item_id === item.id);
 if (existingLine) {
 updateCartLine(existingLine.item_id, { qty: existingLine.qty + 1 });
 } else {
 const newLine: CartLine = {
 item_id: item.id,
 item_name: item.name || '',
 sku: item.sku || '',
 qty: 1,
 unit_price: item.selling_price || 0,
 discount_percent: 0,
 tax_rate: 0, // Can be enhanced to fetch from item.tax_id
 total: item.selling_price || 0,
 };
 setCart([...cart, newLine]);
 }
 };

 const updateCartLine = (itemId: string, updates: Partial<CartLine>) => {
 setCart(cart.map(line => {
 if (line.item_id === itemId) {
 const updated = { ...line, ...updates };
 // Recalculate total
 const subtotal = updated.qty * updated.unit_price;
 const discount = subtotal * (updated.discount_percent / 100);
 const afterDiscount = subtotal - discount;
 const tax = afterDiscount * (updated.tax_rate / 100);
 updated.total = afterDiscount + tax;
 return updated;
 }
 return line;
 }));
 };

 const removeCartLine = (itemId: string) => {
 setCart(cart.filter(l => l.item_id !== itemId));
 };

 const clearCart = () => {
 setCart([]);
 setCustomer(null);
 setCurrentOrderId(null);
 };

 const calculateTotals = () => {
 const subtotal = cart.reduce((sum, line) => {
 const lineSubtotal = line.qty * line.unit_price;
 const discount = lineSubtotal * (line.discount_percent / 100);
 return sum + (lineSubtotal - discount);
 }, 0);
 
 const tax = cart.reduce((sum, line) => {
 const lineSubtotal = line.qty * line.unit_price;
 const discount = lineSubtotal * (line.discount_percent / 100);
 const afterDiscount = lineSubtotal - discount;
 return sum + (afterDiscount * (line.tax_rate / 100));
 }, 0);
 
 return { subtotal, tax, total: subtotal + tax };
 };

 const saveDraft = async () => {
 if (cart.length === 0) {
 message.warning(t('pos.cart_empty'));
 return;
 }

 try {
 const lines = cart.map(line => ({
 item_id: line.item_id,
 qty: line.qty,
 unit_price: line.unit_price,
 discount_percent: line.discount_percent,
 tax_rate: line.tax_rate,
 }));

 if (currentOrderId) {
 await api.put(`/api/pos/orders/${currentOrderId}`, {
 partner_id: customer?.id,
 lines,
 });
 message.success(t('pos.order_updated'));
 } else {
 const res = await api.post('/api/pos/orders', {
 session_id: sessionId,
 partner_id: customer?.id,
 lines,
 });
 setCurrentOrderId(res.data.id);
 message.success(t('pos.order_saved'));
 }
 } catch {
 message.error(t('error'));
 }
 };

 const openPayment = () => {
 if (cart.length === 0) {
 message.warning(t('pos.cart_empty'));
 return;
 }
 setPaymentModalVisible(true);
 setSelectedPayments([]);
 paymentForm.resetFields();
 };

 const handlePayment = async () => {
 const totals = calculateTotals();
 const paymentSum = selectedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

 if (paymentSum < totals.total) {
 message.warning(t('pos.insufficient_payment'));
 return;
 }

 try {
 // Create or update order
 let orderId = currentOrderId;
 if (!orderId) {
 const lines = cart.map(line => ({
 item_id: line.item_id,
 qty: line.qty,
 unit_price: line.unit_price,
 discount_percent: line.discount_percent,
 tax_rate: line.tax_rate,
 }));

 const orderRes = await api.post('/api/pos/orders', {
 session_id: sessionId,
 partner_id: customer?.id,
 lines,
 });
 orderId = orderRes.data.id;
 }

 // Pay order
 const payments = selectedPayments.map(p => ({
 payment_method_id: p.method_id,
 amount: p.amount,
 tendered: p.tendered,
 reference: p.reference,
 }));

 await api.post(`/api/pos/orders/${orderId}/pay`, { payments });
 
 const change = paymentSum - totals.total;
 if (change > 0) {
 message.success(`${t('pos.payment_success')} - ${t('pos.change')}: ${formatCurrency(change)}`);
 } else {
 message.success(t('pos.payment_success'));
 }

 clearCart();
 setPaymentModalVisible(false);
 } catch {
 message.error(t('error'));
 }
 };

 const addPaymentMethod = (methodId: string) => {
 const method = paymentMethods.find(m => m.id === methodId);
 if (!method) return;

 const totals = calculateTotals();
 const alreadyPaid = selectedPayments.reduce((sum, p) => sum + p.amount, 0);
 const remaining = totals.total - alreadyPaid;

 setSelectedPayments([
 ...selectedPayments,
 {
 method_id: methodId,
 method_name: method.name,
 amount: remaining > 0 ? remaining : 0,
 tendered: remaining > 0 ? remaining : 0,
 }
 ]);
 };

 const filteredItems = items.filter(item => {
 if (searchQuery && !item.name?.toLowerCase().includes(searchQuery.toLowerCase()) && !item.sku?.toLowerCase().includes(searchQuery.toLowerCase())) {
 return false;
 }
 if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
 return false;
 }
 return true;
 });

 const totals = calculateTotals();

 if (showSkeleton) {
 return (
 <div style={{ textAlign: 'center', padding: 100 }}>
 <LoadingSkeleton variant="card" />
 </div>
 );
 }

 return (
 <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
 {/* Header */}
 <div style={{ 
 background: '#fff', 
 padding: '12px 24px', 
 borderBottom: '1px solid #f0f0f0',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center'
 }}>
 <Space>
 <Title level={4} style={{ margin: 0 }}>
 {config?.name_ku || config?.name}
 </Title>
 <Tag color="blue">{session?.cashier_name}</Tag>
 </Space>
 <Space>
 <Badge dot={!isOnline} status={isOnline ? 'success' : 'error'}>
 <Button icon={<WifiOutlined />} type={isOnline ? 'default' : 'dashed'}>
 {isOnline ? t('online') : t('offline')}
 </Button>
 </Badge>
 {syncQueue.length > 0 && (
 <Badge count={syncQueue.length}>
 <Button icon={<SyncOutlined />}>{t('pos.sync')}</Button>
 </Badge>
 )}
 <Button onClick={() => navigate('/pos')} icon={<CloseOutlined />} danger>
 {t('close')}
 </Button>
 </Space>
 </div>

 <Layout>
 {/* Left: Cart */}
 <Sider width="40%" theme="light" style={{ borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
 <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
 {/* Customer */}
 <Card style={{ marginBottom: 16 }}>
 <Space style={{ width: '100%', justifyContent: 'space-between' }}>
 <Space>
 <UserOutlined />
 <Text>{customer ? customer.display_name || customer.company_name : t('pos.walk_in_customer')}</Text>
 </Space>
 <Button onClick={() => setCustomerSelectorVisible(true)}>
 {customer ? t('change') : t('select')}
 </Button>
 </Space>
 </Card>

 {/* Cart Lines */}
 <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
 {cart.length === 0 ? (
 <Empty description={t('pos.cart_empty')} />
 ) : (
 <Space orientation="vertical" style={{ width: '100%' }}>
 {cart.map((line, idx) => (
 <Card key={idx} style={{ marginBottom: 8 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
 <div style={{ flex: 1 }}>
 <Text strong>{line.item_name}</Text>
 <br />
 <Text type="secondary" style={{ fontSize: 12 }}>{line.sku}</Text>
 </div>
 <Button
 danger
 type="text"
 icon={<DeleteOutlined />}
 onClick={() => removeCartLine(line.item_id)}
 />
 </div>
 <Divider style={{ margin: '8px 0' }} />
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <Space>
 <Button
 icon={<MinusOutlined />}
 onClick={() => updateCartLine(line.item_id, { qty: Math.max(1, line.qty - 1) })}
 />
 <InputNumber
 value={line.qty}
 min={1}
 style={{ width: 60 }}
 onChange={qty => updateCartLine(line.item_id, { qty: qty || 1 })}
 />
 <Button
 icon={<PlusOutlined />}
 onClick={() => updateCartLine(line.item_id, { qty: line.qty + 1 })}
 />
 </Space>
 <Text strong>{formatCurrency(line.total)}</Text>
 </div>
 <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
 <InputNumber
 placeholder={t('pos.discount')}
 value={line.discount_percent}
 min={0}
 max={100}
 formatter={value => `${value}%`}
 style={{ width: 80 }}
 onChange={value => updateCartLine(line.item_id, { discount_percent: value || 0 })}
 />
 <Text type="secondary">@ {formatCurrency(line.unit_price)}</Text>
 </div>
 </Card>
 ))}
 </Space>
 )}
 </div>

 {/* Totals */}
 <Card style={{ marginBottom: 16 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
 <Text>{t('subtotal')}</Text>
 <Text>{formatCurrency(totals.subtotal)}</Text>
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
 <Text>{t('tax')}</Text>
 <Text>{formatCurrency(totals.tax)}</Text>
 </div>
 <Divider style={{ margin: '8px 0' }} />
 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <Title level={4} style={{ margin: 0 }}>{t('total')}</Title>
 <Title level={4} style={{ margin: 0 }}>{formatCurrency(totals.total)}</Title>
 </div>
 </Card>

 {/* Actions */}
 <Space orientation="vertical" style={{ width: '100%' }}>
 <Button
 type="primary"
 block
 icon={<DollarOutlined />}
 onClick={openPayment}
 disabled={cart.length === 0}
 >
 {t('pos.payment')}
 </Button>
 <Row gutter={8}>
 <Col span={12}>
 <Button block icon={<SaveOutlined />} onClick={saveDraft}>
 {t('pos.save_draft')}
 </Button>
 </Col>
 <Col span={12}>
 <Button 
 block 
 icon={<FileTextOutlined />}
 onClick={() => setQuotationDialogVisible(true)}
 disabled={!currentOrderId}
 >
 {t('pos.quotation')}
 </Button>
 </Col>
 </Row>
 <Row gutter={8}>
 <Col span={12}>
 <Button 
 block 
 icon={<TruckOutlined />}
 onClick={() => setShipLaterDialogVisible(true)}
 disabled={!currentOrderId}
 >
 {t('pos.ship_later')}
 </Button>
 </Col>
 <Col span={12}>
 <Button block danger onClick={clearCart}>
 {t('pos.clear_cart')}
 </Button>
 </Col>
 </Row>
 </Space>
 </div>
 </Sider>

 {/* Right: Products */}
 <Content style={{ padding: 16, overflow: 'auto' }}>
 {/* Search */}
 <Search
 placeholder={t('pos.search_products')}
 prefix={<BarcodeOutlined />}
 style={{ marginBottom: 16 }}
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 onSearch={handleSearch}
 allowClear
 />

 {/* Barcode scanner indicator */}
 {isScanning && (
 <Tag icon={<BarcodeOutlined />} color="processing" style={{ marginBottom: 16 }}>
 {t('pos.scanning')}
 </Tag>
 )}

 {/* Category Tabs (simplified) */}
 <div style={{ marginBottom: 16 }}>
 <Space wrap>
 <Button
 type={selectedCategory === 'all' ? 'primary' : 'default'}
 onClick={() => setSelectedCategory('all')}
 >
 {t('all')}
 </Button>
 {/* Add category buttons here if needed */}
 </Space>
 </div>

 {/* Product Grid */}
 <Row gutter={[12, 12]}>
 {filteredItems.map(item => (
 <Col key={item.id} xs={12} sm={8} md={6} lg={4}>
 <Card
 hoverable
 onClick={() => addToCart(item)}
 style={{ height: '100%', cursor: 'pointer' }}
 bodyStyle={{ padding: 12 }}
 >
 <Space orientation="vertical" style={{ width: '100%', textAlign: 'center' }}>
 <Text strong ellipsis style={{ display: 'block' }}>
 {item.name}
 </Text>
 <Text type="secondary" style={{ fontSize: 12 }}>
 {item.sku}
 </Text>
 <Tag color="blue">{formatCurrency(item.selling_price || 0)}</Tag>
 </Space>
 </Card>
 </Col>
 ))}
 </Row>
 </Content>
 </Layout>

 {/* Payment Modal */}
 <FormDialog
 title={t('pos.payment')}
 open={paymentModalVisible}
 onClose={() => setPaymentModalVisible(false)} hideFooter
 >
 <Form form={paymentForm} layout="vertical">
 <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
 <Title level={3} style={{ margin: 0 }}>{formatCurrency(totals.total)}</Title>
 <Text type="secondary">{t('pos.amount_to_pay')}</Text>
 </div>

 <Space orientation="vertical" style={{ width: '100%' }}>
 <div>
 <Text strong>{t('pos.select_payment_method')}</Text>
 <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
 {paymentMethods.map(method => (
 <Col key={method.id} span={12}>
 <Button
 block
 icon={method.type === 'cash' ? <DollarOutlined /> : <CreditCardOutlined />}
 onClick={() => addPaymentMethod(method.id)}
 >
 {method.name_ku || method.name}
 </Button>
 </Col>
 ))}
 </Row>
 </div>

 {selectedPayments.length > 0 && (
 <div>
 <Text strong>{t('pos.payments')}</Text>
 <Space orientation="vertical" style={{ width: '100%', marginTop: 8 }}>
 {selectedPayments.map((payment, idx) => (
 <Card key={idx}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <Text>{payment.method_name}</Text>
 <InputNumber
 value={payment.amount}
 min={0}
 formatter={value => formatCurrency(Number(value || 0))}
 style={{ width: 150 }}
 onChange={value => {
 const updated = [...selectedPayments];
 updated[idx].amount = value || 0;
 setSelectedPayments(updated);
 }}
 />
 </div>
 </Card>
 ))}
 </Space>
 </div>
 )}

 <Button
 type="primary"
 block
 icon={<CheckOutlined />}
 onClick={handlePayment}
 disabled={selectedPayments.reduce((sum, p) => sum + p.amount, 0) < totals.total}
 >
 {t('pos.validate_payment')}
 </Button>
 </Space>
 </Form>
 </FormDialog>

 {/* Sprint 6.3 - Customer Selector Modal */}
 <POSCustomerSelector
 visible={customerSelectorVisible}
 onClose={() => setCustomerSelectorVisible(false)}
 onSelect={(selectedCustomer) => {
 setCustomer(selectedCustomer);
 message.success(t('pos.customer_selected'));
 }}
 />

 {/* Sprint 6.3 - Quotation Dialog */}
 <POSQuotationDialog
 visible={quotationDialogVisible}
 orderId={currentOrderId}
 onClose={() => setQuotationDialogVisible(false)}
 onSuccess={() => {
 clearCart();
 loadSession();
 }}
 />

 {/* Sprint 6.3 - Ship Later Dialog */}
 <POSShipLaterDialog
 visible={shipLaterDialogVisible}
 orderId={currentOrderId}
 customerAddress={customer?.addresses?.[0]}
 onClose={() => setShipLaterDialogVisible(false)}
 onSuccess={(soId, soNumber) => {
 message.success(`${t('pos.sales_order_created')}: ${soNumber}`);
 clearCart();
 loadSession();
 }}
 />
 </Layout>
 );
};

export default POSTerminal;
