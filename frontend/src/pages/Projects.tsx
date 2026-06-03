import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Space } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, BarChartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { PageHeader, DataTable, StatusTag, type ColumnVisibilityItem } from '../design-system';
import type { ColumnDef } from '../design-system/DataTable';
import KitListCard from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { FormDialog } from '../components/responsive/FormDialog';

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const Projects: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState('');
 const [modal, setModal] = useState(false);
 const [_contacts, setContacts] = useState<any[]>([]);
 const [form] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('projects.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/projects', { params: { page, page_size: 20 } });
 setData(res.data.items); setTotal(res.data.total);
 } catch { message.error(t('error')); } finally { setLoading(false); }
 };

 useEffect(() => { fetchData(); }, [page]);
 useEffect(() => {
 api.get('/api/contacts', { params: { page_size: 100 } }).then(r => setContacts(r.data.items || []));
 }, []);

 const handleSave = async (values: any) => {
 try {
 await api.post('/api/projects', values);
 message.success(t('success'));
 setModal(false); form.resetFields(); fetchData();
 } catch { message.error(t('error')); }
 };

 // Kit cell renderers — avatar+name, status chip (StatusTag), muted description.
 const allColumns: ColumnDef<any>[] = [
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
 { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={s} label={t(s)} /> },
 {
 title: t('description'), dataIndex: 'description', key: 'description',
 render: (v: string) => <span style={{ color: 'var(--ink-600)' }}>{v || '—'}</span>,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'gantt', icon: <BarChartOutlined />, label: t('gantt'), onClick: () => navigate(`/projects/${record.id}/gantt`) },
 ]}
 />
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, t]);
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('projects.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('projects')}
 subtitle={t('projects_subtitle', 'Projects and timesheets')}
 helpKey="projects"
 sectionId="projects.list"
 extra={
 <Space>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }}>{t('new_project')}</Button>
 </Space>
 }
 />

 <KitListCard
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPage(1); }}
 placeholder={t('search')}
 />
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('projects', data, cols);
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
 <DataTable dataSource={filteredData} columns={columns} rowKey="id" loading={loading} pagination={{ current: page, total: search ? filteredData.length : total, pageSize: 20, onChange: setPage }} />
 </KitListCard>

 <FormDialog title={t('new_project')} open={modal} onClose={() => setModal(false)} onOk={() => form.submit()}>
 <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ status: 'active', billing_method: 'fixed_cost' }}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item label={t('description')} name="description"><Input.TextArea rows={2} /></Form.Item>
 <Form.Item label={t('customer')} name="contact_id">
 <SelectWithQuickCreate entity="customer" showSearch allowClear />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Projects;
