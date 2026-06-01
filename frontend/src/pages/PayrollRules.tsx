import { useEffect, useState } from 'react';
import { Card, Button, Form, Input, InputNumber, Select, Space, Popconfirm, Tag, message, Switch } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface Rule {
 id: string; code: string; name: string; type?: string; amount_type?: string;
 amount?: number; apply_on?: string; active?: boolean;
}

export default function PayrollRules() {
 const { t } = useTranslation();
 const [list, setList] = useState<Rule[]>([]);
 const [open, setOpen] = useState(false);
 const [editing, setEditing] = useState<Rule | null>(null);
 const [form] = Form.useForm();

 const load = async () => {
 const r = await api.get('/api/payroll/rules');
 setList(r.data.items || []);
 };
 useEffect(() => { load(); }, []);

 const save = async () => {
 const v = await form.validateFields();
 try {
 if (editing) await api.put(`/api/payroll/rules/${editing.id}`, v);
 else await api.post('/api/payroll/rules', v);
 message.success(t('saved'));
 setOpen(false); setEditing(null); form.resetFields();
 load();
 } catch { message.error(t('error')); }
 };
 const remove = async (id: string) => {
 try { await api.delete(`/api/payroll/rules/${id}`); load(); }
 catch { message.error(t('error')); }
 };

 const startEdit = (r: Rule) => { setEditing(r); form.setFieldsValue(r); setOpen(true); };

 const cols = [
 { title: t('code'), dataIndex: 'code' },
 { title: t('name'), dataIndex: 'name' },
 { title: t('type'), dataIndex: 'type', render: (s?: string) => <Tag>{s}</Tag> },
 { title: t('amount_type'), dataIndex: 'amount_type' },
 { title: t('amount'), dataIndex: 'amount', align: 'right' as const,
 render: (n: number, r: Rule) => r.amount_type === 'percent' ? `${n}%` : n.toLocaleString() },
 { title: t('active'), dataIndex: 'active',
 render: (b: boolean) => <Tag color={b ? 'green' : 'default'}>{b ? t('yes') : t('no')}</Tag> },
 {
 title: t('actions'),
 render: (_: unknown, r: Rule) => (
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
 <div style={{ padding: 16 }}>
 <PageHeader
 title={t('salary_rules')}
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
 {t('new_rule')}
 </Button>
 </Space>
 }
 />
 <Card><ResponsiveTableAdapter rowKey="id" dataSource={list} columns={cols} pagination={false} /></Card>

 <FormDialog open={open} onOk={save} onClose={() => setOpen(false)} title={editing ? t('edit_rule') : t('new_rule')}>
 <Form form={form} layout="vertical">
 <Form.Item name="code" label={t('code')} rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item name="type" label={t('type')} initialValue="allowance">
 <Select options={[
 { value: 'allowance', label: t('allowance') },
 { value: 'deduction', label: t('deduction') },
 { value: 'tax', label: t('tax') },
 { value: 'social_security', label: t('social_security') },
 ]} />
 </Form.Item>
 <Form.Item name="amount_type" label={t('amount_type')} initialValue="fixed">
 <Select options={[
 { value: 'fixed', label: t('fixed') },
 { value: 'percent', label: t('percent') },
 ]} />
 </Form.Item>
 <Form.Item name="amount" label={t('amount')} initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="active" label={t('active')} initialValue={true} valuePropName="checked"><Switch /></Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
