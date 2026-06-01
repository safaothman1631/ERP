import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, Space, message, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, PhoneOutlined, MailOutlined, CalendarOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, FilterBar, DataTable, KpiCard, StatusTag, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import type { ColumnDef } from '../design-system/DataTable';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';
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
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('crmActivities.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

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

 const columns: ColumnDef<Activity>[] = [
 { title: t('type'), dataIndex: 'type', key: 'type', render: (v: string) => <Space>{typeIcon(v)} {v}</Space> },
 { title: t('summary'), dataIndex: 'summary', key: 'summary' },
 { title: t('due_date'), dataIndex: 'due_date', key: 'due_date' },
 { title: t('status'), dataIndex: 'status', key: 'status',
 render: (s?: string) => <StatusTag status={s || 'pending'} label={t(s || 'pending')} /> },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: unknown, r: Activity) => (
 <Space>
 <Button
 icon={<CheckOutlined />}
 disabled={r.status === 'done'}
 onClick={() => onDone(r.id)}
 >
 {t('mark_done')}
 </Button>
 <Popconfirm title={t('confirm_archive')} onConfirm={() => onCancel(r.id)}>
 <Button danger>{t('cancel')}</Button>
 </Popconfirm>
 </Space>
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

 <FilterBar
 filters={[{
 key: 'status', label: t('status'),
 options: [
 { value: '', label: t('all') },
 { value: 'pending', label: t('pending') },
 { value: 'done', label: t('done') },
 ],
 }]}
 values={{ status: filterStatus }}
 onChange={(v) => setFilterStatus((v.status as string) ?? '')}
 extra={
 <>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('crm-activities', items, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </>
 }
 />

 <DataTable rowKey="id" loading={loading} dataSource={items} columns={visibleColumns} pagination={{ pageSize: 20 }} />

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
