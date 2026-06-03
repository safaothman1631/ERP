import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Space, Input, Form, Select, InputNumber, Radio } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, StatusTag, KpiCard, SectionCard, KeyValueGrid, DataTable, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Project {
 id: string;
 name: string;
 client?: string;
 contract_value: number;
 start_date?: string;
 end_date?: string;
 status: string;
 created_at: string;
}

interface CostSummary {
 total_budget: number;
 total_actual: number;
 labor_cost: number;
 material_cost: number;
 equipment_cost: number;
 subcontract_cost: number;
 overhead_cost: number;
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

const ConstructionProjects: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Project[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [tab, setTab] = useState<'all' | 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'>('all');
 const [page, setPage] = useState(1);
 const [drawer, setDrawer] = useState(false);
 const [detailDrawer, setDetailDrawer] = useState(false);
 const [selectedProject, setSelectedProject] = useState<Project | null>(null);
 const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
 const [loadingCost, setLoadingCost] = useState(false);
 const [form] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('construction_projects.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/construction/projects', { params: { limit: 100 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchData();
 }, []);

 const handleCreate = async (values: any) => {
 try {
 await api.post('/api/construction/projects', values);
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleViewDetail = async (project: Project) => {
 setSelectedProject(project);
 setDetailDrawer(true);
 setLoadingCost(true);
 setCostSummary(null);
 try {
 const res = await api.get(`/api/construction/projects/${project.id}/cost-summary`);
 setCostSummary(res.data);
 } catch {
 message.error(t('construction.cost_summary_error'));
 } finally {
 setLoadingCost(false);
 }
 };

 const getStatusKind = (status: string): 'success' | 'warning' | 'error' | 'info' => {
 const map: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
 planning: 'info',
 in_progress: 'warning',
 on_hold: 'error',
 completed: 'success',
 cancelled: 'error',
 };
 return map[status] || 'info';
 };

 const getStatusTag = (status: string) => <StatusTag status={getStatusKind(status)} label={t(`construction.status_${status}`)} />;

 // Kit list tabs (All / Planning / In Progress / On Hold / Completed / Cancelled) — client-side filtered.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'planning', label: t('construction.status_planning') },
 { key: 'in_progress', label: t('construction.status_in_progress') },
 { key: 'on_hold', label: t('construction.status_on_hold') },
 { key: 'completed', label: t('construction.status_completed') },
 { key: 'cancelled', label: t('construction.status_cancelled') },
 ];

 const filteredData = useMemo(
 () =>
 data
 .filter((p) => (tab === 'all' ? true : p.status === tab))
 .filter(
 (p) =>
 !search ||
 p.name?.toLowerCase().includes(search.toLowerCase()) ||
 p.client?.toLowerCase().includes(search.toLowerCase())
 ),
 [data, tab, search]
 );

 const allColumns: any[] = [
 {
 title: t('construction.project_name'),
 dataIndex: 'name',
 key: 'name',
 width: 240,
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span
 style={{
 width: 28,
 height: 28,
 borderRadius: '50%',
 flexShrink: 0,
 background: 'var(--accent-soft)',
 color: 'var(--accent-500)',
 display: 'inline-flex',
 alignItems: 'center',
 justifyContent: 'center',
 fontSize: 11,
 fontWeight: 700,
 }}
 >
 {initialsOf(v)}
 </span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 </div>
 ),
 },
 {
 title: t('construction.client'),
 dataIndex: 'client',
 key: 'client',
 width: 180,
 render: (v: string) =>
 v ? (
 <span style={{ color: 'var(--ink-700)' }}>{v}</span>
 ) : (
 <span style={{ color: 'var(--ink-400)' }}>—</span>
 ),
 },
 {
 title: t('construction.start_date'),
 dataIndex: 'start_date',
 key: 'start_date',
 width: 130,
 render: (v: string) =>
 v ? (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 ) : (
 <span style={{ color: 'var(--ink-400)' }}>—</span>
 ),
 },
 {
 title: t('construction.end_date'),
 dataIndex: 'end_date',
 key: 'end_date',
 width: 130,
 render: (v: string) =>
 v ? (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 ) : (
 <span style={{ color: 'var(--ink-400)' }}>—</span>
 ),
 },
 {
 title: t('construction.budget'),
 dataIndex: 'contract_value',
 key: 'contract_value',
 width: 150,
 align: 'right' as const,
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {v.toLocaleString()}
 </span>
 ),
 },
 {
 title: t('construction.status'),
 dataIndex: 'status',
 key: 'status',
 width: 130,
 render: getStatusTag,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, rec: Project) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 {
 key: 'view',
 icon: <EyeOutlined />,
 label: t('construction.view_detail'),
 onClick: () => handleViewDetail(rec),
 },
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
 try { localStorage.setItem('construction_projects.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <>
 <PageHeader
 title={t('construction.title')}
 subtitle={t('construction.subtitle')}
 breadcrumb={[{ label: t('construction.title') }]}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawer(true)}>
 {t('construction.add_project')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as typeof tab); setPage(1); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => { setTab('all'); setPage(1); }}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => { setTab(e.target.value); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="planning">{t('construction.status_planning')}</Radio>
 <Radio value="in_progress">{t('construction.status_in_progress')}</Radio>
 <Radio value="on_hold">{t('construction.status_on_hold')}</Radio>
 <Radio value="completed">{t('construction.status_completed')}</Radio>
 <Radio value="cancelled">{t('construction.status_cancelled')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('construction.status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => { setTab((v || 'all') as typeof tab); setPage(1); }}
 options={[
 { value: 'planning', label: t('construction.status_planning') },
 { value: 'in_progress', label: t('construction.status_in_progress') },
 { value: 'on_hold', label: t('construction.status_on_hold') },
 { value: 'completed', label: t('construction.status_completed') },
 { value: 'cancelled', label: t('construction.status_cancelled') },
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
 downloadCsv('construction_projects', filteredData, cols);
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
 <DataTable<Project>
 columns={columns}
 dataSource={filteredData}
 rowKey="id"
 loading={loading}
 stickyHeader={false}
 pagination={{ current: page, pageSize: 20, onChange: setPage }}
 />
 </KitListCard>

 <FormDialog title={t('construction.add_project')} open={drawer} onClose={() => setDrawer(false)}>
 <Form form={form} layout="vertical" onFinish={handleCreate}>
 <Form.Item name="name" label={t('construction.project_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="client" label={t('construction.client')}>
 <Input />
 </Form.Item>
 <Form.Item name="contract_value" label={t('construction.budget')} initialValue={0}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="start_date" label={t('construction.start_date')}>
 <Input type="date" />
 </Form.Item>
 <Form.Item name="end_date" label={t('construction.end_date')}>
 <Input type="date" />
 </Form.Item>
 <Form.Item name="status" label={t('construction.status')} initialValue="planning">
 <Select>
 <Select.Option value="planning">{t('construction.status_planning')}</Select.Option>
 <Select.Option value="in_progress">{t('construction.status_in_progress')}</Select.Option>
 <Select.Option value="on_hold">{t('construction.status_on_hold')}</Select.Option>
 <Select.Option value="completed">{t('construction.status_completed')}</Select.Option>
 <Select.Option value="cancelled">{t('construction.status_cancelled')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item>
 <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
 <Button onClick={() => setDrawer(false)}>{t('cancel')}</Button>
 <Button type="primary" htmlType="submit">
 {t('save')}
 </Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={selectedProject?.name}
 open={detailDrawer}
 onClose={() => setDetailDrawer(false)}
 >
 {selectedProject && (
 <Space direction="vertical" size="large" style={{ width: '100%' }}>
 <SectionCard title={t('construction.project_info')}>
 <KeyValueGrid
 columns={2}
 items={[
 { label: t('construction.client'), value: selectedProject.client || '—' },
 { label: t('construction.status'), value: <StatusTag status={getStatusKind(selectedProject.status)} label={t(`construction.status_${selectedProject.status}`)} /> },
 { label: t('construction.start_date'), value: selectedProject.start_date || '—' },
 { label: t('construction.end_date'), value: selectedProject.end_date || '—' },
 ]}
 />
 </SectionCard>

 <SectionCard title={t('construction.cost_summary')}>
 {costSummary ? (
 <Space direction="vertical" size="middle" style={{ width: '100%' }}>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
 <KpiCard
 title={t('construction.total_budget')}
 value={costSummary.total_budget.toLocaleString()}
 currency="IQD"
 />
 <KpiCard
 title={t('construction.total_actual')}
 value={costSummary.total_actual.toLocaleString()}
 currency="IQD"
 delta={
 costSummary.total_budget > 0
 ? ((costSummary.total_actual / costSummary.total_budget - 1) * 100)
 : 0
 }
 trendLabel={t('construction.vs_budget')}
 />
 </div>
 <KeyValueGrid
 columns={2}
 items={[
 { label: t('construction.labor_cost'), value: `${costSummary.labor_cost.toLocaleString()} IQD` },
 { label: t('construction.material_cost'), value: `${costSummary.material_cost.toLocaleString()} IQD` },
 { label: t('construction.equipment_cost'), value: `${costSummary.equipment_cost.toLocaleString()} IQD` },
 { label: t('construction.subcontract_cost'), value: `${costSummary.subcontract_cost.toLocaleString()} IQD` },
 { label: t('construction.overhead_cost'), value: `${costSummary.overhead_cost.toLocaleString()} IQD`, span: 2 },
 ]}
 />
 </Space>
 ) : (
 <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-400)' }}>
 {loadingCost ? t('loading') : '—'}
 </div>
 )}
 </SectionCard>
 </Space>
 )}
 </FormDialog>
 </>
 );
};

export default ConstructionProjects;
