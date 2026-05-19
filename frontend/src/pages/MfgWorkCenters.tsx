import { useEffect, useState } from 'react';
import { Card, Button, Form, Input, InputNumber, Switch, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

interface WC { id: string; name: string; code?: string; capacity_per_hour?: number; cost_per_hour?: number; active?: boolean; }

export default function MfgWorkCenters() {
 const { t } = useTranslation();
 const [list, setList] = useState<WC[]>([]);
 const [open, setOpen] = useState(false);
 const [editing, setEditing] = useState<WC | null>(null);
 const [form] = Form.useForm();

 const load = async () => {
 const r = await api.get('/api/manufacturing/work-centers');
 setList(r.data.items || []);
 };
 useEffect(() => { load(); }, []);

 const save = async () => {
 const v = await form.validateFields();
 try {
 if (editing) await api.put(`/api/manufacturing/work-centers/${editing.id}`, v);
 else await api.post('/api/manufacturing/work-centers', v);
 message.success(t('saved'));
 setOpen(false); setEditing(null); form.resetFields();
 load();
 } catch { message.error(t('error')); }
 };

 const remove = async (id: string) => {
 try { await api.delete(`/api/manufacturing/work-centers/${id}`); load(); }
 catch { message.error(t('error')); }
 };

 const cols = [
 { title: t('name'), dataIndex: 'name' },
 { title: t('code'), dataIndex: 'code' },
 { title: t('capacity_per_hour'), dataIndex: 'capacity_per_hour' },
 { title: t('cost_per_hour'), dataIndex: 'cost_per_hour' },
 { title: t('active'), dataIndex: 'active', render: (b: boolean) => b ? '✓' : '—' },
 {
 title: t('actions'),
 render: (_: unknown, r: WC) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }} />
 <Popconfirm title={t('confirm_archive')} onConfirm={() => remove(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div style={{ padding: 16 }}>
 <Space style={{ marginBottom: 12 }}>
 <h2 style={{ margin: 0 }}>{t('work_centers')}</h2>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
 {t('new_work_center')}
 </Button>
 </Space>
 <Card><ResponsiveTableAdapter rowKey="id" dataSource={list} columns={cols} pagination={false} /></Card>

 <FormDialog open={open} onOk={save} onClose={() => setOpen(false)} title={editing ? t('edit') : t('new_work_center')}>
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item name="code" label={t('code')}><Input /></Form.Item>
 <Form.Item name="capacity_per_hour" label={t('capacity_per_hour')} initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="cost_per_hour" label={t('cost_per_hour')} initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
 <Form.Item name="active" label={t('active')} valuePropName="checked" initialValue={true}><Switch /></Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
