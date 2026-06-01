import React, { useState, useEffect } from 'react';
import { Button, Descriptions, Space, Empty } from 'antd';
import { EyeOutlined, FileAddOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import vendorApi from '../../api/vendorPortal';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { PageHeader, FilterBar, SectionCard, StatusTag, type StatusKind } from '../../design-system';

const VendorPortalPOs: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [loading, setLoading] = useState(true);
 const [pos, setPOs] = useState<any[]>([]);
 const [selectedPO, setSelectedPO] = useState<any>(null);
 const [drawerVisible, setDrawerVisible] = useState(false);
 const [statusFilter, setStatusFilter] = useState<string>('open');

 useEffect(() => {
 loadPOs();
 }, [statusFilter]);

 const loadPOs = async () => {
 try {
 setLoading(true);
 const res = await vendorApi.get(`/api/vendor-portal/me/purchase-orders?status=${statusFilter}`);
 setPOs(res.data.purchase_orders || []);
 } catch (err: any) {
 if (err.response?.status === 401) {
 message.error(t('vendor_portal.token_invalid'));
 navigate('/vendor-portal/login');
 } else {
 message.error(t('portal.load_failed'));
 }
 } finally {
 setLoading(false);
 }
 };

 const viewPODetail = async (poId: string) => {
 try {
 const res = await vendorApi.get(`/api/vendor-portal/me/purchase-orders/${poId}`);
 setSelectedPO(res.data);
 setDrawerVisible(true);
 } catch (_err: any) {
 message.error(t('portal.load_failed'));
 }
 };

 const columns = [
 {
 title: t('vendor_portal.po_number'),
 dataIndex: 'number',
 key: 'number',
 render: (text: string) => text || '-',
 },
 {
 title: t('vendor_portal.po_date'),
 dataIndex: 'date',
 key: 'date',
 },
 {
 title: t('vendor_portal.po_status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => {
 const kinds: Record<string, StatusKind> = {
 draft: 'default',
 approved: 'info',
 open: 'success',
 received: 'success',
 cancelled: 'error',
 };
 return <StatusTag status={kinds[status] || 'default'} label={status} />;
 },
 },
 {
 title: t('vendor_portal.po_total'),
 dataIndex: 'total',
 key: 'total',
 align: 'right' as const,
 render: (val: number) => `${val?.toFixed(2) || '0.00'}`,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button
 type="link"
 icon={<EyeOutlined />}
 onClick={() => viewPODetail(record.id)}
 >
 {t('view')}
 </Button>
 <Button
 type="primary"
 icon={<FileAddOutlined />}
 onClick={() => navigate(`/vendor-portal/submit-bill?po_id=${record.id}`)}
 >
 {t('vendor_portal.submit_bill')}
 </Button>
 </Space>
 ),
 },
 ];

 const lineColumns = [
 {
 title: t('items.description'),
 dataIndex: 'description',
 key: 'description',
 },
 {
 title: t('items.quantity'),
 dataIndex: 'quantity',
 key: 'quantity',
 },
 {
 title: t('items.unit_price'),
 dataIndex: 'unit_price',
 key: 'unit_price',
 align: 'right' as const,
 render: (val: number) => val?.toFixed(2) || '0.00',
 },
 {
 title: t('items.amount'),
 dataIndex: 'amount',
 key: 'amount',
 align: 'right' as const,
 render: (val: number) => val?.toFixed(2) || '0.00',
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('vendor_portal.my_pos')}
 extra={
 <Button onClick={() => navigate('/vendor-portal')}>
 {t('back')}
 </Button>
 }
 />

 <FilterBar
 filters={[
 {
 key: 'status',
 label: t('vendor_portal.po_status'),
 options: [
 { label: t('vendor_portal.open'), value: 'open' },
 { label: t('vendor_portal.received'), value: 'received' },
 { label: t('vendor_portal.all'), value: 'all' },
 ],
 },
 ]}
 values={{ status: statusFilter }}
 onChange={(v) => setStatusFilter((v.status as string) || 'open')}
 />

 <SectionCard padded={false}>
 <ResponsiveTableAdapter
 dataSource={pos}
 columns={columns}
 loading={loading}
 rowKey="id"
 locale={{
 emptyText: <Empty description={t('vendor_portal.no_pos')} />,
 }}
 />
 </SectionCard>

 <FormDialog
 title={t('vendor_portal.po_detail')}
 open={drawerVisible}
 onClose={() => setDrawerVisible(false)}
 >
 {selectedPO && (
 <>
 <Descriptions column={2} bordered>
 <Descriptions.Item label={t('vendor_portal.po_number')}>
 {selectedPO.number || '-'}
 </Descriptions.Item>
 <Descriptions.Item label={t('vendor_portal.po_date')}>
 {selectedPO.date}
 </Descriptions.Item>
 <Descriptions.Item label={t('vendor_portal.po_status')}>
 <StatusTag status="info" label={selectedPO.status} />
 </Descriptions.Item>
 <Descriptions.Item label={t('vendor_portal.po_total')}>
 {selectedPO.total?.toFixed(2) || '0.00'}
 </Descriptions.Item>
 </Descriptions>

 <div style={{ marginTop: 24 }}>
 <h3>{t('items.line_items')}</h3>
 <ResponsiveTableAdapter
 dataSource={selectedPO.lines || []}
 columns={lineColumns}
 pagination={false}
 />
 </div>

 <div style={{ marginTop: 24 }}>
 <Button
 type="primary"
 block
 icon={<FileAddOutlined />}
 onClick={() => {
 setDrawerVisible(false);
 navigate(`/vendor-portal/submit-bill?po_id=${selectedPO.id}`);
 }}
 >
 {t('vendor_portal.submit_bill')}
 </Button>
 </div>
 </>
 )}
 </FormDialog>
 </div>
 );
};

export default VendorPortalPOs;
