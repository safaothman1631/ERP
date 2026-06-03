import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, Select, message, Modal, Radio } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, KeyOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { space } from '../../theme/tokens';

dayjs.extend(relativeTime);

interface Device {
 id: string;
 name: string;
 device_type: string;
 serial_number?: string;
 location?: string;
 status: string;
 last_seen_at?: string;
 api_key?: string;
}

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const IoTDevices: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [form] = Form.useForm();
 const [loading, setLoading] = useState(false);
 const [devices, setDevices] = useState<Device[]>([]);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(20);
 const [filters, setFilters] = useState<any>({});
 const [search, setSearch] = useState('');
 const [modalVisible, setModalVisible] = useState(false);
 const [keyModalVisible, setKeyModalVisible] = useState(false);
 const [newApiKey, setNewApiKey] = useState('');
 const [editingId, setEditingId] = useState<string | null>(null);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('iot-devices.hiddenCols') || '[]'); } catch { return []; }
 });

 useEffect(() => {
 loadDevices();
 }, [page, pageSize, filters]);

 const loadDevices = async () => {
 try {
 setLoading(true);
 const params: any = {
 limit: pageSize,
 offset: (page - 1) * pageSize
 };
 if (filters.status) params.status = filters.status;
 if (filters.device_type) params.device_type = filters.device_type;
 if (filters.location) params.location = filters.location;

 const res = await api.get('/api/iot/devices', { params });
 setDevices(res.data.items);
 setTotal(res.data.total);
 } catch (_err) {
 message.error(t('common.load_failed', 'Failed to load'));
 } finally {
 setLoading(false);
 }
 };

 const handleCreate = () => {
 setEditingId(null);
 form.resetFields();
 setModalVisible(true);
 };

 const handleEdit = (record: Device) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setModalVisible(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: Device) => {
 setEditingId(null);
 const { id: _id, api_key: _apiKey, ...rest } = record;
 form.setFieldsValue({ ...rest, name: `${record.name ?? ''} (${t('copy', 'copy')})` });
 setModalVisible(true);
 };

 const handleSubmit = async () => {
 try {
 const values = await form.validateFields();
 if (editingId) {
 await api.put(`/api/iot/devices/${editingId}`, values);
 message.success(t('common.updated', 'Updated'));
 } else {
 const res = await api.post('/api/iot/devices', values);
 message.success(t('common.created', 'Created'));
 // Show API key
 setNewApiKey(res.data.api_key);
 setKeyModalVisible(true);
 }
 setModalVisible(false);
 loadDevices();
 } catch (_err) {
 message.error(t('common.save_failed', 'Save failed'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/iot/devices/${id}`);
 message.success(t('common.deleted', 'Deleted'));
 loadDevices();
 } catch (_err) {
 message.error(t('common.delete_failed', 'Delete failed'));
 }
 };

 const confirmDelete = (id: string) => {
 Modal.confirm({
 title: t('common.delete_confirm', 'Delete?'),
 okButtonProps: { danger: true },
 onOk: () => handleDelete(id),
 });
 };

 const handleRegenerateKey = async (id: string) => {
 try {
 const res = await api.post(`/api/iot/devices/${id}/regenerate-key`);
 setNewApiKey(res.data.api_key);
 setKeyModalVisible(true);
 message.success(t('iot.key_regenerated', 'API key regenerated'));
 } catch (_err) {
 message.error(t('common.operation_failed', 'Operation failed'));
 }
 };

 const confirmRegenerateKey = (id: string) => {
 Modal.confirm({
 title: t('iot.regenerate_key_confirm', 'Regenerate API key? Old key will be invalidated.'),
 onOk: () => handleRegenerateKey(id),
 });
 };

 const statusKind = (status: string) => {
 const map: Record<string, string> = {
 active: 'success',
 inactive: 'default',
 error: 'error'
 };
 return map[status] || 'default';
 };

 // Kit list tabs (All / Active / Inactive / Error) — server-side filtered by `status`.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'active', label: t('iot.status_active', 'Active') },
 { key: 'inactive', label: t('iot.status_inactive', 'Inactive') },
 { key: 'error', label: t('iot.status_error', 'Error') },
 ];
 const tab = filters.status ?? 'all';
 const setTab = (key: string) => {
 setFilters({ ...filters, status: key === 'all' ? undefined : key });
 setPage(1);
 };

 const statusOptions = [
 { value: 'active', label: t('iot.status_active', 'Active') },
 { value: 'inactive', label: t('iot.status_inactive', 'Inactive') },
 { value: 'error', label: t('iot.status_error', 'Error') },
 ];
 const typeOptions = [
 { value: 'sensor', label: t('iot.device_type_sensor', 'Sensor') },
 { value: 'printer', label: t('iot.device_type_printer', 'Printer') },
 { value: 'camera', label: t('iot.device_type_camera', 'Camera') },
 { value: 'scanner', label: t('iot.device_type_scanner', 'Scanner') },
 { value: 'gateway', label: t('iot.device_type_gateway', 'Gateway') },
 { value: 'other', label: t('iot.device_type_other', 'Other') },
 ];

 const allColumns = [
 {
 title: t('iot.name', 'Name'),
 dataIndex: 'name',
 key: 'name',
 render: (text: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(text)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{text}</span>
 </div>
 ),
 },
 {
 title: t('iot.device_type', 'Type'),
 dataIndex: 'device_type',
 key: 'device_type',
 render: (val: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(`iot.device_type_${val}`, val)}</span>
 ),
 },
 {
 title: t('iot.location', 'Location'),
 dataIndex: 'location',
 key: 'location',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('iot.serial_number', 'Serial'),
 dataIndex: 'serial_number',
 key: 'serial_number',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('iot.status', 'Status'),
 dataIndex: 'status',
 key: 'status',
 render: (val: string) => (
 <StatusTag status={statusKind(val)} label={t(`iot.status_${val}`, val)} />
 )
 },
 {
 title: t('iot.last_seen', 'Last Seen'),
 dataIndex: 'last_seen_at',
 key: 'last_seen_at',
 render: (val: string) => val
 ? <span style={{ color: 'var(--ink-600)' }}>{dayjs(val).fromNow()}</span>
 : <span style={{ color: 'var(--ink-400)' }}>{t('common.never', 'Never')}</span>
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: Device) => (
 <KitRowActions
 ariaLabel={t('common.actions', 'Actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('common.view', 'View'), onClick: () => navigate(`/iot/devices/${record.id}`) },
 { key: 'edit', icon: <EditOutlined />, label: t('common.edit', 'Edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 { key: 'regenerate', icon: <KeyOutlined />, label: t('iot.regenerate_key', 'Regenerate API key'), onClick: () => confirmRegenerateKey(record.id) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('common.delete', 'Delete'), danger: true, onClick: () => confirmDelete(record.id) },
 ]}
 />
 )
 }
 ];

 // Client-side search filter across all device fields (backend has no `q` param).
 const filteredData = useMemo(() => {
 if (!search) return devices;
 const q = search.toLowerCase();
 return devices.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [devices, search]);

 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('iot-devices.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const activeFilterCount = (filters.status ? 1 : 0) + (filters.device_type ? 1 : 0);

 return (
 <div style={{ padding: space.lg }}>
 <PageHeader
 title={t('iot.devices', 'IoT Devices')}
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={loadDevices} />
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('iot.register_device', 'Register Device')}
 </Button>
 </Space>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={setTab}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); setPage(1); }}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={activeFilterCount}
 onClear={() => { setFilters({}); setPage(1); }}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', marginBottom: 6 }}>
 {t('iot.filter_status', 'Filter by status')}
 </div>
 <Radio.Group
 value={filters.status ?? 'all'}
 onChange={(e) => { setFilters({ ...filters, status: e.target.value === 'all' ? undefined : e.target.value }); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 {statusOptions.map((o) => <Radio key={o.value} value={o.value}>{o.label}</Radio>)}
 </Radio.Group>
 </div>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', marginBottom: 6 }}>
 {t('iot.filter_type', 'Filter by type')}
 </div>
 <Radio.Group
 value={filters.device_type ?? 'all'}
 onChange={(e) => { setFilters({ ...filters, device_type: e.target.value === 'all' ? undefined : e.target.value }); setPage(1); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 {typeOptions.map((o) => <Radio key={o.value} value={o.value}>{o.label}</Radio>)}
 </Radio.Group>
 </div>
 </div>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('iot.status', 'Status')}
 anyLabel={t('all', 'All')}
 value={filters.status ?? ''}
 onChange={(v) => { setFilters({ ...filters, status: v || undefined }); setPage(1); }}
 options={statusOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('iot-devices', devices, cols);
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
 dataSource={filteredData}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{
 current: page,
 pageSize,
 total,
 showSizeChanger: true,
 showTotal: (tot) => `${tot} ${t('common.total', 'total')}`,
 onChange: (p, ps) => {
 setPage(p);
 setPageSize(ps || 20);
 }
 }}
 />
 </KitListCard>

 <FormDialog
 title={editingId ? t('iot.edit_device', 'Edit Device') : t('iot.register_device', 'Register Device')}
 open={modalVisible}
 onOk={handleSubmit}
 onClose={() => setModalVisible(false)}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('iot.name', 'Name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="device_type" label={t('iot.device_type', 'Type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="sensor">{t('iot.device_type_sensor', 'Sensor')}</Select.Option>
 <Select.Option value="printer">{t('iot.device_type_printer', 'Printer')}</Select.Option>
 <Select.Option value="camera">{t('iot.device_type_camera', 'Camera')}</Select.Option>
 <Select.Option value="scanner">{t('iot.device_type_scanner', 'Scanner')}</Select.Option>
 <Select.Option value="gateway">{t('iot.device_type_gateway', 'Gateway')}</Select.Option>
 <Select.Option value="other">{t('iot.device_type_other', 'Other')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="serial_number" label={t('iot.serial_number', 'Serial Number')}>
 <Input />
 </Form.Item>
 <Form.Item name="location" label={t('iot.location', 'Location')}>
 <Input />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('iot.api_key', 'API Key')}
 open={keyModalVisible}
 onOk={() => setKeyModalVisible(false)}
 onCancel={() => setKeyModalVisible(false)}
 footer={[
 <Button key="copy" type="primary" onClick={() => {
 navigator.clipboard.writeText(newApiKey);
 message.success(t('common.copied', 'Copied'));
 }}>
 {t('common.copy', 'Copy')}
 </Button>,
 <Button key="close" onClick={() => setKeyModalVisible(false)}>
 {t('common.close', 'Close')}
 </Button>
 ]}
 >
 <p>{t('iot.api_key_warning', 'Save this API key — it will not be shown again.')}</p>
 <Input.TextArea value={newApiKey} readOnly rows={2} />
 </FormDialog>
 </div>
 );
};

export default IoTDevices;
