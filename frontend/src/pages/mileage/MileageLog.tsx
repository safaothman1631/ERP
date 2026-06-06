import { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { Button, Form, Input, InputNumber, DatePicker, Select, Radio } from 'antd';

import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag, BulkActionBar, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface MileageLog {
 id: string;
 date: string;
 from_location: string;
 to_location: string;
 distance_km: number;
 rate_per_km: number;
 total_amount: number;
 purpose: string;
 vehicle?: string;
 notes?: string;
 status: 'draft' | 'submitted' | 'approved' | 'rejected';
 employee_name?: string;
 project_name?: string;
 created_at?: string;
}

type StatusTab = 'all' | 'draft' | 'submitted' | 'approved' | 'rejected';

const MileageLog: FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<MileageLog[]>([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [pageSize] = useState(20);
 const [modal, setModal] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
 const isDark = useAuthStore((s) => s.theme === 'dark');

 // Filters
 const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
 const [search, setSearch] = useState('');
 const [_dateFrom, _setDateFrom] = useState<Dayjs | null>(null);
 const [_dateTo, _setDateTo] = useState<Dayjs | null>(null);

 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('mileage.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const params: Record<string, unknown> = { page, page_size: pageSize };
 if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
 const res = await api.get('/api/mileage', { params });
 setData(res.data.items || []);
 setTotal(res.data.total || 0);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, [page, statusFilter]);

 const openModal = (record?: MileageLog) => {
 if (record) {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 date: dayjs(record.date),
 });
 } else {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ date: dayjs(), status: 'draft', rate_per_km: 0.5 });
 }
 setModal(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 const payload = {
 ...values,
 date: values.date.format('YYYY-MM-DD'),
 };

 if (editingId) {
 await api.put(`/api/mileage/${editingId}`, payload);
 message.success(t('updated'));
 } else {
 await api.post('/api/mileage', payload);
 message.success(t('saved'));
 }
 setModal(false);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/mileage/${id}`);
 message.success(t('deleted'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleSubmit = async (id: string) => {
 try {
 await api.put(`/api/mileage/${id}`, { status: 'submitted' });
 message.success(t('mileage.submitted'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleBulkSubmit = async () => {
 try {
 await Promise.all(
 selectedRowKeys.map((id) => api.put(`/api/mileage/${id}`, { status: 'submitted' }))
 );
 message.success(t('mileage.bulk_submitted'));
 setSelectedRowKeys([]);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleBulkDelete = async () => {
 try {
 await Promise.all(selectedRowKeys.map((id) => api.delete(`/api/mileage/${id}`)));
 message.success(t('deleted'));
 setSelectedRowKeys([]);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 // Kit list tabs — real status segments wired to server param.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'draft', label: t('draft', 'Draft') },
 { key: 'submitted', label: t('submitted', 'Submitted') },
 { key: 'approved', label: t('approved', 'Approved') },
 { key: 'rejected', label: t('rejected', 'Rejected') },
 ];

 const allColumns: any[] = [
 {
 title: t('date'), dataIndex: 'date', key: 'date', width: 110,
 render: (d: string) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
 {d?.substring(0, 10)}
 </span>
 ),
 },
 {
 title: t('mileage.route'), key: 'route',
 render: (_: any, r: MileageLog) => (
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>
 {r.from_location} → {r.to_location}
 </span>
 ),
 },
 {
 title: t('mileage.distance_km'), dataIndex: 'distance_km', key: 'distance_km', width: 100, align: 'right',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 ),
 },
 {
 title: t('mileage.rate_per_km'), dataIndex: 'rate_per_km', key: 'rate_per_km', width: 100, align: 'right',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 ),
 },
 {
 title: t('amount'), dataIndex: 'total_amount', key: 'total_amount', width: 120, align: 'right',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {v?.toFixed(2)}
 </span>
 ),
 },
 {
 title: t('mileage.purpose'), dataIndex: 'purpose', key: 'purpose', ellipsis: true,
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('mileage.vehicle'), dataIndex: 'vehicle', key: 'vehicle', width: 100,
 render: (v: string) => v
 ? (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{v}</span>
 )
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status', width: 110,
 render: (s: string) => <StatusTag status={s as never} label={t(s)} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, r: MileageLog) => {
 const actions: any[] = [
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openModal(r) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openModal(r) },
 ];
 if (r.status === 'draft') {
 actions.push({ key: 'submit', icon: <CheckOutlined />, label: t('submit', 'Submit'), onClick: () => handleSubmit(r.id) });
 }
 actions.push({ type: 'divider' });
 actions.push({ key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(r.id) });
 return <KitRowActions ariaLabel={t('actions')} actions={actions} />;
 },
 },
 ];

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'date' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('mileage.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div style={{ padding: 24 }}>
 <PageHeader
 title={t('mileage.mileage_log')}
 subtitle={t('mileage.log_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
 {t('mileage.new_log')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={statusFilter}
 onTabChange={(k) => { setStatusFilter(k as StatusTab); setPage(1); setSelectedRowKeys([]); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusFilter !== 'all' ? 1 : 0}
 onClear={() => { setStatusFilter('all'); setPage(1); }}
 >
 <Radio.Group
 value={statusFilter}
 onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="draft">{t('draft', 'Draft')}</Radio>
 <Radio value="submitted">{t('submitted', 'Submitted')}</Radio>
 <Radio value="approved">{t('approved', 'Approved')}</Radio>
 <Radio value="rejected">{t('rejected', 'Rejected')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={statusFilter === 'all' ? '' : statusFilter}
 onChange={(v) => { setStatusFilter((v || 'all') as StatusTab); setPage(1); }}
 options={[
 { value: 'draft', label: t('draft', 'Draft') },
 { value: 'submitted', label: t('submitted', 'Submitted') },
 { value: 'approved', label: t('approved', 'Approved') },
 { value: 'rejected', label: t('rejected', 'Rejected') },
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
 downloadCsv('mileage', filteredData, cols);
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
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{
 current: page,
 pageSize,
 total: search ? filteredData.length : total,
 onChange: setPage,
 showSizeChanger: false,
 }}
 rowSelection={{
 selectedRowKeys,
 onChange: (keys) => setSelectedRowKeys(keys as string[]),
 }}
 />
 </KitListCard>

 <BulkActionBar
 selectedCount={selectedRowKeys.length}
 onClear={() => setSelectedRowKeys([])}
 isDark={isDark}
 actions={[
 { key: 'submit', label: t('submit'), icon: <CheckOutlined />, onClick: handleBulkSubmit },
 { key: 'delete', label: t('delete'), icon: <DeleteOutlined />, danger: true, onClick: handleBulkDelete },
 ]}
 />

 <FormDialog
 open={modal}
 onClose={() => setModal(false)}
 onOk={handleSave}
 title={editingId ? t('mileage.edit_log') : t('mileage.new_log')}
 >
 <Form form={form} layout="vertical">
 <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required') }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('mileage.from_location')} name="from_location" rules={[{ required: true, message: t('required') }]}>
 <Input placeholder={t('mileage.from_placeholder')} />
 </Form.Item>
 <Form.Item label={t('mileage.to_location')} name="to_location" rules={[{ required: true, message: t('required') }]}>
 <Input placeholder={t('mileage.to_placeholder')} />
 </Form.Item>
 <Form.Item label={t('mileage.distance_km')} name="distance_km" rules={[{ required: true, message: t('required') }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('mileage.rate_per_km')} name="rate_per_km" rules={[{ required: true, message: t('required') }]}>
 <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('mileage.purpose')} name="purpose" rules={[{ required: true, message: t('required') }]}>
 <Input.TextArea rows={2} placeholder={t('mileage.purpose_placeholder')} />
 </Form.Item>
 <Form.Item label={t('mileage.vehicle')} name="vehicle">
 <Input placeholder={t('mileage.vehicle_placeholder')} />
 </Form.Item>
 <Form.Item label={t('notes')} name="notes">
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item label={t('status')} name="status" initialValue="draft">
 <Select
 options={[
 { value: 'draft', label: t('draft') },
 { value: 'submitted', label: t('submitted') },
 ]}
 />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default MileageLog;
