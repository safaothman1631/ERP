import { useEffect, useState } from 'react';
import { Card, Button, Form, Input, Select, DatePicker, Space, Popconfirm, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import ChatterWidget from '../components/chatter/ChatterWidget';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { HelpIcon } from '../help/HelpIcon';

interface Employee {
 id: string; name: string; email?: string; phone?: string; job_title?: string;
 department_id?: string; status?: string; hire_date?: string; manager_id?: string;
}
interface Department { id: string; name: string; }

export default function HREmployees() {
 const { t } = useTranslation();
 const [depts, setDepts] = useState<Department[]>([]);
 const [open, setOpen] = useState(false);
 const [editing, setEditing] = useState<Employee | null>(null);
 const [form] = Form.useForm();
 const employeesQuery = useListQuery<Employee, { items?: Employee[]; total?: number }>({
 queryKey: listQueryKeys.hrEmployees(),
 queryFn: () => api.get('/api/hr/employees'),
 });
 const list = employeesQuery.data?.items ?? [];
 const loading = employeesQuery.isLoading || employeesQuery.isFetching;

 const load = async () => {
 try {
 const d = await api.get('/api/hr/departments');
 setDepts(d.data.items || []);
 } finally {
 await employeesQuery.refetch();
 }
 };
 useEffect(() => {
 void load();
 }, []);

 const onSave = async () => {
 const v = await form.validateFields();
 if (v.hire_date && typeof v.hire_date !== 'string') {
 v.hire_date = v.hire_date.format('YYYY-MM-DD');
 }
 try {
 if (editing) await api.put(`/api/hr/employees/${editing.id}`, v);
 else await api.post('/api/hr/employees', v);
 message.success(t('saved'));
 setOpen(false); setEditing(null); form.resetFields();
 await employeesQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const remove = async (id: string) => {
 try { await api.delete(`/api/hr/employees/${id}`); await employeesQuery.refetch(); }
 catch { message.error(t('error')); }
 };

 const startEdit = (e: Employee) => {
 setEditing(e);
 form.setFieldsValue({ ...e, hire_date: e.hire_date ? dayjs(e.hire_date) : null });
 setOpen(true);
 };

 const cols = [
 { title: t('name'), dataIndex: 'name' },
 { title: t('email'), dataIndex: 'email' },
 { title: t('phone'), dataIndex: 'phone' },
 { title: t('job_title'), dataIndex: 'job_title' },
 {
 title: t('department'), dataIndex: 'department_id',
 render: (id?: string) => depts.find(d => d.id === id)?.name || '—',
 },
 { title: t('hire_date'), dataIndex: 'hire_date', render: (d?: string) => d || '—' },
 {
 title: t('status'), dataIndex: 'status',
 render: (s?: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{t(s || 'active')}</Tag>,
 },
 {
 title: t('actions'),
 render: (_: unknown, r: Employee) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => startEdit(r)} />
 <Popconfirm title={t('confirm_archive')} onConfirm={() => remove(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div style={{ padding: 16 }} data-section-id="hr.employees">
 <Space style={{ marginBottom: 12 }}>
 <h2 style={{ margin: 0 }}>{t('employees')}</h2>
 <HelpIcon sectionId="hr.employees" />
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
 {t('new_employee')}
 </Button>
 </Space>

 <Card>
 <ResponsiveTableAdapter rowKey="id" dataSource={list} columns={cols} loading={loading} pagination={{ pageSize: 20 }} />
 </Card>

 <FormDialog
 open={open}
 onClose={() => setOpen(false)}
 onOk={onSave}
 title={editing ? t('edit_employee') : t('new_employee')}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item name="email" label={t('email')}><Input /></Form.Item>
 <Form.Item name="phone" label={t('phone')}><Input /></Form.Item>
 <Form.Item name="job_title" label={t('job_title')}><Input /></Form.Item>
 <Form.Item name="department_id" label={t('department')}>
 <Select allowClear options={depts.map(d => ({ value: d.id, label: d.name }))} />
 </Form.Item>
 <Form.Item name="hire_date" label={t('hire_date')}><DatePicker style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="status" label={t('status')} initialValue="active">
 <Select options={[
 { value: 'active', label: t('active') },
 { value: 'on_leave', label: t('on_leave') },
 { value: 'terminated', label: t('terminated') },
 ]} />
 </Form.Item>
 </Form>
 {editing?.id && (
 <div style={{ marginTop: 16 }}>
 <ChatterWidget entityType="employee" entityId={editing.id} />
 </div>
 )}
 </FormDialog>
 </div>
 );
}
