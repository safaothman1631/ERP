import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, InputNumber, Select, Row, Col, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import type { StatusKind } from '../../design-system';
import KitListCard from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

// Map POS table states → StatusTag semantic kinds (auto-flip tokens).
const TABLE_STATE_KIND: Record<string, StatusKind> = {
 available: 'active',
 occupied: 'error',
 reserved: 'warning',
 paying: 'info',
};

const POSFloors: React.FC = () => {
 const { t } = useTranslation();
 const [floors, setFloors] = useState<any[]>([]);
 const [configs, setConfigs] = useState<any[]>([]);
 const [selectedConfigId, setSelectedConfigId] = useState<string>('');
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [floorModalVisible, setFloorModalVisible] = useState(false);
 const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
 const [floorForm] = Form.useForm();
 
 const [editorDrawerVisible, setEditorDrawerVisible] = useState(false);
 const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
 const [tables, setTables] = useState<any[]>([]);
 const [tableModalVisible, setTableModalVisible] = useState(false);
 const [editingTableId, setEditingTableId] = useState<string | null>(null);
 const [tableForm] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('pos_floors.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchConfigs = async () => {
 try {
 const res = await api.get('/api/pos/configs', { params: { page_size: 100 } });
 setConfigs(res.data.items || []);
 if (res.data.items?.length > 0) {
 setSelectedConfigId(res.data.items[0].id);
 }
 } catch {
 message.error(t('error'));
 }
 };

 const fetchFloors = async () => {
 if (!selectedConfigId) return;
 setLoading(true);
 try {
 const res = await api.get('/api/pos/floors', { params: { config_id: selectedConfigId } });
 setFloors(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchTables = async (floorId: string) => {
 try {
 const res = await api.get(`/api/pos/floors/${floorId}/tables`);
 setTables(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 useEffect(() => {
 fetchConfigs();
 }, []);

 useEffect(() => {
 fetchFloors();
 }, [selectedConfigId]);

 const openFloorModal = (record?: any) => {
 if (record) {
 setEditingFloorId(record.id);
 floorForm.setFieldsValue(record);
 } else {
 setEditingFloorId(null);
 floorForm.resetFields();
 floorForm.setFieldsValue({
 config_id: selectedConfigId,
 sequence: 0,
 is_active: true,
 });
 }
 setFloorModalVisible(true);
 };

 const handleFloorSubmit = async (values: any) => {
 try {
 if (editingFloorId) {
 await api.put(`/api/pos/floors/${editingFloorId}`, values);
 } else {
 await api.post('/api/pos/floors', values);
 }
 message.success(t('success'));
 setFloorModalVisible(false);
 fetchFloors();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDeleteFloor = (id: string) => {
 Modal.confirm({
 title: t('pos.delete_floor_confirm'),
 onOk: async () => {
 try {
 await api.delete(`/api/pos/floors/${id}`);
 message.success(t('success'));
 fetchFloors();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const openFloorEditor = (floorId: string) => {
 setSelectedFloorId(floorId);
 setEditorDrawerVisible(true);
 fetchTables(floorId);
 };

 const openTableModal = (record?: any) => {
 if (record) {
 setEditingTableId(record.id);
 tableForm.setFieldsValue(record);
 } else {
 setEditingTableId(null);
 tableForm.resetFields();
 tableForm.setFieldsValue({
 floor_id: selectedFloorId,
 config_id: selectedConfigId,
 seats: 4,
 shape: 'square',
 width: 100,
 height: 100,
 position_x: 0,
 position_y: 0,
 color: '#7B61FF',
 is_active: true,
 });
 }
 setTableModalVisible(true);
 };

 const handleTableSubmit = async (values: any) => {
 try {
 if (editingTableId) {
 await api.put(`/api/pos/tables/${editingTableId}`, values);
 } else {
 await api.post('/api/pos/tables', values);
 }
 message.success(t('success'));
 setTableModalVisible(false);
 if (selectedFloorId) fetchTables(selectedFloorId);
 } catch {
 message.error(t('error'));
 }
 };

 const handleDeleteTable = (id: string) => {
 Modal.confirm({
 title: t('pos.delete_table_confirm'),
 onOk: async () => {
 try {
 await api.delete(`/api/pos/tables/${id}`);
 message.success(t('success'));
 if (selectedFloorId) fetchTables(selectedFloorId);
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const filteredFloors = useMemo(() => {
 if (!search) return floors;
 const q = search.toLowerCase();
 return floors.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }, [floors, search]);

 const allFloorColumns = [
 {
 title: t('pos.name'), dataIndex: 'name', key: 'name',
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(v)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 </div>
 ),
 },
 {
 title: t('pos.name_ku'), dataIndex: 'name_ku', key: 'name_ku',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('pos.sequence'), dataIndex: 'sequence', key: 'sequence',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v ?? '—'}</span>
 ),
 },
 {
 title: t('pos.status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (val: boolean) => <StatusTag status={val ? 'active' : 'inactive'} label={val ? t('active') : t('inactive')} />,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'plan', icon: <SettingOutlined />, label: t('pos.edit_floor_plan'), onClick: () => openFloorEditor(record.id) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openFloorModal(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDeleteFloor(record.id) },
 ]}
 />
 ),
 },
 ];
 const floorColumns = useMemo(
 () => allFloorColumns.filter((c) => !hiddenCols.includes(c.key)),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [hiddenCols, t],
 );
 const floorColumnsMeta: ColumnVisibilityItem[] = allFloorColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' && c.title ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('pos_floors.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const tableColumns = [
 {
 title: t('pos.table_name'), dataIndex: 'name', key: 'name',
 render: (v: string) => <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>,
 },
 {
 title: t('pos.seats'), dataIndex: 'seats', key: 'seats',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{v ?? '—'}</span>
 ),
 },
 {
 title: t('pos.shape'), dataIndex: 'shape', key: 'shape',
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(`pos.${v}`, v)}</span>
 ),
 },
 {
 title: t('pos.state'),
 dataIndex: 'state',
 key: 'state',
 render: (val: string) => (
 <StatusTag status={TABLE_STATE_KIND[val] ?? 'default'} label={t(`pos.table_state_${val}`)} />
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openTableModal(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDeleteTable(record.id) },
 ]}
 />
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('pos.floors')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openFloorModal()}>
 {t('pos.new_floor')}
 </Button>
 }
 />
 <KitListCard
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
 <Select
 style={{ width: 200 }}
 value={selectedConfigId}
 onChange={setSelectedConfigId}
 placeholder={t('pos.select_config')}
 >
 {configs.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={floorColumnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = floorColumnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('pos_floors', floors, cols);
 }}
 onPrint={() => window.print()}
 onImport={() => message.info(t('coming_soon', 'Coming soon'))}
 onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
 onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
 />
 </div>
 </>
 }
 >
 <ResponsiveTableAdapter
 dataSource={filteredFloors}
 columns={floorColumns}
 rowKey="id"
 loading={loading}
 pagination={false}
 />
 </KitListCard>

 <FormDialog
 title={editingFloorId ? t('pos.edit_floor') : t('pos.new_floor')}
 open={floorModalVisible}
 onClose={() => setFloorModalVisible(false)}
 onOk={() => floorForm.submit()}
 >
 <Form form={floorForm} layout="vertical" onFinish={handleFloorSubmit}>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="name" label={t('pos.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="name_ku" label={t('pos.name_ku')}>
 <Input />
 </Form.Item>
 </Col>
 </Row>
 <Form.Item name="config_id" label={t('pos.config')} rules={[{ required: true }]}>
 <Select disabled={!!editingFloorId}>
 {configs.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="sequence" label={t('pos.sequence')}>
 <InputNumber style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="background_image_url" label={t('pos.background_image_url')}>
 <Input placeholder="https://..." />
 </Form.Item>
 <Form.Item name="is_active" valuePropName="checked">
 <Select>
 <Select.Option value={true}>{t('active')}</Select.Option>
 <Select.Option value={false}>{t('inactive')}</Select.Option>
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('pos.floor_plan_editor')}
 onClose={() => setEditorDrawerVisible(false)}
 open={editorDrawerVisible}
 >
 <Space orientation="vertical" style={{ width: '100%' }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openTableModal()}>
 {t('pos.add_table')}
 </Button>
 <ResponsiveTableAdapter
 dataSource={tables}
 columns={tableColumns}
 rowKey="id"
 pagination={false}
 />
 </Space>
 </FormDialog>

 <FormDialog
 title={editingTableId ? t('pos.edit_table') : t('pos.add_table')}
 open={tableModalVisible}
 onClose={() => setTableModalVisible(false)}
 onOk={() => tableForm.submit()}
 >
 <Form form={tableForm} layout="vertical" onFinish={handleTableSubmit}>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="name" label={t('pos.table_name')} rules={[{ required: true }]}>
 <Input placeholder="T1" />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="seats" label={t('pos.seats')} rules={[{ required: true }]}>
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={8}>
 <Form.Item name="shape" label={t('pos.shape')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="square">{t('pos.square')}</Select.Option>
 <Select.Option value="round">{t('pos.round')}</Select.Option>
 <Select.Option value="rectangle">{t('pos.rectangle')}</Select.Option>
 </Select>
 </Form.Item>
 </Col>
 <Col span={8}>
 <Form.Item name="width" label={t('pos.width')} rules={[{ required: true }]}>
 <InputNumber min={50} max={500} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={8}>
 <Form.Item name="height" label={t('pos.height')} rules={[{ required: true }]}>
 <InputNumber min={50} max={500} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="position_x" label={t('pos.position_x')}>
 <InputNumber min={0} max={1200} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="position_y" label={t('pos.position_y')}>
 <InputNumber min={0} max={800} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Form.Item name="color" label={t('pos.color')}>
 <Input type="color" style={{ width: 100 }} />
 </Form.Item>
 <Form.Item name="floor_id" hidden>
 <Input />
 </Form.Item>
 <Form.Item name="config_id" hidden>
 <Input />
 </Form.Item>
 <Form.Item name="is_active" hidden initialValue={true}>
 <Input />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default POSFloors;
