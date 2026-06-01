import { useEffect, useState } from 'react';
import { Card, Button, Form, Select, DatePicker, Input, Space, message, Tabs } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { HelpIcon } from '../help/HelpIcon';
import { StatusTag } from '../design-system';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface TimeOff {
 id: string; employee_id: string; leave_type_id: string; start_date: string; end_date: string;
 days?: number; reason?: string; status?: string;
}
interface LeaveType { id: string; name: string; paid?: boolean; }
interface Emp { id: string; name: string; }

export default function HRTimeOff() {
 const { t } = useTranslation();
 const [list, setList] = useState<TimeOff[]>([]);
 const [types, setTypes] = useState<LeaveType[]>([]);
 const [emps, setEmps] = useState<Emp[]>([]);
 const [open, setOpen] = useState(false);
 const [typeOpen, setTypeOpen] = useState(false);
 const [form] = Form.useForm();
 const [typeForm] = Form.useForm();

 const load = async () => {
 const [r, lt, e] = await Promise.all([
 api.get('/api/hr/time-off'),
 api.get('/api/hr/leave-types'),
 api.get('/api/hr/employees'),
 ]);
 setList(r.data.items || []);
 setTypes(lt.data.items || []);
 setEmps(e.data.items || []);
 };
 useEffect(() => { load(); }, []);

 const submit = async () => {
 const v = await form.validateFields();
 v.start_date = v.range[0].format('YYYY-MM-DD');
 v.end_date = v.range[1].format('YYYY-MM-DD');
 delete v.range;
 try {
 await api.post('/api/hr/time-off', v);
 message.success(t('saved'));
 setOpen(false); form.resetFields();
 load();
 } catch { message.error(t('error')); }
 };

 const submitType = async () => {
 const v = await typeForm.validateFields();
 try {
 await api.post('/api/hr/leave-types', v);
 message.success(t('saved'));
 setTypeOpen(false); typeForm.resetFields();
 load();
 } catch { message.error(t('error')); }
 };

 const approve = async (id: string) => {
 try { await api.post(`/api/hr/time-off/${id}/approve`); load(); }
 catch { message.error(t('error')); }
 };
 const reject = async (id: string) => {
 try { await api.post(`/api/hr/time-off/${id}/reject`); load(); }
 catch { message.error(t('error')); }
 };

 const cols = [
 { title: t('employee'), dataIndex: 'employee_id',
 render: (id: string) => emps.find(e => e.id === id)?.name || id },
 { title: t('leave_type'), dataIndex: 'leave_type_id',
 render: (id: string) => types.find(x => x.id === id)?.name || id },
 { title: t('start_date'), dataIndex: 'start_date' },
 { title: t('end_date'), dataIndex: 'end_date' },
 { title: t('days'), dataIndex: 'days' },
 { title: t('status'), dataIndex: 'status',
 render: (s: string) => <StatusTag status={s} label={t(s)} /> },
 {
 title: t('actions'),
 render: (_: unknown, r: TimeOff) => r.status === 'pending' ? (
 <Space>
 <Button type="primary" icon={<CheckOutlined />} onClick={() => approve(r.id)}>{t('approve')}</Button>
 <Button danger icon={<CloseOutlined />} onClick={() => reject(r.id)}>{t('reject')}</Button>
 </Space>
 ) : null,
 },
 ];

 const typeCols = [
 { title: t('name'), dataIndex: 'name' },
 { title: t('days_per_year'), dataIndex: 'days_per_year' },
 { title: t('paid'), dataIndex: 'paid', render: (b?: boolean) => <StatusTag status={b ? 'active' : 'default'} label={b ? t('yes') : t('no')} /> },
 ];

 return (
 <div style={{ padding: 16 }} data-section-id="hr.time_off">
 <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{t('time_off')}<HelpIcon sectionId="hr.time_off" /></h2>
 <Tabs items={[
 {
 key: 'requests', label: t('requests'),
 children: (
 <>
 <Space style={{ marginBottom: 12 }}>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('new_request')}</Button>
 </Space>
 <Card><ResponsiveTableAdapter rowKey="id" dataSource={list} columns={cols} pagination={{ pageSize: 20 }} /></Card>
 </>
 ),
 },
 {
 key: 'types', label: t('leave_types'),
 children: (
 <>
 <Space style={{ marginBottom: 12 }}>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setTypeOpen(true)}>{t('new_leave_type')}</Button>
 </Space>
 <Card><ResponsiveTableAdapter rowKey="id" dataSource={types} columns={typeCols} pagination={false} /></Card>
 </>
 ),
 },
 ]} />

 <FormDialog open={open} onOk={submit} onClose={() => setOpen(false)} title={t('new_request')}>
 <Form form={form} layout="vertical">
 <Form.Item name="employee_id" label={t('employee')} rules={[{ required: true }]}>
 <Select options={emps.map(e => ({ value: e.id, label: e.name }))} showSearch optionFilterProp="label" />
 </Form.Item>
 <Form.Item name="leave_type_id" label={t('leave_type')} rules={[{ required: true }]}>
 <Select options={types.map(x => ({ value: x.id, label: x.name }))} />
 </Form.Item>
 <Form.Item name="range" label={t('date_range')} rules={[{ required: true }]}>
 <DatePicker.RangePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="reason" label={t('reason')}><Input.TextArea rows={3} /></Form.Item>
 </Form>
 </FormDialog>

 <FormDialog open={typeOpen} onOk={submitType} onClose={() => setTypeOpen(false)} title={t('new_leave_type')}>
 <Form form={typeForm} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item name="days_per_year" label={t('days_per_year')} initialValue={0}><Input type="number" /></Form.Item>
 <Form.Item name="paid" label={t('paid')} initialValue={true} valuePropName="checked">
 <Select options={[{ value: true, label: t('yes') }, { value: false, label: t('no') }]} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
