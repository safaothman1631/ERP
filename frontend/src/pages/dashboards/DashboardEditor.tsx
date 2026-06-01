import React, { useEffect, useState } from 'react';
import { Button, Space, Input, Card, Form, Select, InputNumber, message, Row, Col, Tag, Typography, Modal } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
// react-grid-layout uses CommonJS namespace export — import as default and destructure
import RGL from 'react-grid-layout';
const { Responsive, WidthProvider } = RGL as any;
type Layout = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };
import api from '../../api';
import { PageHeader, SectionCard } from '../../design-system';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Title, Text } = Typography;
const ResponsiveGridLayout = WidthProvider(Responsive);

const DashboardEditor: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const { id } = useParams<{ id: string }>();
 const [_dashboard, setDashboard] = useState<any>(null);
 const [widgets, setWidgets] = useState<any[]>([]);
 const [name, setName] = useState('');
 const [loading, setLoading] = useState(true);
 const [addDrawerOpen, setAddDrawerOpen] = useState(false);
 const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
 const [catalog, setCatalog] = useState<any[]>([]);
 const [selectedWidget, setSelectedWidget] = useState<any>(null);
 const [hasChanges, setHasChanges] = useState(false);

 useEffect(() => {
 if (id) {
 fetchDashboard();
 fetchCatalog();
 }
 }, [id]);

 const fetchDashboard = async () => {
 setLoading(true);
 try {
 const res = await api.get(`/api/dashboards/${id}`);
 const dash = res.data.data;
 setDashboard(dash);
 setName(dash.name);
 setWidgets(dash.widgets || []);
 } catch (_err) {
 message.error(t('load_error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchCatalog = async () => {
 try {
 const res = await api.get('/api/dashboards/widget-catalog');
 setCatalog(res.data.data || []);
 } catch (err) {
 console.error('Catalog load error:', err);
 }
 };

 const handleSave = async () => {
 if (!name.trim()) {
 message.error(t('name_required'));
 return;
 }
 try {
 await api.put(`/api/dashboards/${id}`, { name, widgets });
 message.success(t('saved'));
 setHasChanges(false);
 navigate(`/dashboards/${id}`);
 } catch (_err) {
 message.error(t('save_error'));
 }
 };

 const handleAddWidget = (template: any) => {
 const newWidget = {
 id: `widget-${Date.now()}`,
 type: template.type,
 title: template.label,
 data_source: template.available_data_sources[0] || { key: '', params: {}, value_path: 'data.value' },
 layout: {
 x: 0,
 y: widgets.length * 2,
 w: template.type === 'kpi' ? 3 : 6,
 h: template.type === 'kpi' ? 2 : 4
 },
 config: template.default_config || {},
 refresh_interval_sec: null
 };
 setWidgets([...widgets, newWidget]);
 setHasChanges(true);
 setAddDrawerOpen(false);
 };

 const handleDeleteWidget = (widgetId: string) => {
 Modal.confirm({
 title: t('confirm_delete'),
 content: t('delete_widget_confirm'),
 okText: t('delete'),
 okType: 'danger',
 cancelText: t('cancel'),
 onOk: () => {
 setWidgets(widgets.filter((w) => w.id !== widgetId));
 setHasChanges(true);
 }
 });
 };

 const handleLayoutChange = (newLayouts: Layout[]) => {
 const updatedWidgets = widgets.map((widget) => {
 const layout = newLayouts.find((l) => l.i === widget.id);
 if (layout) {
 return {
 ...widget,
 layout: { x: layout.x, y: layout.y, w: layout.w, h: layout.h }
 };
 }
 return widget;
 });
 setWidgets(updatedWidgets);
 setHasChanges(true);
 };

 const handleConfigSave = (config: any) => {
 const updatedWidgets = widgets.map((w) =>
 w.id === selectedWidget.id ? { ...w, ...config } : w
 );
 setWidgets(updatedWidgets);
 setHasChanges(true);
 setConfigDrawerOpen(false);
 setSelectedWidget(null);
 };

 const openConfig = (widgetId: string) => {
 const widget = widgets.find((w) => w.id === widgetId);
 if (widget) {
 setSelectedWidget(widget);
 setConfigDrawerOpen(true);
 }
 };

 const layouts: Layout[] = widgets.map((w) => ({
 i: w.id,
 x: w.layout.x,
 y: w.layout.y,
 w: w.layout.w,
 h: w.layout.h,
 minW: 2,
 minH: 2
 }));

 const renderWidgetPlaceholder = (widget: any) => (
 <SectionCard
 style={{ height: '100%', position: 'relative', marginBottom: 0 }}
 title={widget.title}
 extra={
 <Space>
 <Button icon={<SettingOutlined />} onClick={() => openConfig(widget.id)} />
 <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteWidget(widget.id)} />
 </Space>
 }
 >
 <div style={{ textAlign: 'center', padding: '20px' }}>
 <Tag color={widget.config?.color || 'blue'}>{widget.type.toUpperCase()}</Tag>
 <div style={{ marginTop: 12 }}>
 <Text type="secondary">{t('data_source')}: {widget.data_source?.key || t('not_configured')}</Text>
 </div>
 </div>
 </SectionCard>
 );

 const handleCancel = () => {
 if (hasChanges) {
 Modal.confirm({
 title: t('unsaved_changes'),
 content: t('unsaved_changes_message'),
 okText: t('leave'),
 cancelText: t('stay'),
 onOk: () => navigate(`/dashboards/${id}`)
 });
 } else {
 navigate(`/dashboards/${id}`);
 }
 };

 if (loading) return <div>{t('loading')}</div>;

 return (
 <div>
 <PageHeader
 title={
 <Input
 value={name}
 onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
 style={{ maxWidth: 400 }}
 placeholder={t('dashboard_name')}
 />
 }
 subtitle={t('dashboard_editor')}
 extra={
 <Space>
 <Button icon={<PlusOutlined />} onClick={() => setAddDrawerOpen(true)}>
 {t('add_widget')}
 </Button>
 <Button onClick={handleCancel} icon={<CloseOutlined />}>
 {t('cancel')}
 </Button>
 <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
 {t('save')}
 </Button>
 </Space>
 }
 />

 <div style={{ background: 'var(--surface-2)', padding: 16, minHeight: 600, borderRadius: 'var(--radius-lg)' }}>
 {widgets.length === 0 ? (
 <div style={{ textAlign: 'center', padding: 60 }}>
 <Text type="secondary">{t('no_widgets_message')}</Text>
 <div style={{ marginTop: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddDrawerOpen(true)}>
 {t('add_first_widget')}
 </Button>
 </div>
 </div>
 ) : (
 <ResponsiveGridLayout
 className="layout"
 layouts={{ lg: layouts }}
 breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
 cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
 rowHeight={100}
 onLayoutChange={handleLayoutChange}
 isDraggable
 isResizable
 >
 {widgets.map((widget) => (
 <div key={widget.id}>
 {renderWidgetPlaceholder(widget)}
 </div>
 ))}
 </ResponsiveGridLayout>
 )}
 </div>

 {/* Add Widget Drawer */}
 <FormDialog
 title={t('add_widget')}
 open={addDrawerOpen}
 onClose={() => setAddDrawerOpen(false)}
 >
 <Row gutter={[16, 16]}>
 {catalog.map((template, idx) => (
 <Col span={12} key={idx}>
 <Card
 hoverable
 onClick={() => handleAddWidget(template)}
 style={{ height: 140 }}
 >
 <Space direction="vertical">
 <Tag color={template.default_config?.color || 'blue'}>{template.type.toUpperCase()}</Tag>
 <Title level={5} style={{ margin: 0 }}>{template.label}</Title>
 <Text type="secondary" style={{ fontSize: 12 }}>{template.description}</Text>
 </Space>
 </Card>
 </Col>
 ))}
 </Row>
 </FormDialog>

 {/* Config Widget Drawer */}
 <FormDialog
 title={t('widget_settings')}
 open={configDrawerOpen}
 onClose={() => setConfigDrawerOpen(false)}
 footer={
 <Space style={{ float: 'right' }}>
 <Button onClick={() => setConfigDrawerOpen(false)}>{t('cancel')}</Button>
 <Button
 type="primary"
 onClick={() => {
 const formData = {
 title: selectedWidget?.title,
 data_source: selectedWidget?.data_source,
 config: selectedWidget?.config,
 refresh_interval_sec: selectedWidget?.refresh_interval_sec
 };
 handleConfigSave(formData);
 }}
 >
 {t('save')}
 </Button>
 </Space>
 }
 >
 {selectedWidget && (
 <Form layout="vertical">
 <Form.Item label={t('title')}>
 <Input
 value={selectedWidget.title}
 onChange={(e) => setSelectedWidget({ ...selectedWidget, title: e.target.value })}
 />
 </Form.Item>

 <Form.Item label={t('data_source')}>
 <Select
 value={selectedWidget.data_source?.key}
 onChange={(key) => {
 const template = catalog.find((c) => c.available_data_sources.some((ds: any) => ds.key === key));
 const ds = template?.available_data_sources.find((d: any) => d.key === key);
 setSelectedWidget({
 ...selectedWidget,
 data_source: { key, params: {}, value_path: 'data.value', ...ds }
 });
 }}
 >
 {catalog
 .filter((c) => c.type === selectedWidget.type)
 .flatMap((c) => c.available_data_sources)
 .map((ds: any) => (
 <Select.Option key={ds.key} value={ds.key}>
 {ds.label}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item label={t('refresh_interval')} help={t('refresh_interval_help')}>
 <InputNumber
 value={selectedWidget.refresh_interval_sec}
 onChange={(val) => setSelectedWidget({ ...selectedWidget, refresh_interval_sec: val })}
 min={0}
 step={60}
 style={{ width: '100%' }}
 placeholder={t('manual_only')}
 />
 </Form.Item>

 <Form.Item label={t('color')}>
 <Select
 value={selectedWidget.config?.color}
 onChange={(color) =>
 setSelectedWidget({
 ...selectedWidget,
 config: { ...selectedWidget.config, color }
 })
 }
 >
 <Select.Option value="blue">Blue</Select.Option>
 <Select.Option value="green">Green</Select.Option>
 <Select.Option value="red">Red</Select.Option>
 <Select.Option value="orange">Orange</Select.Option>
 <Select.Option value="purple">Purple</Select.Option>
 <Select.Option value="cyan">Cyan</Select.Option>
 <Select.Option value="magenta">Magenta</Select.Option>
 </Select>
 </Form.Item>

 {selectedWidget.type === 'kpi' && (
 <Form.Item label={t('unit')}>
 <Input
 value={selectedWidget.config?.unit}
 onChange={(e) =>
 setSelectedWidget({
 ...selectedWidget,
 config: { ...selectedWidget.config, unit: e.target.value }
 })
 }
 placeholder="IQD"
 />
 </Form.Item>
 )}
 </Form>
 )}
 </FormDialog>
 </div>
 );
};

export default DashboardEditor;
