import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, DatePicker, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitSearchInput from '../../design-system/KitSearchInput';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ListWithEmptyState } from '../../design-system/empty/ListWithEmptyState';

interface CAPA {
 id: string;
 title: string;
 root_cause?: string;
 corrective_action?: string;
 preventive_action?: string;
 assigned_to?: string;
 due_date?: string;
 status?: string;
 non_conformity_id?: string;
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

const CAPAList: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<CAPA[]>([]);
 const [loading, setLoading] = useState(false);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [tab, setTab] = useState<'all' | 'open' | 'closed'>('all');
 const [search, setSearch] = useState('');
 const [form] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('capa.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/quality/capa', { params: { limit: 200 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, []);

 // Client-side status segments + search over the already-loaded data (presentation only).
 const statusOf = (s?: string) => (s === 'closed' ? 'closed' : 'open');
 const filteredData = useMemo(() => {
 let rows = tab === 'all' ? data : data.filter((r) => statusOf(r.status) === tab);
 if (search) {
 const q = search.toLowerCase();
 rows = rows.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }
 return rows;
 }, [data, tab, search]);

 // Kit list tabs (All / Open / Closed) — client-side filtered.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'open', label: t('quality.open') },
 { key: 'closed', label: t('quality.closed') },
 ];

 const handleSave = async (values: any) => {
 try {
 const payload = { ...values };
 if (values.due_date) {
 payload.due_date = values.due_date.format('YYYY-MM-DD');
 }
 if (editingId) {
 await api.patch(`/api/quality/capa/${editingId}`, payload);
 message.success(t('success'));
 } else {
 await api.post('/api/quality/capa', payload);
 message.success(t('quality.capa_created'));
 }
 setDrawerOpen(false);
 form.resetFields();
 setEditingId(null);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (record: CAPA) => {
 setEditingId(record.id);
 const vals = { ...record };
 if (vals.due_date) {
 (vals as any).due_date = dayjs(vals.due_date);
 }
 form.setFieldsValue(vals);
 setDrawerOpen(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: CAPA) => {
 setEditingId(null);
 const { id: _id, status: _status, ...rest } = record;
 const vals: any = { ...rest, title: `${record.title ?? ''} (${t('copy', 'copy')})` };
 if (vals.due_date) {
 vals.due_date = dayjs(vals.due_date);
 }
 form.setFieldsValue(vals);
 setDrawerOpen(true);
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/quality/capa/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleClose = async (id: string) => {
 try {
 await api.post(`/api/quality/capa/${id}/close`);
 message.success(t('quality.capa_closed'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const allColumns = [
 {
 title: t('quality.title'),
 dataIndex: 'title',
 key: 'title',
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
 title: t('quality.root_cause'),
 dataIndex: 'root_cause',
 key: 'root_cause',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('quality.assigned_to'),
 dataIndex: 'assigned_to',
 key: 'assigned_to',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('quality.due_date'),
 dataIndex: 'due_date',
 key: 'due_date',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{new Date(v).toLocaleDateString()}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (v: string) => {
 if (v === 'closed') return <StatusTag status="success" label={t('quality.closed')} />;
 return <StatusTag status="warning" label={t('quality.open')} />;
 },
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: CAPA) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 ...(record.status !== 'closed'
 ? [{ key: 'close', icon: <CheckCircleOutlined />, label: t('quality.close'), onClick: () => handleClose(record.id) }]
 : []),
 { type: 'divider' as const },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'title' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('capa.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('quality.capa')}
 subtitle={t('quality.capa_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditingId(null);
 form.resetFields();
 setDrawerOpen(true);
 }}
 >
 {t('quality.new_capa')}
 </Button>
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
 {/* Group Filters + Status in a single flex unit so they ALWAYS wrap together. */}
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
 <Radio value="open">{t('quality.open')}</Radio>
 <Radio value="closed">{t('quality.closed')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => setTab((v || 'all') as typeof tab)}
 options={[
 { value: 'open', label: t('quality.open') },
 { value: 'closed', label: t('quality.closed') },
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
 downloadCsv('capa', filteredData, cols);
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
 <ListWithEmptyState
 entity="capa"
 data={filteredData}
 loading={loading}
 onCreate={() => {
 setEditingId(null);
 form.resetFields();
 setDrawerOpen(true);
 }}
 onRetry={fetchData}
 render={(rows) => (
 <ResponsiveTableAdapter
 dataSource={rows}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 )}
 />
 </KitListCard>
 <FormDialog
 title={editingId ? t('quality.edit_capa') : t('quality.new_capa')}
 open={drawerOpen}
 onClose={() => {
 setDrawerOpen(false);
 form.resetFields();
 setEditingId(null);
 }}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item
 name="title"
 label={t('quality.title')}
 rules={[{ required: true, message: t('required') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item name="non_conformity_id" label={t('quality.ncr_id')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="root_cause" label={t('quality.root_cause')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="corrective_action" label={t('quality.corrective_action')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="preventive_action" label={t('quality.preventive_action')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="assigned_to" label={t('quality.assigned_to')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="due_date" label={t('quality.due_date')}>
 <DatePicker style={{ width: '100%' }} />
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

export default CAPAList;
