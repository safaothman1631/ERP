import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
 MiniMap,
 Controls,
 Background,
 useNodesState,
 useEdgesState,
 addEdge,
 Panel,
} from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { Button, Input, Form, Select, message, Space, Card, Divider } from 'antd';
import { SaveOutlined, PlayCircleOutlined, ThunderboltOutlined, HistoryOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
import { space } from '../../theme/tokens';
import { FormDialog } from '../../components/responsive/FormDialog';

const { TextArea } = Input;

// Node-type identity colors for the ReactFlow canvas. Kept as fixed hues (the
// canvas needs concrete colors) but sourced from the Vertex semantic palette so
// they read as success / warning / accent / violet and stay on-brand.
const nodeTypes = {
 trigger: { label: 'Trigger', color: '#16A34A', icon: '⚡' },
 condition: { label: 'Condition', color: '#F59E0B', icon: '?' },
 action: { label: 'Action', color: '#7B61FF', icon: '▶' },
 delay: { label: 'Delay', color: '#9333EA', icon: '⏱' },
};

const WorkflowBuilder: React.FC = () => {
 const { t } = useTranslation();
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const [workflow, setWorkflow] = useState<any>(null);
 const [nodes, setNodes, onNodesChange] = useNodesState([]);
 const [edges, setEdges, onEdgesChange] = useEdgesState([]);
 const [selectedNode, setSelectedNode] = useState<any>(null);
 const [sidebarOpen, setSidebarOpen] = useState(false);
 const [testDrawerOpen, setTestDrawerOpen] = useState(false);
 const [testData, setTestData] = useState('{}');
 const [testTrace, setTestTrace] = useState<any[]>([]);
 const [actions, setActions] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [form] = Form.useForm();

 useEffect(() => {
 void fetchWorkflow();
 void fetchActions();
 }, [id]);

 const fetchWorkflow = async () => {
 if (!id) return;
 setLoading(true);
 try {
 const res = await api.get(`/api/automation/workflows/${id}`);
 setWorkflow(res.data);
 
 // Convert stored nodes/edges to ReactFlow format
 const rfNodes: Node[] = res.data.nodes?.map((n: any) => ({
 id: n.id,
 type: 'default',
 position: n.position || { x: 100, y: 100 },
 data: { 
 label: `${nodeTypes[n.type as keyof typeof nodeTypes]?.icon || ''} ${n.type}`,
 ...n,
 },
 style: { 
 backgroundColor: nodeTypes[n.type as keyof typeof nodeTypes]?.color || '#ddd',
 color: '#fff',
 padding: 10,
 borderRadius: 8,
 },
 })) || [];
 
 const rfEdges: Edge[] = res.data.edges?.map((e: any, idx: number) => ({
 id: `e${idx}`,
 source: e.from_node_id,
 target: e.to_node_id,
 label: e.condition,
 })) || [];
 
 setNodes(rfNodes);
 setEdges(rfEdges);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchActions = async () => {
 try {
 const res = await api.get('/api/automation/actions');
 setActions(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 const onConnect = useCallback(
 (params: Connection) => setEdges((eds) => addEdge(params, eds)),
 [setEdges]
 );

 const onNodeClick = (_: any, node: Node) => {
 setSelectedNode(node.data);
 form.setFieldsValue(node.data.config || {});
 setSidebarOpen(true);
 };

 const handleSaveNodeConfig = async (values: any) => {
 if (!selectedNode) return;
 
 // Update node in memory
 setNodes((nds) =>
 nds.map((n) => {
 if (n.id === selectedNode.id) {
 return {
 ...n,
 data: {
 ...n.data,
 config: values,
 },
 };
 }
 return n;
 })
 );
 
 message.success(t('automation.node_updated'));
 setSidebarOpen(false);
 };

 const handleSaveWorkflow = async () => {
 if (!workflow || !id) return;
 
 try {
 // Convert ReactFlow nodes/edges back to storage format
 const storageNodes = nodes.map((n) => ({
 id: n.id,
 type: n.data.type,
 config: n.data.config || {},
 position: n.position,
 }));
 
 const storageEdges = edges.map((e) => ({
 from_node_id: e.source,
 to_node_id: e.target,
 condition: e.label as string,
 }));
 
 await api.put(`/api/automation/workflows/${id}`, {
 nodes: storageNodes,
 edges: storageEdges,
 });
 
 message.success(t('automation.workflow_saved'));
 } catch {
 message.error(t('error'));
 }
 };

 const handleTestRun = async () => {
 if (!id) return;
 
 try {
 let sampleData = {};
 try {
 sampleData = JSON.parse(testData);
 } catch {
 message.error(t('automation.invalid_json'));
 return;
 }
 
 const res = await api.post(`/api/automation/workflows/${id}/test-run`, sampleData);
 setTestTrace(res.data.trace || []);
 message.success(t('automation.test_run_complete'));
 } catch {
 message.error(t('error'));
 }
 };

 const handleToggleActive = async () => {
 if (!id) return;
 
 try {
 const res = await api.post(`/api/automation/workflows/${id}/toggle`);
 setWorkflow((wf: any) => ({ ...wf, active: res.data.active }));
 message.success(t('success'));
 } catch {
 message.error(t('error'));
 }
 };

 const addNodeToCanvas = (type: string) => {
 const newNode: Node = {
 id: `node_${Date.now()}`,
 type: 'default',
 position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
 data: {
 label: `${nodeTypes[type as keyof typeof nodeTypes]?.icon || ''} ${type}`,
 type,
 config: {},
 },
 style: {
 backgroundColor: nodeTypes[type as keyof typeof nodeTypes]?.color || '#ddd',
 color: '#fff',
 padding: 10,
 borderRadius: 8,
 },
 };
 setNodes((nds) => [...nds, newNode]);
 };

 if (loading || !workflow) {
 return <div style={{ padding: space.lg }}>Loading...</div>;
 }

 return (
 <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
 <PageHeader
 title={
 <Input
 value={workflow.name}
 onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
 style={{ width: 300 }}
 bordered={false}
 />
 }
 extra={
 <Space>
 <StatusTag status={workflow.active ? 'active' : 'inactive'} label={workflow.active ? t('automation.active') : t('automation.inactive')} />
 <Button icon={<ThunderboltOutlined />} onClick={handleToggleActive}>
 {workflow.active ? t('automation.deactivate') : t('automation.activate')}
 </Button>
 <Button icon={<PlayCircleOutlined />} onClick={() => setTestDrawerOpen(true)}>
 {t('automation.test_run')}
 </Button>
 <Button icon={<HistoryOutlined />} onClick={() => navigate(`/automation/workflows/${id}/runs`)}>
 {t('automation.run_history')}
 </Button>
 <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveWorkflow}>
 {t('save')}
 </Button>
 </Space>
 }
 />

 <div style={{ display: 'flex', flex: 1 }}>
 {/* Left Palette */}
 <div style={{ width: 240, borderInlineEnd: '1px solid var(--border)', padding: space.md, overflowY: 'auto', background: 'var(--surface)' }}>
 <h3>{t('automation.palette')}</h3>
 <Divider />
 
 <h4>{t('automation.conditions')}</h4>
 <Button
 block
 style={{ marginBottom: space.sm }}
 onClick={() => addNodeToCanvas('condition')}
 >
 {nodeTypes.condition.icon} {t('automation.condition')}
 </Button>
 
 <h4 style={{ marginTop: space.md }}>{t('automation.actions')}</h4>
 {actions.map((action) => (
 <Button
 key={action.type}
 block
 style={{ marginBottom: space.sm }}
 onClick={() => {
 const newNode: Node = {
 id: `node_${Date.now()}`,
 type: 'default',
 position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
 data: {
 label: `${nodeTypes.action.icon} ${action.label}`,
 type: 'action',
 config: { action_type: action.type },
 },
 style: {
 backgroundColor: nodeTypes.action.color,
 color: '#fff',
 padding: 10,
 borderRadius: 8,
 },
 };
 setNodes((nds) => [...nds, newNode]);
 }}
 >
 {nodeTypes.action.icon} {action.label}
 </Button>
 ))}
 
 <h4 style={{ marginTop: space.md }}>{t('automation.delays')}</h4>
 <Button
 block
 style={{ marginBottom: space.sm }}
 onClick={() => addNodeToCanvas('delay')}
 >
 {nodeTypes.delay.icon} {t('automation.delay')}
 </Button>
 </div>

 {/* Center Canvas */}
 <div style={{ flex: 1 }}>
 <ReactFlow
 nodes={nodes}
 edges={edges}
 onNodesChange={onNodesChange}
 onEdgesChange={onEdgesChange}
 onConnect={onConnect}
 onNodeClick={onNodeClick}
 fitView
 >
 <Controls />
 <MiniMap />
 <Background gap={12} />
 <Panel position="top-left">
 <SectionCard style={{ marginBottom: 0 }}>
 <strong>{t('automation.trigger')}:</strong> {workflow.trigger?.event || 'N/A'}
 </SectionCard>
 </Panel>
 </ReactFlow>
 </div>
 </div>

 {/* Right Sidebar - Node Config */}
 <FormDialog
 title={t('automation.node_config')}
 open={sidebarOpen}
 onClose={() => setSidebarOpen(false)}
 >
 {selectedNode && (
 <Form form={form} layout="vertical" onFinish={handleSaveNodeConfig}>
 <p><strong>{t('automation.node_type')}:</strong> {selectedNode.type}</p>
 
 {selectedNode.type === 'action' && (
 <>
 <Form.Item name="action_type" label={t('automation.action_type')}>
 <Select>
 {actions.map((a) => (
 <Select.Option key={a.type} value={a.type}>{a.label}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 
 {/* Dynamic fields based on action type */}
 {form.getFieldValue('action_type') === 'send_email' && (
 <>
 <Form.Item name="to" label={t('automation.email_to')}>
 <Input placeholder="email@example.com" />
 </Form.Item>
 <Form.Item name="subject" label={t('automation.email_subject')}>
 <Input />
 </Form.Item>
 <Form.Item name="body" label={t('automation.email_body')}>
 <TextArea rows={4} placeholder={t('automation.use_variables')} />
 </Form.Item>
 </>
 )}
 
 {form.getFieldValue('action_type') === 'send_sms' && (
 <>
 <Form.Item name="phone" label={t('automation.phone')}>
 <Input placeholder="+9647XXXXXXXXX" />
 </Form.Item>
 <Form.Item name="message" label={t('automation.sms_message')}>
 <TextArea rows={3} />
 </Form.Item>
 </>
 )}
 
 {form.getFieldValue('action_type') === 'http_webhook' && (
 <>
 <Form.Item name="url" label={t('automation.webhook_url')}>
 <Input placeholder="https://example.com/webhook" />
 </Form.Item>
 <Form.Item name="method" label={t('automation.http_method')}>
 <Select defaultValue="POST">
 <Select.Option value="GET">GET</Select.Option>
 <Select.Option value="POST">POST</Select.Option>
 <Select.Option value="PUT">PUT</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="body" label={t('automation.request_body')}>
 <TextArea rows={4} placeholder='{"key": "value"}' />
 </Form.Item>
 </>
 )}
 </>
 )}
 
 {selectedNode.type === 'condition' && (
 <Form.Item name="expression" label={t('automation.condition_expression')}>
 <TextArea rows={3} placeholder='amount > 1000' />
 </Form.Item>
 )}
 
 {selectedNode.type === 'delay' && (
 <Form.Item name="delay_ms" label={t('automation.delay_milliseconds')}>
 <Input type="number" placeholder="1000" />
 </Form.Item>
 )}
 
 <Button type="primary" htmlType="submit" block>
 {t('save')}
 </Button>
 </Form>
 )}
 </FormDialog>

 {/* Test Run Drawer */}
 <FormDialog
 title={t('automation.test_run')}
 open={testDrawerOpen}
 onClose={() => setTestDrawerOpen(false)}
 >
 <Form layout="vertical">
 <Form.Item label={t('automation.sample_data')}>
 <TextArea
 rows={6}
 value={testData}
 onChange={(e) => setTestData(e.target.value)}
 placeholder='{"invoice_id": "INV-001", "amount": 1000}'
 />
 </Form.Item>
 <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleTestRun} block>
 {t('automation.run')}
 </Button>
 </Form>

 {testTrace.length > 0 && (
 <div style={{ marginTop: space.lg }}>
 <Divider>{t('automation.trace')}</Divider>
 {testTrace.map((step, idx) => (
 <Card key={idx} style={{ marginBottom: space.sm }}>
 <p><strong>{t('automation.node_id')}:</strong> {step.node_id}</p>
 <p><strong>{t('automation.status')}:</strong>{' '}
 <StatusTag status={step.status === 'ok' ? 'success' : 'error'} label={step.status} />
 </p>
 {step.output && (
 <p><strong>{t('automation.output')}:</strong> {JSON.stringify(step.output)}</p>
 )}
 {step.error && (
 <p style={{ color: 'var(--danger-500)' }}><strong>{t('error')}:</strong> {step.error}</p>
 )}
 </Card>
 ))}
 </div>
 )}
 </FormDialog>
 </div>
 );
};

export default WorkflowBuilder;
