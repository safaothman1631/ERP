import type React from 'react';
import { useEffect, useState } from 'react';
import { Button, Space, Input, Form, Select, InputNumber, Tag, Row, Col, Card, Statistic } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, StatusTag, KpiCard } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Project {
 id: string;
 name: string;
 client?: string;
 contract_value: number;
 start_date?: string;
 end_date?: string;
 status: string;
 created_at: string;
}

interface CostSummary {
 total_budget: number;
 total_actual: number;
 labor_cost: number;
 material_cost: number;
 equipment_cost: number;
 subcontract_cost: number;
 overhead_cost: number;
}

const ConstructionProjects: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Project[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [drawer, setDrawer] = useState(false);
 const [detailDrawer, setDetailDrawer] = useState(false);
 const [selectedProject, setSelectedProject] = useState<Project | null>(null);
 const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
 const [loadingCost, setLoadingCost] = useState(false);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/construction/projects', { params: { limit: 100 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchData();
 }, []);

 const handleCreate = async (values: any) => {
 try {
 await api.post('/api/construction/projects', values);
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleViewDetail = async (project: Project) => {
 setSelectedProject(project);
 setDetailDrawer(true);
 setLoadingCost(true);
 setCostSummary(null);
 try {
 const res = await api.get(`/api/construction/projects/${project.id}/cost-summary`);
 setCostSummary(res.data);
 } catch {
 message.error(t('construction.cost_summary_error'));
 } finally {
 setLoadingCost(false);
 }
 };

 const getStatusTag = (status: string) => {
 const map: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
 planning: 'info',
 in_progress: 'warning',
 on_hold: 'error',
 completed: 'success',
 cancelled: 'error',
 };
 return <StatusTag status={map[status] || 'info'} />;
 };

 const filteredData = data.filter((p) =>
 !search ||
 p.name?.toLowerCase().includes(search.toLowerCase()) ||
 p.client?.toLowerCase().includes(search.toLowerCase())
 );

 const columns: any[] = [
 { title: t('construction.project_name'), dataIndex: 'name', key: 'name', width: 200 },
 { title: t('construction.client'), dataIndex: 'client', key: 'client', width: 150 },
 { title: t('construction.start_date'), dataIndex: 'start_date', key: 'start_date', width: 120 },
 { title: t('construction.end_date'), dataIndex: 'end_date', key: 'end_date', width: 120 },
 {
 title: t('construction.budget'),
 dataIndex: 'contract_value',
 key: 'contract_value',
 width: 140,
 align: 'right',
 render: (v: number) => v.toLocaleString(),
 },
 {
 title: t('construction.status'),
 dataIndex: 'status',
 key: 'status',
 width: 120,
 render: getStatusTag,
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 120,
 align: 'center',
 render: (_: any, rec: Project) => (
 <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(rec)}>
 {t('construction.view_detail')}
 </Button>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('construction.title')}
 subtitle={t('construction.subtitle')}
 breadcrumb={[{ label: t('construction.title') }]}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawer(true)}>
 {t('construction.add_project')}
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
 </Space>

 <ResponsiveTableAdapter
 columns={columns}
 dataSource={filteredData}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 scroll={{ x: 1000 }}
 />
 </div>

 <FormDialog title={t('construction.add_project')} open={drawer} onClose={() => setDrawer(false)}>
 <Form form={form} layout="vertical" onFinish={handleCreate}>
 <Form.Item name="name" label={t('construction.project_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="client" label={t('construction.client')}>
 <Input />
 </Form.Item>
 <Form.Item name="contract_value" label={t('construction.budget')} initialValue={0}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="start_date" label={t('construction.start_date')}>
 <Input type="date" />
 </Form.Item>
 <Form.Item name="end_date" label={t('construction.end_date')}>
 <Input type="date" />
 </Form.Item>
 <Form.Item name="status" label={t('construction.status')} initialValue="planning">
 <Select>
 <Select.Option value="planning">{t('construction.status_planning')}</Select.Option>
 <Select.Option value="in_progress">{t('construction.status_in_progress')}</Select.Option>
 <Select.Option value="on_hold">{t('construction.status_on_hold')}</Select.Option>
 <Select.Option value="completed">{t('construction.status_completed')}</Select.Option>
 <Select.Option value="cancelled">{t('construction.status_cancelled')}</Select.Option>
 </Select>
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

 <FormDialog
 title={selectedProject?.name}
 open={detailDrawer}
 onClose={() => setDetailDrawer(false)}
 >
 {selectedProject && (
 <Space direction="vertical" style={{ width: '100%' }}>
 <Card title={t('construction.project_info')}>
 <Row gutter={[16, 16]}>
 <Col span={12}>
 <Statistic title={t('construction.client')} value={selectedProject.client || '-'} />
 </Col>
 <Col span={12}>
 <Statistic title={t('construction.status')} value={t(`construction.status_${selectedProject.status}`)} />
 </Col>
 <Col span={12}>
 <Statistic title={t('construction.start_date')} value={selectedProject.start_date || '-'} />
 </Col>
 <Col span={12}>
 <Statistic title={t('construction.end_date')} value={selectedProject.end_date || '-'} />
 </Col>
 </Row>
 </Card>

 <Card title={t('construction.cost_summary')} loading={loadingCost}>
 {costSummary && (
 <Row gutter={[16, 16]}>
 <Col span={12}>
 <KpiCard
 title={t('construction.total_budget')}
 value={costSummary.total_budget.toLocaleString()}
 trend={0}
 />
 </Col>
 <Col span={12}>
 <KpiCard
 title={t('construction.total_actual')}
 value={costSummary.total_actual.toLocaleString()}
 trend={
 costSummary.total_budget > 0
 ? ((costSummary.total_actual / costSummary.total_budget - 1) * 100)
 : 0
 }
 trendLabel={t('construction.vs_budget')}
 />
 </Col>
 <Col span={12}>
 <Statistic
 title={t('construction.labor_cost')}
 value={costSummary.labor_cost.toLocaleString()}
 />
 </Col>
 <Col span={12}>
 <Statistic
 title={t('construction.material_cost')}
 value={costSummary.material_cost.toLocaleString()}
 />
 </Col>
 <Col span={12}>
 <Statistic
 title={t('construction.equipment_cost')}
 value={costSummary.equipment_cost.toLocaleString()}
 />
 </Col>
 <Col span={12}>
 <Statistic
 title={t('construction.subcontract_cost')}
 value={costSummary.subcontract_cost.toLocaleString()}
 />
 </Col>
 <Col span={24}>
 <Statistic
 title={t('construction.overhead_cost')}
 value={costSummary.overhead_cost.toLocaleString()}
 />
 </Col>
 </Row>
 )}
 </Card>
 </Space>
 )}
 </FormDialog>
 </>
 );
};

export default ConstructionProjects;
