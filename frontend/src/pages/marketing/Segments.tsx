import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, Select } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, SectionCard, type ColumnVisibilityItem } from '../../design-system';
import KitListCard from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const Segments: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [search, setSearch] = useState('');
 const [loading, setLoading] = useState(false);
 const [createModal, setCreateModal] = useState(false);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [previewModal, setPreviewModal] = useState<string | null>(null);
 const [previewData, setPreviewData] = useState<any[]>([]);
 const [previewLoading, setPreviewLoading] = useState(false);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('segments.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/marketing/audiences');
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

 const handleCreate = async (values: any) => {
 setSaving(true);
 try {
 await api.post('/api/marketing/audiences', values);
 message.success(t('success'));
 setCreateModal(false);
 form.resetFields();
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/marketing/audiences/${id}`);
 message.success(t('deleted'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handlePreview = async (id: string) => {
 setPreviewModal(id);
 setPreviewLoading(true);
 try {
 const res = await api.get(`/api/marketing/audiences/${id}/preview`);
 setPreviewData(res.data.members || []);
 } catch {
 message.error(t('error'));
 } finally {
 setPreviewLoading(false);
 }
 };

 const allColumns: any[] = [
 {
 title: t('marketing.name'), dataIndex: 'name', key: 'name',
 render: (v: string) => (
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 ),
 },
 {
 title: t('marketing.source'),
 dataIndex: 'source',
 key: 'source',
 render: (val: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{val || 'contacts'}</span>
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, rec: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('marketing.preview'), onClick: () => handlePreview(rec.id) },
 { type: 'divider' },
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
 try { localStorage.setItem('segments.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);

 const previewColumns: any[] = [
 { title: t('marketing.name'), dataIndex: 'name', key: 'name' },
 {
 title: t('marketing.email'), dataIndex: 'email', key: 'email',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('marketing.segments')}
 subtitle={t('marketing.segments_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
 {t('create')}
 </Button>
 }
 />

 <KitListCard
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('segments', data, cols);
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
 title={t('marketing.create_segment')}
 open={createModal}
 onClose={() => setCreateModal(false)} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleCreate}>
 <Form.Item name="name" label={t('marketing.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="source" label={t('marketing.source')} initialValue="contacts">
 <Select
 options={[
 { label: t('contacts'), value: 'contacts' },
 { label: t('leads'), value: 'leads' },
 { label: t('marketing.manual'), value: 'manual' },
 ]}
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
 title={t('marketing.segment_preview')}
 open={!!previewModal}
 onClose={() => setPreviewModal(null)} hideFooter
 >
 <SectionCard>
 <p>
 {t('marketing.total_members')}: <strong>{previewData.length}</strong>
 </p>
 <ResponsiveTableAdapter
 columns={previewColumns}
 dataSource={previewData}
 rowKey="id"
 loading={previewLoading}
 pagination={{ pageSize: 10 }}
 />
 </SectionCard>
 </FormDialog>
 </div>
 );
};

export default Segments;
