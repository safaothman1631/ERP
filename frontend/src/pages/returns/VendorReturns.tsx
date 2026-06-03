import React, { useMemo, useState, useEffect } from 'react';
import { Button, Select, InputNumber, message, Space, Radio } from 'antd';
import { CheckOutlined, DollarOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, StatusTag, KeyValueGrid, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
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
 const [tab, setTab] = useState<'all' | 'pending' | 'approved'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('vendorReturns.hiddenCols') || '[]'); } catch { return []; }
 });

 const statusFilter = tab === 'all' ? '' : tab;

 useEffect(() => {
 fetchReturns();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [page, pageSize, statusFilter]);

 const fetchReturns = async () => {
 setLoading(true);
 try {
 const response = await api.get('/returns/vendor', {
 params: { page, page_size: pageSize, status: statusFilter || undefined }
 });
 setReturns(response.data.items || []);
 setTotal(response.data.total || 0);
 } catch (_error) {
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
 } catch (_error) {
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

 // Kit list tabs (All / Pending / Approved) — wired to the same `status` server param.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'pending', label: t('returns.pending', 'Pending') },
 { key: 'approved', label: t('returns.approved', 'Approved') },
 ];

 const allColumns = [
 {
 title: t('returns.vendor_return_number'),
 dataIndex: 'return_number',
 key: 'return_number',
 render: (v: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v || '—'}</span>
 ),
 },
 {
 title: t('date'),
 dataIndex: 'date',
 key: 'date',
 render: (date: string) => date
 ? <span style={{ color: 'var(--ink-700)' }}>{new Date(date).toLocaleDateString()}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => <StatusTag status={status} label={t(`returns.${status}`)} />,
 },
 {
 title: t('returns.refund_status'),
 dataIndex: 'refund_status',
 key: 'refund_status',
 render: (status: string) => status
 ? <StatusTag status={status} label={t(`returns.${status}`)} />
 : <StatusTag status="default" label={t('not_refunded')} />,
 },
 {
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 render: (totalAmount: number, record: VendorReturn) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {formatCurrency(totalAmount, record.currency)}
 </span>
 ),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: VendorReturn) => {
 const actions: any[] = [
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openRefundDrawer(record) },
 ];
 if (record.status === 'pending') {
 actions.push({ key: 'approve', icon: <CheckOutlined />, label: t('returns.approve', 'Approve'), onClick: () => handleApprove(record.id) });
 }
 if (record.status === 'approved' && !record.refund_status) {
 actions.push({ key: 'refund', icon: <DollarOutlined />, label: t('refund', 'Refund'), onClick: () => openRefundDrawer(record) });
 }
 if (record.refund_status) {
 actions.push({ key: 'refund_details', icon: <ReloadOutlined />, label: t('returns.refund_details', 'Refund details'), onClick: () => openRefundDrawer(record) });
 }
 return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
 },
 },
 ];

 const columns = useMemo(
 () => allColumns.filter((c) => !hiddenCols.includes(c.key)),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [hiddenCols, t]
 );

 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'return_number' || c.key === 'actions',
 }));

 const filteredData = useMemo(() => {
 if (!search) return returns;
 const q = search.toLowerCase();
 return returns.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
 );
 }, [returns, search]);

 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('vendorReturns.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('returns.vendor_returns')}
 subtitle={t('returns.vendor_returns_subtitle', { defaultValue: '' }) || undefined}
 extra={
 <Button icon={<ReloadOutlined />} onClick={fetchReturns}>
 {t('refresh')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as typeof tab); setPage(1); }}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPage(1); }}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => { setTab('all'); setPage(1); }}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => { setTab(e.target.value); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="pending">{t('returns.pending', 'Pending')}</Radio>
 <Radio value="approved">{t('returns.approved', 'Approved')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as typeof tab); setPage(1); }}
 options={[
 { value: 'pending', label: t('returns.pending', 'Pending') },
 { value: 'approved', label: t('returns.approved', 'Approved') },
 ]}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('vendor-returns', filteredData, cols);
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
 columns={columns}
 dataSource={filteredData}
 loading={loading}
 rowKey="id"
 pagination={{
 current: page,
 pageSize,
 total: search ? filteredData.length : total,
 onChange: (newPage, newPageSize) => {
 setPage(newPage);
 if (newPageSize) setPageSize(newPageSize);
 },
 }}
 />
 </KitListCard>

 <FormDialog
 title={t('returns.refund_details')}
 open={refundDrawerVisible}
 onClose={() => setRefundDrawerVisible(false)}
 >
 {selectedReturn && (
 <>
 <KeyValueGrid
 columns={1}
 items={[
 { label: t('returns.vendor_return_number'), value: selectedReturn.return_number },
 { label: t('total'), value: formatCurrency(selectedReturn.total, selectedReturn.currency) },
 { label: t('status'), value: <StatusTag status={selectedReturn.status} label={t(`returns.${selectedReturn.status}`)} /> },
 ]}
 />

 {selectedReturn.status === 'approved' && !selectedReturn.refund_status && (
 <div style={{ marginTop: 24 }}>
 <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink-900)', marginBottom: 'var(--space-md)' }}>{t('returns.create_refund')}</h4>
 <Space direction="vertical" style={{ width: '100%' }}>
 <div>
 <label style={{ color: 'var(--ink-700)', fontSize: 12.5 }}>{t('returns.refund_method')}</label>
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
 <label style={{ color: 'var(--ink-700)', fontSize: 12.5 }}>{t('returns.refund_amount')}</label>
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
 <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink-900)', marginBottom: 'var(--space-md)' }}>{t('returns.refund_list')}</h4>
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
 render: (status: string) => <StatusTag status={status} label={t(`returns.${status}`)} />,
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
