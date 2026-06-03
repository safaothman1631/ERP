import React, { useEffect, useMemo, useState } from 'react';
import { Button, Select, InputNumber, Space, Modal } from 'antd';
import { message } from '../../utils/message';
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
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Option } = Select;

interface SalesReturn {
 id: string;
 return_number: string;
 contact_id: string;
 invoice_id: string;
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

const SalesReturns: React.FC = () => {
 const { t } = useTranslation();
 const [loading, setLoading] = useState(false);
 const [returns, setReturns] = useState<SalesReturn[]>([]);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(20);
 const [refundDrawerVisible, setRefundDrawerVisible] = useState(false);
 const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);
 const [refundMethod, setRefundMethod] = useState<string>('credit_note');
 const [refundAmount, setRefundAmount] = useState<number>(0);
 const [refunds, setRefunds] = useState<RefundRecord[]>([]);
 const [_refundModalVisible, _setRefundModalVisible] = useState(false);
 const [statusFilter, setStatusFilter] = useState('');
 const [search, setSearch] = useState('');
 const [tab, setTab] = useState<'all' | 'pending' | 'approved'>('all');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('sales_returns.hiddenCols') || '[]'); } catch { return []; }
 });

 useEffect(() => {
 fetchReturns();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [page, pageSize, statusFilter]);

 const fetchReturns = async () => {
 setLoading(true);
 try {
 const response = await api.get('/returns/sales', {
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

 // Kit list tabs (All / Pending / Approved) — server-side filtered via the same `status` param.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'pending', label: t('returns.pending', 'Pending') },
 { key: 'approved', label: t('returns.approved', 'Approved') },
 ];

 const onTabChange = (k: string) => {
 const next = (k || 'all') as typeof tab;
 setTab(next);
 setStatusFilter(next === 'all' ? '' : next);
 setPage(1);
 };

 const handleApprove = async (returnId: string) => {
 try {
 await api.post(`/returns/sales/${returnId}/approve`, {});
 message.success(t('returns.approved'));
 fetchReturns();
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('errors.operation_failed'));
 }
 };

 const openRefundDrawer = async (record: SalesReturn) => {
 setSelectedReturn(record);
 setRefundAmount(record.total);
 setRefundMethod('credit_note');
 setRefundDrawerVisible(true);

 // Fetch existing refunds
 try {
 const response = await api.get(`/returns/sales/${record.id}/refunds`);
 setRefunds(response.data.items || []);
 } catch (_error) {
 setRefunds([]);
 }
 };

 const handleCreateRefund = async () => {
 if (!selectedReturn) return;

 try {
 const response = await api.post(`/returns/sales/${selectedReturn.id}/refund`, {
 method: refundMethod,
 amount: refundAmount
 });
 message.success(t('returns.refund_completed'));
 setRefundDrawerVisible(false);
 fetchReturns();

 // Show result details
 if (response.data.credit_note_id) {
 Modal.info({
 title: t('returns.refund_completed'),
 content: `${t('returns.credit_note')} ID: ${response.data.credit_note_id}`
 });
 }
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('errors.operation_failed'));
 }
 };

 // Kit cell renderers — mono code/total, design-system StatusTag chips.
 const allColumns = [
 {
 title: t('numbering.invoice'),
 dataIndex: 'return_number',
 key: 'return_number',
 render: (v: string) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v || '—'}</span>
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
 render: (totalVal: number, record: SalesReturn) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {formatCurrency(totalVal, record.currency)}
 </span>
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: SalesReturn) => {
 const actions: Array<
 | { key: string; icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }
 | { type: 'divider' }
 > = [
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
 [hiddenCols, t],
 );
 const filteredData = useMemo(() => {
 if (!search) return returns;
 const q = search.toLowerCase();
 return returns.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
 }, [returns, search]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'return_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('sales_returns.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('returns.sales_returns')}
 subtitle={t('returns.sales_returns_subtitle', { defaultValue: '' }) || undefined}
 extra={
 <Button icon={<ReloadOutlined />} onClick={fetchReturns}>
 {t('refresh')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={onTabChange}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusFilter ? 1 : 0}
 onClear={() => { setStatusFilter(''); setTab('all'); setPage(1); }}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 <label style={{ color: 'var(--ink-700)', fontSize: 12.5 }}>{t('status')}</label>
 <Select
 value={statusFilter || undefined}
 placeholder={t('all', 'All')}
 onChange={(v) => {
 const next = (v || '') as string;
 setStatusFilter(next);
 setTab((next || 'all') as typeof tab);
 setPage(1);
 }}
 allowClear
 style={{ width: '100%' }}
 >
 <Option value="pending">{t('returns.pending', 'Pending')}</Option>
 <Option value="approved">{t('returns.approved', 'Approved')}</Option>
 </Select>
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => {
 setStatusFilter(v);
 setTab((v || 'all') as typeof tab);
 setPage(1);
 }}
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
 downloadCsv('sales_returns', returns, cols);
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
 total,
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
 { label: t('numbering.invoice'), value: selectedReturn.return_number },
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
 <Option value="credit_note">{t('returns.credit_note')}</Option>
 <Option value="cash">{t('returns.cash')}</Option>
 <Option value="wallet">{t('returns.wallet')}</Option>
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

export default SalesReturns;
