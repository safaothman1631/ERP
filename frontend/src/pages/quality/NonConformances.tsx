import React, { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Space, Form, Input, Select, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import type { StatusKind } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface NCR {
 id: string;
 title: string;
 description: string;
 severity: string;
 product_id?: string;
 detected_in?: string;
 quantity_affected?: number;
 capa_id?: string;
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

const NonConformances: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<NCR[]>([]);
 const [loading, setLoading] = useState(false);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 // Client-side severity segment (data is fully loaded; no server filter param exists).
 const [severity, setSeverity] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('ncr.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/quality/non-conformities', { params: { limit: 200 } });
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

 const handleSave = async (values: any) => {
 try {
 if (editingId) {
 await api.patch(`/api/quality/non-conformities/${editingId}`, values);
 message.success(t('success'));
 } else {
 await api.post('/api/quality/non-conformities', values);
 message.success(t('quality.ncr_created'));
 }
 setDrawerOpen(false);
 form.resetFields();
 setEditingId(null);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (record: NCR) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setDrawerOpen(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: NCR) => {
 setEditingId(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({ ...rest, title: `${record.title ?? ''} (${t('copy', 'copy')})` });
 setDrawerOpen(true);
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/quality/non-conformities/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const severityKind = (sev: string): StatusKind => {
 if (sev === 'critical') return 'error';
 if (sev === 'high') return 'warning';
 if (sev === 'medium') return 'warning';
 return 'default';
 };

 // Severity segments (client-side over the already-loaded rows).
 const severityOptions = [
 { value: 'low', label: t('quality.severity_low') },
 { value: 'medium', label: t('quality.severity_medium') },
 { value: 'high', label: t('quality.severity_high') },
 { value: 'critical', label: t('quality.severity_critical') },
 ];
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...severityOptions.map((o) => ({ key: o.value, label: o.label })),
 ];
 const filteredData = useMemo(() => {
 const bySeverity = severity === 'all' ? data : data.filter((r) => r.severity === severity);
 if (!search) return bySeverity;
 const q = search.toLowerCase();
 return bySeverity.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }, [data, severity, search]);

 const allColumns: ColumnsType<NCR> = [
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
 title: t('quality.severity'),
 dataIndex: 'severity',
 key: 'severity',
 render: (v) => <StatusTag status={severityKind(v)} label={t(`quality.severity_${v}`)} />,
 },
 {
 title: t('quality.product'),
 dataIndex: 'product_id',
 key: 'product_id',
 render: (v) => (v
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>),
 },
 {
 title: t('quality.detected_in'),
 dataIndex: 'detected_in',
 key: 'detected_in',
 render: (v) => (v
 ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>),
 },
 {
 title: t('quality.quantity_affected'),
 dataIndex: 'quantity_affected',
 key: 'quantity_affected',
 render: (v) => (
 <span style={{ color: 'var(--ink-900)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{v || 0}</span>
 ),
 },
 {
 title: t('quality.capa_linked'),
 dataIndex: 'capa_id',
 key: 'capa_id',
 render: (v) => (v
 ? <StatusTag status="info" icon={<LinkOutlined />} label={t('yes')} />
 : <span style={{ color: 'var(--ink-400)' }}>—</span>),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_, record) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'title' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('ncr.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('quality.non_conformances')}
 subtitle={t('quality.ncr_subtitle')}
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
 {t('quality.new_ncr')}
 </Button>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={severity}
 onTabChange={(k) => setSeverity(k as typeof severity)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={severity !== 'all' ? 1 : 0}
 onClear={() => setSeverity('all')}
 >
 <Radio.Group
 value={severity}
 onChange={(e) => setSeverity(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 {severityOptions.map((o) => (
 <Radio key={o.value} value={o.value}>{o.label}</Radio>
 ))}
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('quality.severity')}
 anyLabel={t('all', 'All')}
 value={severity === 'all' ? '' : severity}
 onChange={(v) => setSeverity((v || 'all') as typeof severity)}
 options={severityOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('non-conformances', filteredData, cols);
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
 title={editingId ? t('quality.edit_ncr') : t('quality.new_ncr')}
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
 <Form.Item
 name="description"
 label={t('quality.description')}
 rules={[{ required: true, message: t('required') }]}
 >
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item
 name="severity"
 label={t('quality.severity')}
 initialValue="medium"
 rules={[{ required: true }]}
 >
 <Select>
 <Select.Option value="low">{t('quality.severity_low')}</Select.Option>
 <Select.Option value="medium">{t('quality.severity_medium')}</Select.Option>
 <Select.Option value="high">{t('quality.severity_high')}</Select.Option>
 <Select.Option value="critical">{t('quality.severity_critical')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="product_id" label={t('quality.product')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="detected_in" label={t('quality.detected_in')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="quantity_affected" label={t('quality.quantity_affected')} initialValue={0}>
 <Input type="number" />
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

export default NonConformances;
