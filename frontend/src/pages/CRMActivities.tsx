import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, Space, message, Radio, Row, Col } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, PhoneOutlined, MailOutlined, CalendarOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, UnorderedListOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, DataTable, KpiCard, StatusTag, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import type { ColumnDef } from '../design-system/DataTable';
import { downloadCsv } from '../utils/exportCsv';
import { FormDialog } from '../components/responsive/FormDialog';

interface Activity {
 id: string;
 type: string;
 summary: string;
 due_date?: string;
 status?: string;
 lead_id?: string;
 opportunity_id?: string;
 duration_minutes?: number;
}

const TYPES = ['call', 'email', 'meeting', 'task'];

const typeIcon = (t: string) => {
 switch (t) {
 case 'call': return <PhoneOutlined />;
 case 'email': return <MailOutlined />;
 case 'meeting': return <CalendarOutlined />;
 default: return <FileTextOutlined />;
 }
};

export default function CRMActivities() {
 const { t } = useTranslation();
 const [items, setItems] = useState<Activity[]>([]);
 const [loading, setLoading] = useState(false);
 const [open, setOpen] = useState(false);
 const [form] = Form.useForm();
 const [filterStatus, setFilterStatus] = useState<string>('pending');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('crmActivities.hiddenCols') || '[]'); } catch { return []; }
 });

 const load = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/crm/activities', { params: { status: filterStatus || undefined } });
 setItems(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { load();   }, [filterStatus]);

 const onCreate = async () => {
 const v = await form.validateFields();
 try {
 await api.post('/api/crm/activities', v);
 message.success(t('saved'));
 setOpen(false);
 form.resetFields();
 load();
 } catch { message.error(t('error')); }
 };

 const onDone = async (id: string) => {
 try {
 await api.put(`/api/crm/activities/${id}/done`);
 load();
 } catch { message.error(t('error')); }
 };

 const onCancel = async (id: string) => {
 try {
 await api.delete(`/api/crm/activities/${id}`);
 load();
 } catch { message.error(t('error')); }
 };

 const counts = {
 total: items.length,
 pending: items.filter((i) => i.status === 'pending').length,
 done: items.filter((i) => i.status === 'done').length,
 };

 // Kit list tabs (All / Pending / Done) — server-side filtered via the `status` param.
 const tabs: KitListTab[] = [
 { key: '', label: t('all', 'All') },
 { key: 'pending', label: t('pending', 'Pending') },
 { key: 'done', label: t('done', 'Done') },
 ];

 const columns: ColumnDef<Activity>[] = [
 {
 title: t('type'), dataIndex: 'type', key: 'type',
 render: (v: string) => (
 <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-700)' }}>
 <span style={{ color: 'var(--ink-500)' }}>{typeIcon(v)}</span>
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(v, v)}</span>
 </span>
 ),
 },
 {
 title: t('summary'), dataIndex: 'summary', key: 'summary',
 render: (v: string) => <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>,
 },
 {
 title: t('due_date'), dataIndex: 'due_date', key: 'due_date',
 render: (v?: string) => v
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 render: (s?: string) => <StatusTag status={s || 'pending'} label={t(s || 'pending')} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, r: Activity) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'done', icon: <CheckOutlined />, label: t('mark_done'), disabled: r.status === 'done', onClick: () => onDone(r.id) },
 { type: 'divider' },
 { key: 'cancel', icon: <CloseOutlined />, label: t('cancel'), danger: true, onClick: () => onCancel(r.id) },
 ]}
 />
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'summary' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('crmActivities.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const filteredData = useMemo(() => {
 if (!search) return items;
 const q = search.toLowerCase();
 return items.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [items, search]);

 return (
 <div>
 <PageHeader
 title={t('activities')}
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('new_activity')}</Button>
 </Space>
 }
 />

 <Row gutter={[16, 16]} style={{ marginBottom: 'var(--space-lg)' }}>
 <Col xs={24} sm={8}><KpiCard title={t('total')} value={counts.total} icon={<UnorderedListOutlined />} tone="primary" /></Col>
 <Col xs={24} sm={8}><KpiCard title={t('pending')} value={counts.pending} icon={<ClockCircleOutlined />} tone="info" /></Col>
 <Col xs={24} sm={8}><KpiCard title={t('done')} value={counts.done} icon={<CheckCircleOutlined />} tone="success" /></Col>
 </Row>

 <KitListCard
 tabs={tabs}
 activeTab={filterStatus}
 onTabChange={(k) => setFilterStatus(k)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={filterStatus ? 1 : 0}
 onClear={() => setFilterStatus('')}
 >
 <Radio.Group
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 <Radio value="pending">{t('pending', 'Pending')}</Radio>
 <Radio value="done">{t('done', 'Done')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={filterStatus}
 onChange={(v) => setFilterStatus(v)}
 options={[
 { value: 'pending', label: t('pending', 'Pending') },
 { value: 'done', label: t('done', 'Done') },
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
 downloadCsv('crm-activities', items, cols);
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
 <DataTable rowKey="id" loading={loading} dataSource={filteredData} columns={visibleColumns} pagination={{ pageSize: 20 }} />
 </KitListCard>

 <FormDialog title={t('new_activity')} open={open} onClose={() => setOpen(false)} onOk={onCreate}>
 <Form form={form} layout="vertical" initialValues={{ type: 'call' }}>
 <Form.Item name="type" label={t('type')} rules={[{ required: true }]}>
 <Select options={TYPES.map((x) => ({ value: x, label: x }))} />
 </Form.Item>
 <Form.Item name="summary" label={t('summary')} rules={[{ required: true }]}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="due_date" label={t('due_date')}>
 <Input placeholder="YYYY-MM-DD" />
 </Form.Item>
 <Form.Item name="lead_id" label={t('lead_id')}>
 <Input />
 </Form.Item>
 <Form.Item name="opportunity_id" label={t('opportunity_id')}>
 <Input />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
