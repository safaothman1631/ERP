import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Select, DatePicker, Space, Popconfirm, message, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import ChatterWidget from '../components/chatter/ChatterWidget';
import { FormDialog } from '../components/responsive/FormDialog';
import { PageHeader, DataTable, StatusTag } from '../design-system';
import type { ColumnDef } from '../design-system/DataTable';
import { restoreReturnContext, readReturnToken } from '../utils/returnContext';

interface Employee {
 id: string; name: string; email?: string; phone?: string; job_title?: string;
 department_id?: string; status?: string; hire_date?: string; manager_id?: string;
}
interface Department { id: string; name: string; }

export default function HREmployees() {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const location = useLocation();
 const [depts, setDepts] = useState<Department[]>([]);
 const [open, setOpen] = useState(false);
 const [editing, setEditing] = useState<Employee | null>(null);
 const [form] = Form.useForm();
 // Class C return-token: when the URL carries ?returnTo=<token>&autoOpen=1 we
 // know the user was sent here from another surface (e.g. ticket assign-to).
 // We auto-open the create form, and on save bounce back with the new id.
 const returnTokenRef = useRef<string | null>(null);
 const [returnHint, setReturnHint] = useState<string | null>(null);
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

 // Class C round-trip: detect returnTo / autoOpen on mount.
 useEffect(() => {
  const params = new URLSearchParams(location.search);
  const token = readReturnToken(params);
  const autoOpen = params.get('autoOpen');
  if (token) {
   returnTokenRef.current = token;
   const ctx = restoreReturnContext(token);
   if (ctx) {
    setReturnHint(t('hr.return_hint', 'After saving, you\'ll be sent back to where you came from.'));
   }
   if (autoOpen === '1') {
    setEditing(null);
    form.resetFields();
    setOpen(true);
   }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 const onSave = async () => {
 const v = await form.validateFields();
 if (v.hire_date && typeof v.hire_date !== 'string') {
 v.hire_date = v.hire_date.format('YYYY-MM-DD');
 }
 try {
 let createdId: string | undefined;
 if (editing) {
  await api.put(`/api/hr/employees/${editing.id}`, v);
  createdId = editing.id;
 } else {
  const created = await api.post('/api/hr/employees', v);
  createdId = created.data?.id;
 }
 message.success(t('saved'));
 setOpen(false); setEditing(null); form.resetFields();
 await employeesQuery.refetch();

 // If we have an active return token, bounce back to the source surface.
 const token = returnTokenRef.current;
 if (token && createdId && !editing) {
  const ctx = restoreReturnContext(token);
  if (ctx && typeof ctx.state === 'object' && ctx.state !== null) {
   const state = ctx.state as { returnPath?: string };
   const path = state.returnPath || ctx.surface.split('#')[0];
   if (path) {
    const qs = new URLSearchParams();
    qs.set('newEmployeeId', createdId);
    qs.set('consumedToken', token);
    returnTokenRef.current = null;
    navigate(`${path}?${qs.toString()}`);
    return;
   }
  }
 }
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

 const cols: ColumnDef<Employee>[] = [
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
 render: (s?: string) => <StatusTag status={s || 'active'} label={t(s || 'active')} />,
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
 <div data-section-id="hr.employees">
 {returnHint && (
 <Alert
 type="info"
 showIcon
 message={returnHint}
 style={{ marginBottom: 12 }}
 data-testid="return-context-hint"
 />
 )}
 <PageHeader
 title={t('employees')}
 sectionId="hr.employees"
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
 {t('new_employee')}
 </Button>
 </Space>
 }
 />

 <DataTable rowKey="id" dataSource={list} columns={cols} loading={loading} pagination={{ pageSize: 20 }} />

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
