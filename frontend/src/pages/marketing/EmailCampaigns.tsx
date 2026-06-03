import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, Select, Row, Col, Radio } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, SendOutlined, EyeOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, KpiCard, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { formatDate } from '../../utils/formatters';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { TextArea } = Input;

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const EmailCampaigns: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [createModal, setCreateModal] = useState(false);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [audiences, setAudiences] = useState<any[]>([]);
 const [statsDrawer, setStatsDrawer] = useState<string | null>(null);
 const [stats, setStats] = useState<any>(null);
 const [statsLoading, setStatsLoading] = useState(false);
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('campaigns.hiddenCols') || '[]'); } catch { return []; }
 });

 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);

 const fetchData = async (status?: string) => {
 setLoading(true);
 try {
 const res = await api.get('/api/marketing/campaigns', {
 params: status ? { status } : {},
 });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchAudiences = async () => {
 try {
 const res = await api.get('/api/marketing/audiences');
 setAudiences(res.data.items || []);
 } catch { /* noop */ }
 };

 useEffect(() => {
 fetchData(statusFilter || undefined);
 }, [statusFilter]);

 useEffect(() => {
 fetchAudiences();
 }, []);

 const handleCreate = async (values: any) => {
 setSaving(true);
 try {
 await api.post('/api/marketing/campaigns', values);
 message.success(t('success'));
 setCreateModal(false);
 form.resetFields();
 fetchData(statusFilter || undefined);
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleSend = async (id: string) => {
 try {
 await api.post(`/api/marketing/campaigns/${id}/send`);
 message.success(t('marketing.campaign_sent'));
 fetchData(statusFilter || undefined);
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/marketing/campaigns/${id}`);
 message.success(t('deleted'));
 fetchData(statusFilter || undefined);
 } catch {
 message.error(t('error'));
 }
 };

 const handleClone = async (record: any) => {
 try {
 await api.post('/api/marketing/campaigns', {
 name: `${record.name} (نووسخە)`,
 subject: record.subject,
 body_html: record.body_html,
 audience_id: record.audience_id,
 });
 message.success(t('marketing.campaign_cloned'));
 fetchData(statusFilter || undefined);
 } catch {
 message.error(t('error'));
 }
 };

 const handleViewStats = async (id: string) => {
 setStatsDrawer(id);
 setStatsLoading(true);
 try {
 const res = await api.get(`/api/marketing/campaigns/${id}/stats`);
 setStats(res.data);
 } catch {
 message.error(t('error'));
 } finally {
 setStatsLoading(false);
 }
 };

 // Kit list tabs (All / Drafts / Sent) — wired to the server `status` filter param.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'draft', label: t('marketing.status_draft', 'Draft') },
 { key: 'sent', label: t('marketing.status_sent', 'Sent') },
 ];

 const statusOptions = [
 { value: 'draft', label: t('marketing.status_draft', 'Draft') },
 { value: 'sent', label: t('marketing.status_sent', 'Sent') },
 ];

 const allColumns: any[] = [
 {
 title: t('marketing.name'), dataIndex: 'name', key: 'name',
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
 title: t('marketing.subject'), dataIndex: 'subject', key: 'subject',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('marketing.status'), dataIndex: 'status', key: 'status',
 render: (v: string) => v
 ? <StatusTag status={v} label={t(`marketing.status_${v}`, v)} />
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('marketing.sent_at'),
 dataIndex: 'sent_at',
 key: 'sent_at',
 render: (val: string) => val
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{formatDate(val)}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('marketing.recipients'),
 dataIndex: 'recipient_count',
 key: 'recipient_count',
 render: (val: number) => (
 <span style={{ color: 'var(--ink-900)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{val || 0}</span>
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, rec: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('marketing.stats'), onClick: () => handleViewStats(rec.id) },
 ...(rec.status === 'draft'
 ? [{ key: 'send', icon: <SendOutlined />, label: t('marketing.send_now'), onClick: () => handleSend(rec.id) }]
 : []),
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleClone(rec) },
 { type: 'divider' as const },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(rec.id) },
 ]}
 />
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('campaigns.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('marketing.email_campaigns')}
 subtitle={t('marketing.email_campaigns_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
 {t('create')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={statusFilter || 'all'}
 onTabChange={(k) => setStatusFilter(k === 'all' ? '' : k)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
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
 <Radio value="draft">{t('marketing.status_draft', 'Draft')}</Radio>
 <Radio value="sent">{t('marketing.status_sent', 'Sent')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('marketing.status', 'Status')}
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
 downloadCsv('campaigns', data, cols);
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
 <ResponsiveTableAdapter columns={columns} dataSource={filteredData} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
 </KitListCard>

 <FormDialog
 title={t('marketing.create_campaign')}
 open={createModal}
 onClose={() => setCreateModal(false)} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleCreate}>
 <Form.Item name="name" label={t('marketing.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="subject" label={t('marketing.subject')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="body_html" label={t('marketing.body')}>
 <TextArea rows={6} />
 </Form.Item>
 <Form.Item name="audience_id" label={t('marketing.audience')}>
 <Select
 options={audiences.map((a) => ({ label: a.name, value: a.id }))}
 placeholder={t('select')}
 />
 </Form.Item>
 <Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>
 {t('create')}
 </Button>
 <Button onClick={() => setCreateModal(false)}>{t('cancel')}</Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('marketing.campaign_stats')}
 open={!!statsDrawer}
 onClose={() => setStatsDrawer(null)}
 >
 {statsLoading ? (
 <div>{t('loading')}</div>
 ) : stats ? (
 <Row gutter={[16, 16]}>
 <Col span={12}>
 <KpiCard title={t('marketing.sent')} value={stats.sent} />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.delivered')} value={stats.delivered} tone="success" />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.opened')} value={stats.opened} tone="info" />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.clicked')} value={stats.clicked} tone="info" />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.bounced')} value={stats.bounced} tone="warning" />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.unsubscribed')} value={stats.unsubscribed} tone="danger" />
 </Col>
 </Row>
 ) : null}
 </FormDialog>
 </div>
 );
};

export default EmailCampaigns;
