import type React from 'react';
import { useEffect, useState } from 'react';
import { Button, Space, Input, Form, Select, Tag, InputNumber } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, SearchOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Popconfirm } from 'antd';
import api from '../../api';
import { PageHeader, StatusTag } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface ECN {
 id: string;
 title: string;
 product_id: string;
 type: string;
 reason?: string;
 proposed_changes?: string;
 assigned_to?: string;
 priority: string;
 status: string;
 affected_boms_count?: number;
 created_at: string;
}

interface Product {
 id: string;
 name: string;
}

const PLMEngineeringChanges: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<ECN[]>([]);
 const [products, setProducts] = useState<Product[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [drawer, setDrawer] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/plm/ecos', { params: { limit: 100 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchProducts = async () => {
 try {
 const res = await api.get('/api/items', { params: { limit: 200 } });
 setProducts(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 useEffect(() => {
 void fetchData();
 void fetchProducts();
 }, []);

 const handleSubmit = async (values: any) => {
 try {
 if (editingId) {
 await api.patch(`/api/plm/ecos/${editingId}`, values);
 message.success(t('plm.ecn_updated'));
 } else {
 await api.post('/api/plm/ecos', values);
 message.success(t('plm.ecn_created'));
 }
 setDrawer(false);
 form.resetFields();
 setEditingId(null);
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (ecn: ECN) => {
 setEditingId(ecn.id);
 form.setFieldsValue(ecn);
 setDrawer(true);
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/plm/ecos/${id}`);
 message.success(t('plm.ecn_deleted'));
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const getStatusTag = (status: string) => {
 const map: Record<string, 'info' | 'warning' | 'success' | 'error'> = {
 draft: 'info',
 review: 'warning',
 approved: 'success',
 implemented: 'success',
 rejected: 'error',
 };
 return <StatusTag status={map[status] || 'info'} />;
 };

 const getPriorityTag = (priority: string) => {
 const colors: Record<string, string> = {
 low: 'default',
 medium: 'blue',
 high: 'orange',
 urgent: 'red',
 };
 return <Tag color={colors[priority] || 'default'}>{t(`plm.priority_${priority}`)}</Tag>;
 };

 const filteredData = data.filter((e) => {
 const matchSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase());
 const matchStatus = !statusFilter || e.status === statusFilter;
 return matchSearch && matchStatus;
 });

 const columns: any[] = [
 {
 title: t('plm.ecn_number'),
 dataIndex: 'id',
 key: 'id',
 width: 150,
 render: (id: string) => `ECN-${id.slice(0, 8)}`,
 },
 { title: t('plm.title'), dataIndex: 'title', key: 'title', width: 250 },
 {
 title: t('plm.product'),
 dataIndex: 'product_id',
 key: 'product_id',
 width: 180,
 render: (pid: string) => products.find((p) => p.id === pid)?.name || pid,
 },
 {
 title: t('plm.change_type'),
 dataIndex: 'type',
 key: 'type',
 width: 120,
 render: (v: string) => <Tag>{t(`plm.type_${v}`)}</Tag>,
 },
 {
 title: t('plm.priority'),
 dataIndex: 'priority',
 key: 'priority',
 width: 100,
 render: getPriorityTag,
 },
 {
 title: t('plm.status'),
 dataIndex: 'status',
 key: 'status',
 width: 120,
 render: getStatusTag,
 },
 {
 title: t('plm.affected_boms'),
 dataIndex: 'affected_boms_count',
 key: 'affected_boms_count',
 width: 120,
 align: 'center',
 render: (v?: number) => v || 0,
 },
 {
 title: t('plm.assigned_to'),
 dataIndex: 'assigned_to',
 key: 'assigned_to',
 width: 120,
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 120,
 align: 'center',
 render: (_: any, rec: ECN) => (
 <Space>
 <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(rec)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(rec.id)}>
 <Button type="text" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('plm.ecn_title')}
 subtitle={t('plm.ecn_subtitle')}
 breadcrumb={[{ label: t('plm.title') }, { label: t('plm.ecn_title') }]}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditingId(null);
 form.resetFields();
 setDrawer(true);
 }}
 >
 {t('plm.create_ecn')}
 </Button>
 }
 />

 <div style={{ background: '#fff', padding: space.lg, borderRadius: 8 }}>
 <Space style={{ marginBottom: space.md }}>
 <Input
 placeholder={t('search')}
 prefix={<SearchOutlined />}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 style={{ width: 300 }}
 allowClear
 />
 <Select
 placeholder={t('plm.filter_status')}
 value={statusFilter}
 onChange={setStatusFilter}
 style={{ width: 150 }}
 allowClear
 >
 <Select.Option value="draft">{t('plm.status_draft')}</Select.Option>
 <Select.Option value="review">{t('plm.status_review')}</Select.Option>
 <Select.Option value="approved">{t('plm.status_approved')}</Select.Option>
 <Select.Option value="implemented">{t('plm.status_implemented')}</Select.Option>
 <Select.Option value="rejected">{t('plm.status_rejected')}</Select.Option>
 </Select>
 </Space>

 <ResponsiveTableAdapter
 columns={columns}
 dataSource={filteredData}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 scroll={{ x: 1400 }}
 />
 </div>

 <FormDialog
 title={editingId ? t('plm.edit_ecn') : t('plm.create_ecn')}
 open={drawer}
 onClose={() => {
 setDrawer(false);
 setEditingId(null);
 form.resetFields();
 }}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item name="title" label={t('plm.title')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="product_id" label={t('plm.product')} rules={[{ required: true }]}>
 <Select
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {products.map((p) => (
 <Select.Option key={p.id} value={p.id}>
 {p.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="type" label={t('plm.change_type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="change">{t('plm.type_change')}</Select.Option>
 <Select.Option value="new_part">{t('plm.type_new_part')}</Select.Option>
 <Select.Option value="obsolete">{t('plm.type_obsolete')}</Select.Option>
 <Select.Option value="deviation">{t('plm.type_deviation')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="priority" label={t('plm.priority')} initialValue="medium">
 <Select>
 <Select.Option value="low">{t('plm.priority_low')}</Select.Option>
 <Select.Option value="medium">{t('plm.priority_medium')}</Select.Option>
 <Select.Option value="high">{t('plm.priority_high')}</Select.Option>
 <Select.Option value="urgent">{t('plm.priority_urgent')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="status" label={t('plm.status')} initialValue="draft">
 <Select>
 <Select.Option value="draft">{t('plm.status_draft')}</Select.Option>
 <Select.Option value="review">{t('plm.status_review')}</Select.Option>
 <Select.Option value="approved">{t('plm.status_approved')}</Select.Option>
 <Select.Option value="implemented">{t('plm.status_implemented')}</Select.Option>
 <Select.Option value="rejected">{t('plm.status_rejected')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="reason" label={t('plm.reason')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="proposed_changes" label={t('plm.proposed_changes')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="assigned_to" label={t('plm.assigned_to')}>
 <Input />
 </Form.Item>
 <Form.Item name="affected_boms_count" label={t('plm.affected_boms')} initialValue={0}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item>
 <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
 <Button onClick={() => setDrawer(false)}>{t('cancel')}</Button>
 <Button type="primary" htmlType="submit">
 {t('save')}
 </Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default PLMEngineeringChanges;
