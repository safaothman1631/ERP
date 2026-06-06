import React, { useState, useEffect, useMemo } from 'react';
import { Button, Descriptions, Radio, Empty } from 'antd';
import { EyeOutlined, FileAddOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import vendorApi from '../../api/vendorPortal';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { PageHeader, StatusTag, type StatusKind, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';

const VendorPortalPOs: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [loading, setLoading] = useState(true);
 const [pos, setPOs] = useState<any[]>([]);
 const [selectedPO, setSelectedPO] = useState<any>(null);
 const [drawerVisible, setDrawerVisible] = useState(false);
 const [statusFilter, setStatusFilter] = useState<string>('open');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('vendorPortalPOs.hiddenCols') || '[]'); } catch { return []; }
 });

 // Client-side filter because the backend's purchase-orders endpoint
 // has no search param — keep it scoped to whatever the status tab loaded.
 const filteredPOs = useMemo(() => {
 if (!search) return pos;
 const q = search.toLowerCase();
 return pos.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }, [pos, search]);

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

 // Kit list tabs (Open / Received / All) — wired to the same server `status` param.
 const tabs: KitListTab[] = [
 { key: 'open', label: t('vendor_portal.open') },
 { key: 'received', label: t('vendor_portal.received') },
 { key: 'all', label: t('vendor_portal.all') },
 ];

 const allColumns = [
 {
 title: t('vendor_portal.po_number'),
 dataIndex: 'number',
 key: 'number',
 render: (text: string) => text
 ? <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{text}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('vendor_portal.po_date'),
 dataIndex: 'date',
 key: 'date',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
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
 render: (val: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
 {val?.toFixed(2) || '0.00'}
 </span>
 ),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view'), onClick: () => viewPODetail(record.id) },
 { type: 'divider' },
 { key: 'submit_bill', icon: <FileAddOutlined />, label: t('vendor_portal.submit_bill'), onClick: () => navigate(`/vendor-portal/submit-bill?po_id=${record.id}`) },
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('vendorPortalPOs.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

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

 <KitListCard
 tabs={tabs}
 activeTab={statusFilter}
 onTabChange={(k) => setStatusFilter(k)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 {/* Group Filters + Status in a single flex unit so they ALWAYS wrap
 together to the same line — never one stranded on a row by itself. */}
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusFilter !== 'all' ? 1 : 0}
 onClear={() => setStatusFilter('all')}
 >
 <Radio.Group
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="open">{t('vendor_portal.open')}</Radio>
 <Radio value="received">{t('vendor_portal.received')}</Radio>
 <Radio value="all">{t('vendor_portal.all')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('vendor_portal.po_status')}
 anyLabel={t('vendor_portal.all')}
 value={statusFilter === 'all' ? '' : statusFilter}
 onChange={(v) => setStatusFilter(v || 'all')}
 options={[
 { value: 'open', label: t('vendor_portal.open') },
 { value: 'received', label: t('vendor_portal.received') },
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
 downloadCsv('vendor-purchase-orders', pos, cols);
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
 dataSource={filteredPOs}
 columns={columns}
 loading={loading}
 rowKey="id"
 locale={{
 emptyText: <Empty description={t('vendor_portal.no_pos')} />,
 }}
 />
 </KitListCard>

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
