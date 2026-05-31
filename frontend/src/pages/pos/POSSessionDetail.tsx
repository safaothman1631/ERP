import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
 Card, Descriptions, Button, Tabs, Space, Form, InputNumber,
 Input, Statistic, Row, Col, Tag, Typography
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
 ArrowLeftOutlined, CloseCircleOutlined,
 PlusOutlined, MinusOutlined, PrinterOutlined
} from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { FormDialog } from '../../components/responsive/FormDialog';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';
import { useLoadingState } from '../../hooks/useLoadingState';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Title, Text } = Typography;

const POSSessionDetail: React.FC = () => {
 const { sessionId } = useParams<{ sessionId: string }>();
 const { t } = useTranslation();
 const navigate = useNavigate();

 const [session, setSession] = useState<any>(null);
 const [summary, setSummary] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const { showSkeleton } = useLoadingState(loading);
 const [orders, setOrders] = useState<any[]>([]);
 const [payments, setPayments] = useState<any[]>([]);
 
 const [closeModalVisible, setCloseModalVisible] = useState(false);
 const [cashInModalVisible, setCashInModalVisible] = useState(false);
 const [cashOutModalVisible, setCashOutModalVisible] = useState(false);
 const [closeForm] = Form.useForm();
 const [cashInForm] = Form.useForm();
 const [cashOutForm] = Form.useForm();
 const [closing, setClosing] = useState(false);

 useEffect(() => {
 if (sessionId) {
 loadSession();
 loadSummary();
 loadOrders();
 loadPayments();
 }
 }, [sessionId]);

 const loadSession = async () => {
 try {
 const res = await api.get(`/api/pos/sessions/${sessionId}`);
 setSession(res.data);
 } catch {
 message.error(t('error'));
 navigate('/pos/sessions');
 } finally {
 setLoading(false);
 }
 };

 const loadSummary = async () => {
 try {
 const res = await api.get(`/api/pos/sessions/${sessionId}/summary`);
 setSummary(res.data);
 } catch { /* noop */ }
 };

 const loadOrders = async () => {
 try {
 const res = await api.get(`/api/pos/sessions/${sessionId}/orders`, {
 params: { page_size: 1000 }
 });
 setOrders(res.data.items || []);
 } catch { /* noop */ }
 };

 const loadPayments = async () => {
 try {
 const res = await api.get(`/api/pos/sessions/${sessionId}/payments`, {
 params: { page_size: 1000 }
 });
 setPayments(res.data.items || []);
 } catch { /* noop */ }
 };

 const handleCloseSession = async (values: any) => {
 setClosing(true);
 try {
 await api.post(`/api/pos/sessions/${sessionId}/close`, {
 closing_cash_counted: values.closing_cash_counted,
 notes: values.notes,
 });
 message.success(t('pos.session_closed'));
 setCloseModalVisible(false);
 loadSession();
 } catch {
 message.error(t('error'));
 } finally {
 setClosing(false);
 }
 };

 const handleCashIn = async (values: any) => {
 try {
 await api.post(`/api/pos/sessions/${sessionId}/cash-in`, values);
 message.success(t('pos.cash_in_added'));
 setCashInModalVisible(false);
 cashInForm.resetFields();
 loadSummary();
 } catch {
 message.error(t('error'));
 }
 };

 const handleCashOut = async (values: any) => {
 try {
 await api.post(`/api/pos/sessions/${sessionId}/cash-out`, values);
 message.success(t('pos.cash_out_added'));
 setCashOutModalVisible(false);
 cashOutForm.resetFields();
 loadSummary();
 } catch {
 message.error(t('error'));
 }
 };

 if (showSkeleton) {
 return (
 <div style={{ textAlign: 'center', padding: 100 }}>
 <LoadingSkeleton variant="card" />
 </div>
 );
 }

 if (!session) return null;

 const orderColumns = [
 {
 title: t('pos.order_number'),
 dataIndex: 'order_number',
 key: 'order_number',
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
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 render: (val: number) => formatCurrency(val),
 },
 {
 title: t('status'),
 dataIndex: 'state',
 key: 'state',
 render: (state: string) => (
 <Tag color={state === 'paid' ? 'green' : 'default'}>
 {t(`pos.order_${state}`)}
 </Tag>
 ),
 },
 ];

 const paymentColumns = [
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
 {
 title: t('date'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (date: string) => formatDate(date),
 },
 ];

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
 <Space>
 <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pos/sessions')}>
 {t('back')}
 </Button>
 <Title level={2} style={{ margin: 0 }}>
 {session.config_name}
 </Title>
 <Tag color={session.state === 'opened' ? 'green' : 'default'}>
 {t(`pos.state_${session.state}`)}
 </Tag>
 </Space>
 <Space>
 {session.state === 'opened' && (
 <>
 <Button
 icon={<PlusOutlined />}
 onClick={() => setCashInModalVisible(true)}
 >
 {t('pos.cash_in')}
 </Button>
 <Button
 icon={<MinusOutlined />}
 onClick={() => setCashOutModalVisible(true)}
 >
 {t('pos.cash_out')}
 </Button>
 <Button
 type="primary"
 danger
 icon={<CloseCircleOutlined />}
 onClick={() => setCloseModalVisible(true)}
 >
 {t('pos.close_session')}
 </Button>
 </>
 )}
 {session.state === 'closed' && (
 <Button icon={<PrinterOutlined />}>
 {t('pos.print_z_report')}
 </Button>
 )}
 </Space>
 </div>

 {/* Summary Cards */}
 <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
 <Col xs={24} sm={12} md={6}>
 <Card>
 <Statistic
 title={t('pos.opening_cash')}
 value={session.opening_cash || 0}
 formatter={value => formatCurrency(Number(value))}
 />
 </Card>
 </Col>
 <Col xs={24} sm={12} md={6}>
 <Card>
 <Statistic
 title={t('pos.total_sales')}
 value={session.total_sales || 0}
 formatter={value => formatCurrency(Number(value))}
 />
 </Card>
 </Col>
 <Col xs={24} sm={12} md={6}>
 <Card>
 <Statistic
 title={t('pos.total_orders')}
 value={session.total_orders || 0}
 />
 </Card>
 </Col>
 <Col xs={24} sm={12} md={6}>
 <Card>
 <Statistic
 title={session.state === 'closed' ? t('pos.cash_difference') : t('pos.expected_cash')}
 value={session.state === 'closed' ? session.closing_difference : session.closing_cash_expected}
 formatter={value => formatCurrency(Number(value))}
 styles={{ content: { color: session.closing_difference > 0 ? '#3f8600' : session.closing_difference < 0 ? '#cf1322' : undefined } }}
 />
 </Card>
 </Col>
 </Row>

 {/* Details */}
 <Card style={{ marginBottom: 16 }}>
 <Descriptions bordered column={2}>
 <Descriptions.Item label={t('pos.cashier')}>
 {session.cashier_name}
 </Descriptions.Item>
 <Descriptions.Item label={t('pos.opened_at')}>
 {formatDate(session.opened_at)}
 </Descriptions.Item>
 {session.closed_at && (
 <Descriptions.Item label={t('pos.closed_at')}>
 {formatDate(session.closed_at)}
 </Descriptions.Item>
 )}
 {session.state === 'closed' && (
 <>
 <Descriptions.Item label={t('pos.closing_cash_counted')}>
 {formatCurrency(session.closing_cash_counted)}
 </Descriptions.Item>
 <Descriptions.Item label={t('pos.closing_cash_expected')}>
 {formatCurrency(session.closing_cash_expected)}
 </Descriptions.Item>
 </>
 )}
 </Descriptions>
 </Card>

 {/* Tabs */}
 <Tabs
 items={[
 {
 key: 'orders',
 label: `${t('pos.orders')} (${orders.length})`,
 children: (
 <ResponsiveTableAdapter
 dataSource={orders}
 columns={orderColumns}
 rowKey="id"
 pagination={false}
 />
 ),
 },
 {
 key: 'payments',
 label: `${t('pos.payments')} (${payments.length})`,
 children: (
 <ResponsiveTableAdapter
 dataSource={payments}
 columns={paymentColumns}
 rowKey="id"
 pagination={false}
 />
 ),
 },
 {
 key: 'summary',
 label: t('pos.summary'),
 children: summary ? (
 <Card>
 <Title level={4}>{t('pos.payment_methods_breakdown')}</Title>
 {Object.entries(summary.payment_summary || {}).map(([method, amount]: any) => (
 <div key={method} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
 <Text>{method}</Text>
 <Text strong>{formatCurrency(amount)}</Text>
 </div>
 ))}
 <Descriptions bordered column={1} style={{ marginTop: 16 }}>
 <Descriptions.Item label={t('pos.total_tax')}>
 {formatCurrency(summary.total_tax || 0)}
 </Descriptions.Item>
 <Descriptions.Item label={t('pos.total_discount')}>
 {formatCurrency(summary.total_discount || 0)}
 </Descriptions.Item>
 </Descriptions>
 </Card>
 ) : null,
 },
 ]}
 />

 {/* Close Session Modal */}
 <FormDialog
 title={t('pos.close_session')}
 open={closeModalVisible}
 onClose={() => setCloseModalVisible(false)} hideFooter
 >
 <Form form={closeForm} layout="vertical" onFinish={handleCloseSession}>
 <Form.Item
 name="closing_cash_counted"
 label={t('pos.closing_cash_counted')}
 rules={[{ required: true }]}
 >
 <InputNumber
 style={{ width: '100%' }}
 formatter={value => formatCurrency(Number(value || 0))}
 min={0}
 />
 </Form.Item>
 <Form.Item name="notes" label={t('notes')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item>
 <Button type="primary" htmlType="submit" block loading={closing}>
 {t('pos.close_session')}
 </Button>
 </Form.Item>
 </Form>
 </FormDialog>

 {/* Cash In Modal */}
 <FormDialog
 title={t('pos.cash_in')}
 open={cashInModalVisible}
 onClose={() => setCashInModalVisible(false)} hideFooter
 >
 <Form form={cashInForm} layout="vertical" onFinish={handleCashIn}>
 <Form.Item name="amount" label={t('amount')} rules={[{ required: true }]}>
 <InputNumber
 style={{ width: '100%' }}
 formatter={value => formatCurrency(Number(value || 0))}
 min={0}
 />
 </Form.Item>
 <Form.Item name="reason" label={t('reason')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item>
 <Button type="primary" htmlType="submit" block>
 {t('add')}
 </Button>
 </Form.Item>
 </Form>
 </FormDialog>

 {/* Cash Out Modal */}
 <FormDialog
 title={t('pos.cash_out')}
 open={cashOutModalVisible}
 onClose={() => setCashOutModalVisible(false)} hideFooter
 >
 <Form form={cashOutForm} layout="vertical" onFinish={handleCashOut}>
 <Form.Item name="amount" label={t('amount')} rules={[{ required: true }]}>
 <InputNumber
 style={{ width: '100%' }}
 formatter={value => formatCurrency(Number(value || 0))}
 min={0}
 />
 </Form.Item>
 <Form.Item name="reason" label={t('reason')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item>
 <Button type="primary" htmlType="submit" block>
 {t('add')}
 </Button>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default POSSessionDetail;
