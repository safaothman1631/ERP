import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Space, Radio } from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from '../../utils/message';
import api from '../../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const WorkflowRunHistory: React.FC = () => {
 const { t } = useTranslation();
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const [runs, setRuns] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [detailOpen, setDetailOpen] = useState(false);
 const [selectedRun, setSelectedRun] = useState<any>(null);
 // Presentation-only client filter over the already-loaded runs (endpoint takes only `limit`).
 const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'failed'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('workflow_runs.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchRuns = async () => {
 if (!id) return;
 setLoading(true);
 try {
 const res = await api.get(`/api/automation/workflows/${id}/run-history`, { params: { limit: 50 } });
 setRuns(res.data.items || []);
 } catch {
 // message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchRuns();
 const interval = setInterval(() => {
 void fetchRuns();
 }, 5000);
 return () => clearInterval(interval);
 }, [id]);

 // Kit list tabs (All / Successful / Failed) — filtered client-side over loaded runs.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'ok', label: t('automation.status_ok', 'Successful') },
 { key: 'failed', label: t('automation.status_failed', 'Failed') },
 ];

 const filteredRuns = useMemo(() => {
 let result = runs;
 if (statusFilter === 'ok') result = result.filter((r) => r.status === 'ok');
 else if (statusFilter === 'failed') result = result.filter((r) => r.status !== 'ok');
 if (search) {
 const q = search.toLowerCase();
 result = result.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }
 return result;
 }, [runs, statusFilter, search]);

 const allColumns = [
 {
 title: t('automation.run_at'),
 dataIndex: 'ran_at',
 key: 'ran_at',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{new Date(v).toLocaleString()}</span>,
 },
 {
 title: t('automation.status'),
 dataIndex: 'status',
 key: 'status',
 render: (v: string) => <StatusTag status={v === 'ok' ? 'success' : 'error'} label={v} />,
 },
 {
 title: t('automation.duration'),
 dataIndex: 'duration_ms',
 key: 'duration_ms',
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{`${v || 0} ms`}</span>
 ),
 },
 {
 title: t('automation.nodes_executed'),
 dataIndex: 'trace',
 key: 'nodes_executed',
 render: (trace: any[]) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{trace?.length || 0}</span>
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 {
 key: 'view', icon: <EyeOutlined />, label: t('view', 'View'),
 onClick: () => { setSelectedRun(record); setDetailOpen(true); },
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
 pinned: c.key === 'ran_at' || c.key === 'actions',
 }));
 // CSV export keys mirror each column's dataIndex so cell values resolve correctly.
 const exportKeyFor = (key: string) => (key === 'nodes_executed' ? 'trace' : key);
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('workflow_runs.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('automation.run_history')}
 subtitle={t('automation.run_history_subtitle')}
 extra={
 <Space>
 <Button onClick={() => navigate(`/automation/workflows/${id}`)}>{t('back')}</Button>
 <Button icon={<ReloadOutlined />} onClick={fetchRuns}>
 {t('refresh')}
 </Button>
 </Space>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={statusFilter}
 onTabChange={(k) => setStatusFilter(k as typeof statusFilter)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusFilter !== 'all' ? 1 : 0}
 onClear={() => setStatusFilter('all')}
 >
 <Radio.Group
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="ok">{t('automation.status_ok', 'Successful')}</Radio>
 <Radio value="failed">{t('automation.status_failed', 'Failed')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('automation.status', 'Status')}
 anyLabel={t('all', 'All')}
 value={statusFilter === 'all' ? '' : statusFilter}
 onChange={(v) => setStatusFilter((v || 'all') as typeof statusFilter)}
 options={[
 { value: 'ok', label: t('automation.status_ok', 'Successful') },
 { value: 'failed', label: t('automation.status_failed', 'Failed') },
 ]}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta
 .filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions')
 .map((c) => ({ key: exportKeyFor(c.key), label: c.label }));
 downloadCsv('workflow_runs', filteredRuns, cols);
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
 <ResponsiveTableAdapter dataSource={filteredRuns} columns={columns} loading={loading} rowKey="id" />
 </KitListCard>

 <FormDialog
 title={t('automation.run_detail')}
 open={detailOpen}
 onClose={() => setDetailOpen(false)}
 >
 {selectedRun && (
 <div>
 <p><strong>{t('automation.run_at')}:</strong> {new Date(selectedRun.ran_at).toLocaleString()}</p>
 <p><strong>{t('automation.status')}:</strong> <StatusTag status={selectedRun.status === 'ok' ? 'success' : 'error'} label={selectedRun.status} /></p>
 <p><strong>{t('automation.duration')}:</strong> {selectedRun.duration_ms || 0} ms</p>

 {selectedRun.trigger_data && (
 <div style={{ marginTop: space.md }}>
 <h4>{t('automation.trigger_data')}:</h4>
 <pre style={{ background: 'var(--surface-2)', color: 'var(--ink-700)', padding: space.sm, borderRadius: 'var(--radius-md)' }}>
 {JSON.stringify(selectedRun.trigger_data, null, 2)}
 </pre>
 </div>
 )}

 {selectedRun.trace && (
 <div style={{ marginTop: space.md }}>
 <h4>{t('automation.trace')}:</h4>
 {selectedRun.trace.map((step: any, idx: number) => (
 <Card key={idx} style={{ marginBottom: space.sm }}>
 <p><strong>{t('automation.node_id')}:</strong> {step.node_id}</p>
 <p><strong>{t('automation.status')}:</strong> <StatusTag status={step.status === 'ok' ? 'success' : 'error'} label={step.status} /></p>
 {step.output && (
 <details>
 <summary>{t('automation.output')}</summary>
 <pre style={{ background: 'var(--surface-2)', color: 'var(--ink-700)', padding: space.xs, marginTop: space.xs, borderRadius: 'var(--radius-md)' }}>
 {JSON.stringify(step.output, null, 2)}
 </pre>
 </details>
 )}
 {step.error && (
 <p style={{ color: 'var(--danger-500)' }}><strong>{t('error')}:</strong> {step.error}</p>
 )}
 </Card>
 ))}
 </div>
 )}
 </div>
 )}
 </FormDialog>
 </div>
 );
};

export default WorkflowRunHistory;
