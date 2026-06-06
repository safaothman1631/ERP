import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, DatePicker, Space, message, Descriptions, Table, Radio } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { PageHeader, DataTable, StatusTag, type ColumnVisibilityItem } from '../design-system';
import type { ColumnDef } from '../design-system/DataTable';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitSearchInput from '../design-system/KitSearchInput';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import { downloadCsv } from '../utils/exportCsv';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import { FormDialog } from '../components/responsive/FormDialog';

interface Run {
 id: string; name: string; period_start?: string; period_end?: string; status?: string;
 employee_count?: number; total_gross?: number; total_net?: number;
}
interface Payslip {
 id: string; employee_name?: string; basic?: number; allowances?: number; deductions?: number;
 gross?: number; net?: number; status?: string; currency?: string;
 lines?: { code?: string; name?: string; type?: string; amount: number }[];
}

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

export default function PayrollRuns() {
 const { t } = useTranslation();
 const [open, setOpen] = useState(false);
 const [form] = Form.useForm();
 const [drawer, setDrawer] = useState<{ run: Run; payslips: Payslip[] } | null>(null);
 const [active, setActive] = useState<Payslip | null>(null);
 // Client-side status segment (this endpoint exposes no server filter param).
 const [tab, setTab] = useState<'all' | 'confirmed' | 'pending'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('payrollRuns.hiddenCols') || '[]'); } catch { return []; }
 });
 const payrollRunsQuery = useListQuery<Run, { items?: Run[]; total?: number }>({
 queryKey: listQueryKeys.payrollRuns(),
 queryFn: () => api.get('/api/payroll/runs'),
 });
 const list = payrollRunsQuery.data?.items ?? [];

 const load = async () => {
 await payrollRunsQuery.refetch();
 };
 useEffect(() => { load(); }, []);

 const submit = async () => {
 const v = await form.validateFields();
 v.period_start = v.range[0].format('YYYY-MM-DD');
 v.period_end = v.range[1].format('YYYY-MM-DD');
 delete v.range;
 try {
 await api.post('/api/payroll/runs', v);
 message.success(t('saved'));
 setOpen(false); form.resetFields();
 await payrollRunsQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const showRun = async (id: string) => {
 const r = await api.get(`/api/payroll/runs/${id}`);
 setDrawer({ run: r.data, payslips: r.data.payslips || [] });
 };

 const confirmRun = async (id: string) => {
 try { await api.post(`/api/payroll/runs/${id}/confirm`); message.success(t('confirmed')); await payrollRunsQuery.refetch(); setDrawer(null); }
 catch { message.error(t('error')); }
 };
 const removeRun = async (id: string) => {
 try { await api.delete(`/api/payroll/runs/${id}`); await payrollRunsQuery.refetch(); }
 catch { message.error(t('error')); }
 };
 const markPaid = async (id: string) => {
 try { await api.post(`/api/payroll/payslips/${id}/mark-paid`); if (drawer) showRun(drawer.run.id); }
 catch { message.error(t('error')); }
 };

 // Kit list tabs (All / Confirmed / Pending) — client-side over the loaded runs.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'confirmed', label: t('confirmed', 'Confirmed') },
 { key: 'pending', label: t('pending', 'Pending') },
 ];
 const filteredList = useMemo(() => {
 let rows = list;
 if (tab === 'confirmed') rows = rows.filter((r) => r.status === 'confirmed');
 else if (tab === 'pending') rows = rows.filter((r) => r.status !== 'confirmed');
 if (search) {
 const q = search.toLowerCase();
 rows = rows.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }
 return rows;
 }, [list, tab, search]);

 const allCols: ColumnDef<Run>[] = [
 {
 title: t('name'), dataIndex: 'name', key: 'name',
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(v)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 </div>
 ),
 },
 {
 title: t('period'), key: 'period',
 render: (_: unknown, r: Run) => (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
 {`${r.period_start || ''} → ${r.period_end || ''}`}
 </span>
 ),
 },
 { title: t('employees'), dataIndex: 'employee_count', key: 'employee_count' },
 {
 title: t('total_gross'), dataIndex: 'total_gross', key: 'total_gross', align: 'right' as const,
 render: (n?: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(n || 0).toLocaleString()}</span>
 ),
 },
 {
 title: t('total_net'), dataIndex: 'total_net', key: 'total_net', align: 'right' as const,
 render: (n?: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(n || 0).toLocaleString()}</span>
 ),
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (s?: string) => <StatusTag status={s === 'confirmed' ? 'posted' : 'pending'} label={s ? t(s, s) : '—'} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, r: Run) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => showRun(r.id) },
 ...(r.status !== 'confirmed'
 ? [
 { type: 'divider' as const },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => removeRun(r.id) },
 ]
 : []),
 ]}
 />
 ),
 },
 ];
 const cols = useMemo(() => allCols.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allCols.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('payrollRuns.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const slipCols: ColumnDef<Payslip>[] = [
 { title: t('employee'), dataIndex: 'employee_name' },
 { title: t('basic'), dataIndex: 'basic', align: 'right' as const, render: (n?: number) => (n || 0).toLocaleString() },
 { title: t('allowances'), dataIndex: 'allowances', align: 'right' as const, render: (n?: number) => (n || 0).toLocaleString() },
 { title: t('deductions'), dataIndex: 'deductions', align: 'right' as const, render: (n?: number) => (n || 0).toLocaleString() },
 { title: t('net'), dataIndex: 'net', align: 'right' as const, render: (n?: number) => <strong>{(n || 0).toLocaleString()}</strong> },
 { title: t('status'), dataIndex: 'status', render: (s?: string) => <StatusTag status={s === 'paid' ? 'paid' : s === 'confirmed' ? 'info' : 'pending'} label={s ? t(s, s) : '—'} /> },
 {
 title: t('actions'),
 render: (_: unknown, r: Payslip) => (
 <Space>
 <Button onClick={() => setActive(r)}>{t('view')}</Button>
 {r.status !== 'paid' && (
 <Button type="primary" onClick={() => markPaid(r.id)}>{t('mark_paid')}</Button>
 )}
 </Space>
 ),
 },
 ];

 return (
 <div data-section-id="hr.payroll_runs">
 <PageHeader
 title={t('payroll_runs')}
 sectionId="hr.payroll_runs"
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('new_run')}</Button>
 </Space>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => setTab(k as typeof tab)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => setTab('all')}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => setTab(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="confirmed">{t('confirmed', 'Confirmed')}</Radio>
 <Radio value="pending">{t('pending', 'Pending')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => setTab((v || 'all') as typeof tab)}
 options={[
 { value: 'confirmed', label: t('confirmed', 'Confirmed') },
 { value: 'pending', label: t('pending', 'Pending') },
 ]}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const exportCols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('payroll-runs', filteredList, exportCols);
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
 <DataTable rowKey="id" dataSource={filteredList} columns={cols} pagination={{ pageSize: 20 }} />
 </KitListCard>

 <FormDialog open={open} onOk={submit} onClose={() => setOpen(false)} title={t('new_run')}>
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}
 initialValue={`Payroll ${dayjs().format('YYYY-MM')}`}><Input /></Form.Item>
 <Form.Item name="range" label={t('period')} rules={[{ required: true }]}
 initialValue={[dayjs().startOf('month'), dayjs().endOf('month')]}>
 <DatePicker.RangePicker style={{ width: '100%' }} />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 open={!!drawer}
 onClose={() => setDrawer(null)}
 title={drawer?.run.name || ''}
 >
 {drawer && (
 <>
 {drawer.run.status !== 'confirmed' && (
 <div style={{ marginBottom: 12 }}>
 <Button type="primary" icon={<CheckOutlined />} onClick={() => confirmRun(drawer.run.id)}>
 {t('confirm_run')}
 </Button>
 </div>
 )}
 <Descriptions column={2} bordered style={{ marginBottom: 12 }}>
 <Descriptions.Item label={t('period')}>{drawer.run.period_start} → {drawer.run.period_end}</Descriptions.Item>
 <Descriptions.Item label={t('status')}>{drawer.run.status}</Descriptions.Item>
 <Descriptions.Item label={t('employees')}>{drawer.run.employee_count}</Descriptions.Item>
 <Descriptions.Item label={t('total_net')}>{(drawer.run.total_net || 0).toLocaleString()}</Descriptions.Item>
 </Descriptions>
 <DataTable rowKey="id" dataSource={drawer.payslips} columns={slipCols} stickyHeader={false} pagination={false} />
 </>
 )}
 </FormDialog>

 <FormDialog open={!!active} onClose={() => setActive(null)} hideFooter title={active?.employee_name || ''}>
 {active && (
 <DataTable
 rowKey={(r, i) => `${i}`}
 stickyHeader={false}
 pagination={false}
 dataSource={active.lines || []}
 columns={[
 { title: t('code'), dataIndex: 'code' },
 { title: t('name'), dataIndex: 'name' },
 { title: t('type'), dataIndex: 'type' },
 { title: t('amount'), dataIndex: 'amount', align: 'right' as const,
 render: (n: number) => <span style={{ color: n < 0 ? 'var(--danger-500)' : undefined }}>{n.toLocaleString()}</span> },
 ]}
 tableProps={{
 summary: () => (
 <Table.Summary.Row>
 <Table.Summary.Cell index={0} colSpan={3}><strong>{t('net')}</strong></Table.Summary.Cell>
 <Table.Summary.Cell index={3} align="right"><strong>{(active.net || 0).toLocaleString()}</strong></Table.Summary.Cell>
 </Table.Summary.Row>
 ),
 }}
 />
 )}
 </FormDialog>
 </div>
 );
}
