import React, { useState, useEffect } from 'react';
import { Button, Select, InputNumber, message, Space, Tag, Descriptions } from 'antd';
import { CheckOutlined, DollarOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../design-system';
import api from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Option } = Select;

interface VendorReturn {
 id: string;
 return_number: string;
 contact_id: string;
 bill_id: string;
 date: string;
 status: string;
 total: number;
 currency: string;
 refund_status?: string;
 reason?: string;
}

interface RefundRecord {
 id: string;
 method: string;
 amount: number;
 status: string;
 created_at: string;
 credit_note_id?: string;
 payment_id?: string;
}

const VendorReturns: React.FC = () => {
 const { t } = useTranslation();
 const [loading, setLoading] = useState(false);
 const [returns, setReturns] = useState<VendorReturn[]>([]);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(20);
 const [refundDrawerVisible, setRefundDrawerVisible] = useState(false);
 const [selectedReturn, setSelectedReturn] = useState<VendorReturn | null>(null);
 const [refundMethod, setRefundMethod] = useState<string>('credit_note');
 const [refundAmount, setRefundAmount] = useState<number>(0);
 const [refunds, setRefunds] = useState<RefundRecord[]>([]);

 useEffect(() => {
 fetchReturns();
 }, [page, pageSize]);

 const fetchReturns = async () => {
 setLoading(true);
 try {
 const response = await api.get('/returns/vendor', {
 params: { page, page_size: pageSize }
 });
 setReturns(response.data.items || []);
 setTotal(response.data.total || 0);
 } catch (error) {
 message.error(t('errors.fetch_failed'));
 } finally {
 setLoading(false);
 }
 };

 const handleApprove = async (returnId: string) => {
 try {
 await api.post(`/returns/vendor/${returnId}/approve`, {});
 message.success(t('returns.approved'));
 fetchReturns();
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('errors.operation_failed'));
 }
 };

 const openRefundDrawer = async (record: VendorReturn) => {
 setSelectedReturn(record);
 setRefundAmount(record.total);
 setRefundMethod('credit_note');
 setRefundDrawerVisible(true);
 
 // Fetch existing refunds
 try {
 const response = await api.get(`/returns/vendor/${record.id}/refunds`);
 setRefunds(response.data.items || []);
 } catch (error) {
 setRefunds([]);
 }
 };

 const handleCreateRefund = async () => {
 if (!selectedReturn) return;
 
 try {
 await api.post(`/returns/vendor/${selectedReturn.id}/refund`, {
 method: refundMethod,
 amount: refundAmount
 });
 message.success(t('returns.refund_completed'));
 setRefundDrawerVisible(false);
 fetchReturns();
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('errors.operation_failed'));
 }
 };

 const columns = [
 {
 title: t('returns.vendor_return_number'),
 dataIndex: 'return_number',
 key: 'return_number',
 },
 {
 title: t('date'),
 dataIndex: 'date',
 key: 'date',
 render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => {
 const colorMap: Record<string, string> = {
 pending: 'orange',
 approved: 'green',
 };
 return <Tag color={colorMap[status] || 'default'}>{t(`returns.${status}`)}</Tag>;
 },
 },
 {
 title: t('returns.refund_status'),
 dataIndex: 'refund_status',
 key: 'refund_status',
 render: (status: string) => status ? <Tag color="blue">{t(`returns.${status}`)}</Tag> : <Tag>{t('not_refunded')}</Tag>,
 },
 {
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 render: (total: number, record: VendorReturn) => formatCurrency(total, record.currency),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: VendorReturn) => (
 <Space>
 {record.status === 'pending' && (
 <Button
 icon={<CheckOutlined />}
 onClick={() => handleApprove(record.id)}
 >
 {t('returns.approve')}
 </Button>
 )}
 {record.status === 'approved' && !record.refund_status && (
 <Button
 icon={<DollarOutlined />}
 type="primary"
 onClick={() => openRefundDrawer(record)}
 >
 {t('refund')}
 </Button>
 )}
 {record.refund_status && (
 <Button
 icon={<ReloadOutlined />}
 onClick={() => openRefundDrawer(record)}
 >
 {t('returns.refund_details')}
 </Button>
 )}
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('returns.vendor_returns')}
 extra={
 <Button type="primary" onClick={fetchReturns}>
 {t('refresh')}
 </Button>
 }
 />

 <ResponsiveTableAdapter
 columns={columns}
 dataSource={returns}
 loading={loading}
 rowKey="id"
 pagination={{
 current: page,
 pageSize,
 total,
 onChange: (newPage, newPageSize) => {
 setPage(newPage);
 if (newPageSize) setPageSize(newPageSize);
 },
 }}
 />

 <FormDialog
 title={t('returns.refund_details')}
 open={refundDrawerVisible}
 onClose={() => setRefundDrawerVisible(false)}
 >
 {selectedReturn && (
 <>
 <Descriptions column={1} bordered>
 <Descriptions.Item label={t('returns.vendor_return_number')}>
 {selectedReturn.return_number}
 </Descriptions.Item>
 <Descriptions.Item label={t('total')}>
 {formatCurrency(selectedReturn.total, selectedReturn.currency)}
 </Descriptions.Item>
 <Descriptions.Item label={t('status')}>
 <Tag color={selectedReturn.status === 'approved' ? 'green' : 'orange'}>
 {t(`returns.${selectedReturn.status}`)}
 </Tag>
 </Descriptions.Item>
 </Descriptions>

 {selectedReturn.status === 'approved' && !selectedReturn.refund_status && (
 <div style={{ marginTop: 24 }}>
 <h4>{t('returns.create_refund')}</h4>
 <Space direction="vertical" style={{ width: '100%' }}>
 <div>
 <label>{t('returns.refund_method')}</label>
 <Select
 style={{ width: '100%', marginTop: 8 }}
 value={refundMethod}
 onChange={setRefundMethod}
 >
 <Option value="credit_note">{t('returns.vendor_credit')}</Option>
 <Option value="cash">{t('returns.cash')}</Option>
 </Select>
 </div>
 <div>
 <label>{t('returns.refund_amount')}</label>
 <InputNumber
 style={{ width: '100%', marginTop: 8 }}
 value={refundAmount}
 onChange={(value) => setRefundAmount(value || 0)}
 min={0}
 max={selectedReturn.total}
 />
 </div>
 <Button type="primary" block onClick={handleCreateRefund}>
 {t('returns.create_refund')}
 </Button>
 </Space>
 </div>
 )}

 {refunds.length > 0 && (
 <div style={{ marginTop: 24 }}>
 <h4>{t('returns.refund_list')}</h4>
 <ResponsiveTableAdapter
 dataSource={refunds}
 rowKey="id"
 pagination={false}
 columns={[
 {
 title: t('returns.refund_method'),
 dataIndex: 'method',
 render: (method: string) => t(`returns.${method}`),
 },
 {
 title: t('amount'),
 dataIndex: 'amount',
 render: (amount: number) => formatCurrency(amount, selectedReturn.currency),
 },
 {
 title: t('status'),
 dataIndex: 'status',
 render: (status: string) => <Tag color="green">{t(`returns.${status}`)}</Tag>,
 },
 ]}
 />
 </div>
 )}
 </>
 )}
 </FormDialog>
 </div>
 );
};

export default VendorReturns;
