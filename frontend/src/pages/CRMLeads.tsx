import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import ExportButton from '../components/ExportButton';
import ChatterWidget from '../components/chatter/ChatterWidget';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space as spaceTk } from '../theme/tokens';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface Lead {
 id: string;
 name: string;
 email?: string;
 phone?: string;
 company?: string;
 source?: string;
 stage_id?: string;
 expected_revenue?: number;
 probability?: number;
 status?: string;
}

interface Stage { id: string; name: string; color?: string; }

const SOURCES = ['website', 'referral', 'event', 'cold_call', 'import', 'whatsapp', 'other'];

export default function CRMLeads() {
 const { t } = useTranslation();
 const [stages, setStages] = useState<Stage[]>([]);
 const [createOpen, setCreateOpen] = useState(false);
 const [convertOpen, setConvertOpen] = useState<Lead | null>(null);
 const [viewLead, setViewLead] = useState<Lead | null>(null);
 const [createForm] = Form.useForm();
 const [convertForm] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('crmLeads.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const leadsQuery = useListQuery<Lead, { items?: Lead[]; total?: number }>({
 queryKey: listQueryKeys.crmLeads({ page_size: 200 }),
 queryFn: () => api.get('/api/crm/leads', { params: { page_size: 200 } }),
 });
 const leads = leadsQuery.data?.items ?? [];
 const loading = leadsQuery.isLoading || leadsQuery.isFetching;

 const loadStages = async () => {
 try {
 const s = await api.get('/api/crm/stages');
 setStages(s.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 const load = async () => {
 await Promise.all([leadsQuery.refetch(), loadStages()]);
 };

 useEffect(() => { void loadStages(); }, []);

 const onCreate = async () => {
 const v = await createForm.validateFields();
 try {
 await api.post('/api/crm/leads', v);
 message.success(t('saved'));
 setCreateOpen(false);
 createForm.resetFields();
 await leadsQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const onConvert = async () => {
 if (!convertOpen) return;
 const v = await convertForm.validateFields();
 try {
 await api.post(`/api/crm/leads/${convertOpen.id}/convert`, v);
 message.success(t('converted'));
 setConvertOpen(null);
 convertForm.resetFields();
 await leadsQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const onArchive = async (id: string) => {
 try {
 await api.delete(`/api/crm/leads/${id}`);
 await leadsQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const stageName = (id?: string) => stages.find((s) => s.id === id)?.name || '—';

 const columns = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('company'), dataIndex: 'company', key: 'company' },
 { title: t('email'), dataIndex: 'email', key: 'email' },
 { title: t('phone'), dataIndex: 'phone', key: 'phone' },
 { title: t('source'), dataIndex: 'source', key: 'source' },
 { title: t('stage'), key: 'stage_id', render: (_: unknown, r: Lead) => stageName(r.stage_id) },
 { title: t('expected_revenue'), dataIndex: 'expected_revenue', key: 'expected_revenue', align: 'right' as const },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (s?: string) => <Tag color={s === 'converted' ? 'green' : s === 'archived' ? 'default' : 'blue'}>{s || 'open'}</Tag>,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: unknown, r: Lead) => (
 <Space>
 <Button onClick={() => setViewLead(r)}>{t('view')}</Button>
 <Button
 icon={<SwapOutlined />}
 disabled={r.status === 'converted'}
 onClick={() => { setConvertOpen(r); convertForm.setFieldsValue({ amount: r.expected_revenue || 0, probability: r.probability || 50 }); }}
 >
 {t('convert')}
 </Button>
 <Popconfirm title={t('confirm_archive')} onConfirm={() => onArchive(r.id)}>
 <Button danger>{t('archive')}</Button>
 </Popconfirm>
 </Space>
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('crmLeads.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('leads')}
 subtitle={t('leads_subtitle', 'Sales pipeline leads')}
 sectionId="crm.leads"
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <ExportButton endpoint="/api/export/customers" filename="leads" />
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
 {t('new_lead')}
 </Button>
 </Space>
 }
 />

 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spaceTk.md }}>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('crm-leads', leads, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </div>
 <ResponsiveTableAdapter rowKey="id" loading={loading} dataSource={leads} columns={visibleColumns} pagination={{ pageSize: 20 }} />

 <FormDialog
 title={viewLead?.name || t('lead')}
 open={!!viewLead}
 onClose={() => setViewLead(null)}
 hideFooter
 >
 {viewLead?.id && <ChatterWidget entityType="lead" entityId={viewLead.id} />}
 </FormDialog>

 <FormDialog
 title={t('new_lead')}
 open={createOpen}
 onClose={() => setCreateOpen(false)}
 onOk={onCreate}
 >
 <Form form={createForm} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item name="company" label={t('company')}><Input /></Form.Item>
 <Form.Item name="email" label={t('email')}><Input /></Form.Item>
 <Form.Item name="phone" label={t('phone')}><Input /></Form.Item>
 <Form.Item name="source" label={t('source')}>
 <Select options={SOURCES.map((s) => ({ value: s, label: s }))} allowClear />
 </Form.Item>
 <Form.Item name="stage_id" label={t('stage')}>
 <Select options={stages.map((s) => ({ value: s.id, label: s.name }))} allowClear />
 </Form.Item>
 <Form.Item name="expected_revenue" label={t('expected_revenue')}>
 <InputNumber style={{ width: '100%' }} min={0} />
 </Form.Item>
 <Form.Item name="probability" label={t('probability')}>
 <InputNumber style={{ width: '100%' }} min={0} max={100} />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('convert_to_opportunity')}
 open={!!convertOpen}
 onClose={() => setConvertOpen(null)}
 onOk={onConvert}
 >
 <Form form={convertForm} layout="vertical" initialValues={{ amount: 0, probability: 50 }}>
 <Form.Item name="amount" label={t('amount')}>
 <InputNumber style={{ width: '100%' }} min={0} />
 </Form.Item>
 <Form.Item name="probability" label={t('probability')}>
 <InputNumber style={{ width: '100%' }} min={0} max={100} />
 </Form.Item>
 <Form.Item name="close_date" label={t('close_date')}>
 <Input placeholder="YYYY-MM-DD" />
 </Form.Item>
 <Form.Item name="stage_id" label={t('stage')}>
 <Select options={stages.map((s) => ({ value: s.id, label: s.name }))} allowClear />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
