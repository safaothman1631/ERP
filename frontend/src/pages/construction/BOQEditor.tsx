import type React from 'react';
import { useEffect, useState } from 'react';
import { Button, Space, Input, Form, Select, InputNumber } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Popconfirm } from 'antd';
import api from '../../api';
import { PageHeader, SectionCard, KeyValueGrid, DataTable } from '../../design-system';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Project {
 id: string;
 name: string;
 client?: string;
}

interface BOQItem {
 id: string;
 project_id: string;
 item_code: string;
 description: string;
 unit: string;
 quantity: number;
 rate: number;
 amount: number;
 completed_pct: number;
 created_at: string;
}

const BOQEditor: React.FC = () => {
 const { t } = useTranslation();
 const [projects, setProjects] = useState<Project[]>([]);
 const [selectedProject, setSelectedProject] = useState<string | null>(null);
 const [items, setItems] = useState<BOQItem[]>([]);
 const [loading, setLoading] = useState(false);
 const [drawer, setDrawer] = useState(false);
 const [form] = Form.useForm();

 const fetchProjects = async () => {
 try {
 const res = await api.get('/api/construction/projects', { params: { limit: 200 } });
 setProjects(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 const fetchBOQItems = async (projectId: string) => {
 setLoading(true);
 try {
 const res = await api.get('/api/construction/boq', { params: { project_id: projectId, limit: 500 } });
 setItems(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchProjects();
 }, []);

 useEffect(() => {
 if (selectedProject) {
 void fetchBOQItems(selectedProject);
 } else {
 setItems([]);
 }
 }, [selectedProject]);

 const handleCreate = async (values: any) => {
 if (!selectedProject) {
 message.error(t('construction.select_project_first'));
 return;
 }
 try {
 const quantity = values.quantity || 0;
 const rate = values.rate || 0;
 await api.post('/api/construction/boq', {
 ...values,
 project_id: selectedProject,
 amount: quantity * rate,
 });
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchBOQItems(selectedProject);
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/construction/boq/${id}`);
 message.success(t('construction.boq_item_deleted'));
 if (selectedProject) {
 void fetchBOQItems(selectedProject);
 }
 } catch {
 message.error(t('error'));
 }
 };

 const handleUpdateCompleted = async (id: string, completedPct: number) => {
 try {
 await api.patch(`/api/construction/boq/${id}`, { completed_pct: completedPct });
 message.success(t('success'));
 if (selectedProject) {
 void fetchBOQItems(selectedProject);
 }
 } catch {
 message.error(t('error'));
 }
 };

 const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
 const totalCompleted = items.reduce((sum, item) => sum + (item.amount * (item.completed_pct || 0)) / 100, 0);

 const columns: any[] = [
 { title: t('construction.item_code'), dataIndex: 'item_code', key: 'item_code', width: 120 },
 { title: t('construction.description'), dataIndex: 'description', key: 'description', width: 250 },
 { title: t('construction.unit'), dataIndex: 'unit', key: 'unit', width: 80 },
 {
 title: t('construction.quantity'),
 dataIndex: 'quantity',
 key: 'quantity',
 width: 100,
 align: 'right',
 render: (v: number) => v.toLocaleString(),
 },
 {
 title: t('construction.rate'),
 dataIndex: 'rate',
 key: 'rate',
 width: 120,
 align: 'right',
 render: (v: number) => v.toLocaleString(),
 },
 {
 title: t('construction.amount'),
 dataIndex: 'amount',
 key: 'amount',
 width: 140,
 align: 'right',
 render: (v: number) => v.toLocaleString(),
 },
 {
 title: t('construction.completed_pct'),
 dataIndex: 'completed_pct',
 key: 'completed_pct',
 width: 150,
 render: (v: number, rec: BOQItem) => (
 <Space>
 <InputNumber
 min={0}
 max={100}
 value={v}
 onChange={(val) => handleUpdateCompleted(rec.id, val || 0)}
 style={{ width: 80 }}
 suffix="%"
 />
 <Button type="link" icon={<SaveOutlined />} />
 </Space>
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 80,
 align: 'center',
 render: (_: any, rec: BOQItem) => (
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(rec.id)}>
 <Button type="text" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('construction.boq_title')}
 subtitle={t('construction.boq_subtitle')}
 breadcrumb={[{ label: t('construction.title') }, { label: t('construction.boq_title') }]}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => setDrawer(true)}
 disabled={!selectedProject}
 >
 {t('construction.add_boq_item')}
 </Button>
 }
 />

 <SectionCard>
 <Select
 placeholder={t('construction.select_project')}
 value={selectedProject}
 onChange={setSelectedProject}
 style={{ width: 350, maxWidth: '100%' }}
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {projects.map((p) => (
 <Select.Option key={p.id} value={p.id}>
 {p.name} {p.client ? `(${p.client})` : ''}
 </Select.Option>
 ))}
 </Select>
 </SectionCard>

 {selectedProject && (
 <>
 <SectionCard>
 <KeyValueGrid
 columns={3}
 items={[
 { label: t('construction.total_boq'), value: `${totalAmount.toLocaleString()} IQD` },
 { label: t('construction.total_completed'), value: `${totalCompleted.toLocaleString()} IQD` },
 { label: t('construction.completion_pct'), value: `${totalAmount > 0 ? ((totalCompleted / totalAmount) * 100).toFixed(1) : '0'}%` },
 ]}
 />
 </SectionCard>

 <DataTable<BOQItem>
 columns={columns}
 dataSource={items}
 rowKey="id"
 loading={loading}
 stickyHeader={false}
 pagination={{ pageSize: 20 }}
 />
 </>
 )}

 <FormDialog title={t('construction.add_boq_item')} open={drawer} onClose={() => setDrawer(false)}>
 <Form form={form} layout="vertical" onFinish={handleCreate}>
 <Form.Item name="item_code" label={t('construction.item_code')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="description" label={t('construction.description')} rules={[{ required: true }]}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="unit" label={t('construction.unit')} rules={[{ required: true }]}>
 <Input placeholder="m², m³, pcs, kg..." />
 </Form.Item>
 <Form.Item name="quantity" label={t('construction.quantity')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="rate" label={t('construction.rate')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="completed_pct" label={t('construction.completed_pct')} initialValue={0}>
 <InputNumber min={0} max={100} style={{ width: '100%' }} suffix="%" />
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

export default BOQEditor;
