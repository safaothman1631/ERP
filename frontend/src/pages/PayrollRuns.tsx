import { useEffect, useState } from 'react';
import { Card, Button, Form, Input, DatePicker, Space, Tag, message, Descriptions, Table } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { PageHeader } from '../design-system';
import { palette } from '../theme/tokens';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface Run {
 id: string; name: string; period_start?: string; period_end?: string; status?: string;
 employee_count?: number; total_gross?: number; total_net?: number;
}
interface Payslip {
 id: string; employee_name?: string; basic?: number; allowances?: number; deductions?: number;
 gross?: number; net?: number; status?: string; currency?: string;
 lines?: { code?: string; name?: string; type?: string; amount: number }[];
}

export default function PayrollRuns() {
 const { t } = useTranslation();
 const [open, setOpen] = useState(false);
 const [form] = Form.useForm();
 const [drawer, setDrawer] = useState<{ run: Run; payslips: Payslip[] } | null>(null);
 const [active, setActive] = useState<Payslip | null>(null);
 const payrollRunsQuery = useListQuery<Run, { items?: Run[]; total?: number }>({
 queryKey: listQueryKeys.payrollRuns(),
 queryFn: () => api.get('/api/payroll/runs'),
 });
 const list = payrollRunsQuery.data?.items ?? [];

 const load = async () => {
 await payrollRunsQuery.refetch();
 };
 useEffect(() => { load(); }, []);

 const submit = async () => {
 const v = await form.validateFields();
 v.period_start = v.range[0].format('YYYY-MM-DD');
 v.period_end = v.range[1].format('YYYY-MM-DD');
 delete v.range;
 try {
 await api.post('/api/payroll/runs', v);
 message.success(t('saved'));
 setOpen(false); form.resetFields();
 await payrollRunsQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const showRun = async (id: string) => {
 const r = await api.get(`/api/payroll/runs/${id}`);
 setDrawer({ run: r.data, payslips: r.data.payslips || [] });
 };

 const confirmRun = async (id: string) => {
 try { await api.post(`/api/payroll/runs/${id}/confirm`); message.success(t('confirmed')); await payrollRunsQuery.refetch(); setDrawer(null); }
 catch { message.error(t('error')); }
 };
 const removeRun = async (id: string) => {
 try { await api.delete(`/api/payroll/runs/${id}`); await payrollRunsQuery.refetch(); }
 catch { message.error(t('error')); }
 };
 const markPaid = async (id: string) => {
 try { await api.post(`/api/payroll/payslips/${id}/mark-paid`); if (drawer) showRun(drawer.run.id); }
 catch { message.error(t('error')); }
 };

 const cols = [
 { title: t('name'), dataIndex: 'name' },
 { title: t('period'), key: 'period',
 render: (_: unknown, r: Run) => `${r.period_start || ''} → ${r.period_end || ''}` },
 { title: t('employees'), dataIndex: 'employee_count' },
 { title: t('total_gross'), dataIndex: 'total_gross', align: 'right' as const,
 render: (n?: number) => (n || 0).toLocaleString() },
 { title: t('total_net'), dataIndex: 'total_net', align: 'right' as const,
 render: (n?: number) => (n || 0).toLocaleString() },
 { title: t('status'), dataIndex: 'status',
 render: (s?: string) => <Tag color={s === 'confirmed' ? 'green' : 'orange'}>{s}</Tag> },
 {
 title: t('actions'),
 render: (_: unknown, r: Run) => (
 <Space>
 <Button onClick={() => showRun(r.id)}>{t('view')}</Button>
 {r.status !== 'confirmed' && (
 <Button type="primary" icon={<DeleteOutlined />} danger onClick={() => removeRun(r.id)} />
 )}
 </Space>
 ),
 },
 ];

 const slipCols = [
 { title: t('employee'), dataIndex: 'employee_name' },
 { title: t('basic'), dataIndex: 'basic', align: 'right' as const, render: (n?: number) => (n || 0).toLocaleString() },
 { title: t('allowances'), dataIndex: 'allowances', align: 'right' as const, render: (n?: number) => (n || 0).toLocaleString() },
 { title: t('deductions'), dataIndex: 'deductions', align: 'right' as const, render: (n?: number) => (n || 0).toLocaleString() },
 { title: t('net'), dataIndex: 'net', align: 'right' as const, render: (n?: number) => <strong>{(n || 0).toLocaleString()}</strong> },
 { title: t('status'), dataIndex: 'status', render: (s?: string) => <Tag color={s === 'paid' ? 'green' : s === 'confirmed' ? 'blue' : 'orange'}>{s}</Tag> },
 {
 title: t('actions'),
 render: (_: unknown, r: Payslip) => (
 <Space>
 <Button onClick={() => setActive(r)}>{t('view')}</Button>
 {r.status !== 'paid' && (
 <Button type="primary" onClick={() => markPaid(r.id)}>{t('mark_paid')}</Button>
 )}
 </Space>
 ),
 },
 ];

 return (
 <div style={{ padding: 16 }} data-section-id="hr.payroll_runs">
 <PageHeader
 title={t('payroll_runs')}
 sectionId="hr.payroll_runs"
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('new_run')}</Button>
 </Space>
 }
 />
 <Card><ResponsiveTableAdapter rowKey="id" dataSource={list} columns={cols} pagination={{ pageSize: 20 }} /></Card>

 <FormDialog open={open} onOk={submit} onClose={() => setOpen(false)} title={t('new_run')}>
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}
 initialValue={`Payroll ${dayjs().format('YYYY-MM')}`}><Input /></Form.Item>
 <Form.Item name="range" label={t('period')} rules={[{ required: true }]}
 initialValue={[dayjs().startOf('month'), dayjs().endOf('month')]}>
 <DatePicker.RangePicker style={{ width: '100%' }} />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 open={!!drawer}
 onClose={() => setDrawer(null)}
 title={drawer?.run.name || ''}
 >
 {drawer && (
 <>
 {drawer.run.status !== 'confirmed' && (
 <div style={{ marginBottom: 12 }}>
 <Button type="primary" icon={<CheckOutlined />} onClick={() => confirmRun(drawer.run.id)}>
 {t('confirm_run')}
 </Button>
 </div>
 )}
 <Descriptions column={2} bordered style={{ marginBottom: 12 }}>
 <Descriptions.Item label={t('period')}>{drawer.run.period_start} → {drawer.run.period_end}</Descriptions.Item>
 <Descriptions.Item label={t('status')}>{drawer.run.status}</Descriptions.Item>
 <Descriptions.Item label={t('employees')}>{drawer.run.employee_count}</Descriptions.Item>
 <Descriptions.Item label={t('total_net')}>{(drawer.run.total_net || 0).toLocaleString()}</Descriptions.Item>
 </Descriptions>
 <ResponsiveTableAdapter rowKey="id" dataSource={drawer.payslips} columns={slipCols} pagination={false} />
 </>
 )}
 </FormDialog>

 <FormDialog open={!!active} onClose={() => setActive(null)} hideFooter title={active?.employee_name || ''}>
 {active && (
 <ResponsiveTableAdapter
 rowKey={(r, i) => `${i}`}
 pagination={false}
 dataSource={active.lines || []}
 columns={[
 { title: t('code'), dataIndex: 'code' },
 { title: t('name'), dataIndex: 'name' },
 { title: t('type'), dataIndex: 'type' },
 { title: t('amount'), dataIndex: 'amount', align: 'right' as const,
 render: (n: number) => <span style={{ color: n < 0 ? palette.danger : undefined }}>{n.toLocaleString()}</span> },
 ]}
 summary={() => (
 <Table.Summary.Row>
 <Table.Summary.Cell index={0} colSpan={3}><strong>{t('net')}</strong></Table.Summary.Cell>
 <Table.Summary.Cell index={3} align="right"><strong>{(active.net || 0).toLocaleString()}</strong></Table.Summary.Cell>
 </Table.Summary.Row>
 )}
 />
 )}
 </FormDialog>
 </div>
 );
}
