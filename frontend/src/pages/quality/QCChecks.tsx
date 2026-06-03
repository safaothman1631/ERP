import React, { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Space, Form, Input, InputNumber, Modal, Radio } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface QCCheck {
 id: string;
 point_id?: string;
 product_id?: string;
 status?: string;
 notes?: string;
 checked_at?: string;
 measure?: number;
 measure_min?: number;
 measure_max?: number;
}

const QCChecks: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<QCCheck[]>([]);
 const [loading, setLoading] = useState(false);
 const [statusFilter, setStatusFilter] = useState('');
 const [search, setSearch] = useState('');
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [form] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('qc_checks.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const params: any = { limit: 200 };
 if (statusFilter) params.status = statusFilter;
 const res = await api.get('/api/quality/checks', { params });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, [statusFilter]);

 const handleSave = async (values: any) => {
 try {
 await api.post('/api/quality/checks', values);
 message.success(t('quality.check_created'));
 setDrawerOpen(false);
 form.resetFields();
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handlePass = async (id: string) => {
 try {
 await api.post(`/api/quality/checks/${id}/pass`);
 message.success(t('quality.check_passed'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleFail = async (id: string, reason?: string) => {
 try {
 await api.post(`/api/quality/checks/${id}/fail`, { reason });
 message.success(t('quality.check_failed'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 // Kit list tabs (All / Pending / Passed / Failed) — server-side filtered via `status`.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'pending', label: t('quality.pending') },
 { key: 'pass', label: t('quality.passed') },
 { key: 'fail', label: t('quality.failed') },
 ];

 const statusOptions = [
 { value: 'pending', label: t('quality.pending') },
 { value: 'pass', label: t('quality.passed') },
 { value: 'fail', label: t('quality.failed') },
 ];

 const allColumns: ColumnsType<QCCheck> = [
 {
 title: t('quality.product'),
 dataIndex: 'product_id',
 key: 'product_id',
 render: (v) =>
 v
 ? <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>{t('n_a')}</span>,
 },
 {
 title: t('quality.notes'),
 dataIndex: 'notes',
 key: 'notes',
 render: (v) => v
 ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('quality.measure'),
 key: 'measure',
 render: (_, r) => {
 if (r.measure !== undefined && r.measure !== null) {
 return (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {`${r.measure} (${r.measure_min}–${r.measure_max})`}
 </span>
 );
 }
 return <span style={{ color: 'var(--ink-400)' }}>—</span>;
 },
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (v) => {
 if (v === 'pass') return <StatusTag status="success" label={t('quality.passed')} />;
 if (v === 'fail') return <StatusTag status="error" label={t('quality.failed')} />;
 return <StatusTag status="default" label={t('quality.pending')} />;
 },
 },
 {
 title: t('quality.date'),
 dataIndex: 'checked_at',
 key: 'checked_at',
 render: (v) => v
 ? <span style={{ color: 'var(--ink-600)' }}>{new Date(v).toLocaleString()}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_, record) => {
 if (record.status === 'pass' || record.status === 'fail') {
 return (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'pass', icon: <CheckOutlined />, label: t('quality.pass'), disabled: true, onClick: () => {} },
 { key: 'fail', icon: <CloseOutlined />, label: t('quality.fail'), disabled: true, onClick: () => {} },
 ]}
 />
 );
 }
 return (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 {
 key: 'pass',
 icon: <CheckOutlined />,
 label: t('quality.pass'),
 onClick: () => Modal.confirm({
 title: t('quality.confirm_pass'),
 onOk: () => handlePass(record.id),
 }),
 },
 { type: 'divider' },
 {
 key: 'fail',
 icon: <CloseOutlined />,
 label: t('quality.fail'),
 danger: true,
 onClick: () => Modal.confirm({
 title: t('quality.confirm_fail'),
 okButtonProps: { danger: true },
 onOk: () => handleFail(record.id),
 }),
 },
 ]}
 />
 );
 },
 },
 ];

 const columns = useMemo(
 () => allColumns.filter((c) => !hiddenCols.includes(c.key as string)),
 [hiddenCols, t, data],
 );
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'product_id' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('qc_checks.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 // Client-side search across all row values (backend has no search param).
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }, [data, search]);

 return (
 <div>
 <PageHeader
 title={t('quality.qc_checks')}
 subtitle={t('quality.qc_checks_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 form.resetFields();
 setDrawerOpen(true);
 }}
 >
 {t('quality.new_check')}
 </Button>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={statusFilter || 'all'}
 onTabChange={(k) => setStatusFilter(k === 'all' ? '' : k)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusFilter ? 1 : 0}
 onClear={() => setStatusFilter('')}
 >
 <Radio.Group
 value={statusFilter || 'all'}
 onChange={(e) => setStatusFilter(e.target.value === 'all' ? '' : e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 {statusOptions.map((o) => (
 <Radio key={o.value} value={o.value}>{o.label}</Radio>
 ))}
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('quality.filter_by_status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => setStatusFilter(v)}
 options={statusOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('qc_checks', data, cols);
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
 pagination={{ pageSize: 20 }}
 />
 </KitListCard>
 <FormDialog
 title={t('quality.new_check')}
 open={drawerOpen}
 onClose={() => {
 setDrawerOpen(false);
 form.resetFields();
 }}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="point_id" label={t('quality.plan')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="product_id" label={t('quality.product')}>
 <Input />
 </Form.Item>
 <Form.Item name="reference_id" label={t('quality.reference_id')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="reference_type" label={t('quality.reference_type')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="measure" label={t('quality.measure')}>
 <InputNumber style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="measure_min" label={t('quality.measure_min')}>
 <InputNumber style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="measure_max" label={t('quality.measure_max')}>
 <InputNumber style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="notes" label={t('quality.notes')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item>
 <Space>
 <Button type="primary" htmlType="submit">
 {t('save')}
 </Button>
 <Button onClick={() => setDrawerOpen(false)}>{t('cancel')}</Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default QCChecks;
