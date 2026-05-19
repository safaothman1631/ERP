import { useEffect, useState } from 'react';
import { Card, Button, Form, Select, DatePicker, Input, InputNumber, Space, Popconfirm, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface Contract {
 id: string; employee_id: string; type?: string; wage?: number; currency?: string;
 start_date?: string; end_date?: string; status?: string; payment_frequency?: string;
}
interface Emp { id: string; name: string; }

export default function HRContracts() {
 const { t } = useTranslation();
 const [list, setList] = useState<Contract[]>([]);
 const [emps, setEmps] = useState<Emp[]>([]);
 const [open, setOpen] = useState(false);
 const [form] = Form.useForm();

 const load = async () => {
 const [c, e] = await Promise.all([api.get('/api/hr/contracts'), api.get('/api/hr/employees')]);
 setList(c.data.items || []);
 setEmps(e.data.items || []);
 };
 useEffect(() => { load(); }, []);

 const save = async () => {
 const v = await form.validateFields();
 if (v.start_date) v.start_date = v.start_date.format('YYYY-MM-DD');
 if (v.end_date) v.end_date = v.end_date.format('YYYY-MM-DD');
 try {
 await api.post('/api/hr/contracts', v);
 message.success(t('saved'));
 setOpen(false); form.resetFields();
 load();
 } catch { message.error(t('error')); }
 };

 const remove = async (id: string) => {
 try { await api.delete(`/api/hr/contracts/${id}`); load(); }
 catch { message.error(t('error')); }
 };

 const cols = [
 { title: t('employee'), dataIndex: 'employee_id',
 render: (id: string) => emps.find(e => e.id === id)?.name || id },
 { title: t('type'), dataIndex: 'type', render: (s?: string) => <Tag>{s}</Tag> },
 { title: t('wage'), dataIndex: 'wage', align: 'right' as const,
 render: (n?: number, r?: Contract) => `${(n || 0).toLocaleString()} ${r?.currency || 'IQD'}` },
 { title: t('start_date'), dataIndex: 'start_date' },
 { title: t('end_date'), dataIndex: 'end_date', render: (d?: string) => d || '—' },
 { title: t('status'), dataIndex: 'status',
 render: (s?: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag> },
 {
 title: t('actions'),
 render: (_: unknown, r: Contract) => (
 <Popconfirm title={t('confirm_archive')} onConfirm={() => remove(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 ),
 },
 ];

 return (
 <div style={{ padding: 16 }}>
 <Space style={{ marginBottom: 12 }}>
 <h2 style={{ margin: 0 }}>{t('contracts')}</h2>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('new_contract')}</Button>
 </Space>
 <Card><ResponsiveTableAdapter rowKey="id" dataSource={list} columns={cols} pagination={{ pageSize: 20 }} /></Card>

 <FormDialog open={open} onOk={save} onClose={() => setOpen(false)} title={t('new_contract')}>
 <Form form={form} layout="vertical">
 <Form.Item name="employee_id" label={t('employee')} rules={[{ required: true }]}>
 <Select options={emps.map(e => ({ value: e.id, label: e.name }))} showSearch optionFilterProp="label" />
 </Form.Item>
 <Form.Item name="type" label={t('type')} initialValue="permanent">
 <Select options={[
 { value: 'permanent', label: t('permanent') },
 { value: 'temporary', label: t('temporary') },
 { value: 'internship', label: t('internship') },
 ]} />
 </Form.Item>
 <Form.Item name="wage" label={t('wage')} initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="currency" label={t('currency')} initialValue="IQD"><Input /></Form.Item>
 <Form.Item name="start_date" label={t('start_date')} rules={[{ required: true }]} initialValue={dayjs()}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="end_date" label={t('end_date')}><DatePicker style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="payment_frequency" label={t('payment_frequency')} initialValue="monthly">
 <Select options={[
 { value: 'monthly', label: t('monthly') },
 { value: 'weekly', label: t('weekly') },
 { value: 'daily', label: t('daily') },
 ]} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
