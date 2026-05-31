import React, { useEffect, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Space, Form, Input, Tag, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader } from '../../design-system';
import { Popconfirm } from 'antd';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ListWithEmptyState } from '../../design-system/empty/ListWithEmptyState';

interface CAPA {
 id: string;
 title: string;
 root_cause?: string;
 corrective_action?: string;
 preventive_action?: string;
 assigned_to?: string;
 due_date?: string;
 status?: string;
 non_conformity_id?: string;
}

const CAPAList: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<CAPA[]>([]);
 const [loading, setLoading] = useState(false);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/quality/capa', { params: { limit: 200 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, []);

 const handleSave = async (values: any) => {
 try {
 const payload = { ...values };
 if (values.due_date) {
 payload.due_date = values.due_date.format('YYYY-MM-DD');
 }
 if (editingId) {
 await api.patch(`/api/quality/capa/${editingId}`, payload);
 message.success(t('success'));
 } else {
 await api.post('/api/quality/capa', payload);
 message.success(t('quality.capa_created'));
 }
 setDrawerOpen(false);
 form.resetFields();
 setEditingId(null);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (record: CAPA) => {
 setEditingId(record.id);
 const vals = { ...record };
 if (vals.due_date) {
 (vals as any).due_date = dayjs(vals.due_date);
 }
 form.setFieldsValue(vals);
 setDrawerOpen(true);
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/quality/capa/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleClose = async (id: string) => {
 try {
 await api.post(`/api/quality/capa/${id}/close`);
 message.success(t('quality.capa_closed'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const columns: ColumnsType<CAPA> = [
 {
 title: t('quality.title'),
 dataIndex: 'title',
 key: 'title',
 },
 {
 title: t('quality.root_cause'),
 dataIndex: 'root_cause',
 key: 'root_cause',
 render: (v) => v || '—',
 },
 {
 title: t('quality.assigned_to'),
 dataIndex: 'assigned_to',
 key: 'assigned_to',
 render: (v) => v || '—',
 },
 {
 title: t('quality.due_date'),
 dataIndex: 'due_date',
 key: 'due_date',
 render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (v) => {
 if (v === 'closed') return <Tag color="green">{t('quality.closed')}</Tag>;
 return <Tag color="orange">{t('quality.open')}</Tag>;
 },
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_, record) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
 {record.status !== 'closed' && (
 <Popconfirm title={t('quality.confirm_close')} onConfirm={() => handleClose(record.id)}>
 <Button type="primary" icon={<CheckCircleOutlined />}>
 {t('quality.close')}
 </Button>
 </Popconfirm>
 )}
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(record.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('quality.capa')}
 subtitle={t('quality.capa_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditingId(null);
 form.resetFields();
 setDrawerOpen(true);
 }}
 >
 {t('quality.new_capa')}
 </Button>
 }
 />
 <ListWithEmptyState
 entity="capa"
 data={data}
 loading={loading}
 onCreate={() => {
 setEditingId(null);
 form.resetFields();
 setDrawerOpen(true);
 }}
 onRetry={fetchData}
 render={(rows) => (
 <ResponsiveTableAdapter
 dataSource={rows}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 )}
 />
 <FormDialog
 title={editingId ? t('quality.edit_capa') : t('quality.new_capa')}
 open={drawerOpen}
 onClose={() => {
 setDrawerOpen(false);
 form.resetFields();
 setEditingId(null);
 }}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item
 name="title"
 label={t('quality.title')}
 rules={[{ required: true, message: t('required') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item name="non_conformity_id" label={t('quality.ncr_id')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="root_cause" label={t('quality.root_cause')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="corrective_action" label={t('quality.corrective_action')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="preventive_action" label={t('quality.preventive_action')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="assigned_to" label={t('quality.assigned_to')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="due_date" label={t('quality.due_date')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item>
 <Space>
 <Button type="primary" htmlType="submit">
 {t('save')}
 </Button>
 <Button onClick={() => setDrawerOpen(false)}>{t('cancel')}</Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default CAPAList;
