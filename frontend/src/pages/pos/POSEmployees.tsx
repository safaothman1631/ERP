import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Tag, Switch, Form, Input, Select, App, Modal } from 'antd';
import { PlusOutlined, EditOutlined, LockOutlined, UnlockOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, StatusTag, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../../design-system';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Employee {
 id: string;
 name: string;
 name_ku?: string;
 role: string;
 config_ids: string[];
 barcode?: string;
 is_active: boolean;
 failed_pin_attempts: number;
 locked_until?: string;
}

interface Config {
 id: string;
 name: string;
}

const POSEmployees: React.FC = () => {
 const { t } = useTranslation();
 const { message } = App.useApp();
 const [form] = Form.useForm();
 
 const [employees, setEmployees] = useState<Employee[]>([]);
 const [configs, setConfigs] = useState<Config[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [_pinVisible, _setPinVisible] = useState(false);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('posEmployees.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 useEffect(() => {
 loadData();
 }, []);

 const loadData = async () => {
 setLoading(true);
 try {
 const [empRes, configRes] = await Promise.all([
 api.get('/api/pos/employees'),
 api.get('/api/pos/configs', { params: { page_size: 100 } }),
 ]);
 setEmployees(empRes.data.items || []);
 setConfigs(configRes.data.items || []);
 } catch (_error) {
 message.error(t('error_loading'));
 } finally {
 setLoading(false);
 }
 };

 const handleAdd = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ role: 'cashier', is_active: true, config_ids: [] });
 setModalOpen(true);
 };

 const handleEdit = (record: Employee) => {
 setEditingId(record.id);
 form.setFieldsValue({
 name: record.name,
 name_ku: record.name_ku,
 role: record.role,
 barcode: record.barcode,
 config_ids: record.config_ids,
 is_active: record.is_active,
 });
 setModalOpen(true);
 };

 const handleSubmit = async () => {
 try {
 const values = await form.validateFields();
 if (editingId) {
 await api.put(`/api/pos/employees/${editingId}`, values);
 message.success(t('updated_successfully'));
 } else {
 await api.post('/api/pos/employees', values);
 message.success(t('created_successfully'));
 }
 setModalOpen(false);
 loadData();
 } catch (_error) {
 message.error(t('error_saving'));
 }
 };

 const handleToggleActive = async (id: string, isActive: boolean) => {
 try {
 await api.put(`/api/pos/employees/${id}`, { is_active: isActive });
 message.success(t('updated_successfully'));
 loadData();
 } catch (_error) {
 message.error(t('error_saving'));
 }
 };

 const handleResetPin = (record: Employee) => {
 Modal.confirm({
 title: t('reset_pin'),
 content: t('reset_pin_confirm'),
 onOk: async () => {
 const pin = prompt(t('enter_new_pin'));
 if (pin && pin.length >= 4) {
 try {
 await api.put(`/api/pos/employees/${record.id}`, { pin });
 message.success(t('pin_reset_success'));
 loadData();
 } catch (_error) {
 message.error(t('error_saving'));
 }
 } else {
 message.error(t('pin_must_be_4_digits'));
 }
 },
 });
 };

 const columns = [
 {
 title: t('name'),
 dataIndex: 'name',
 key: 'name',
 render: (_: any, record: Employee) => (
 <div>
 <div>{record.name}</div>
 {record.name_ku && <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{record.name_ku}</div>}
 </div>
 ),
 },
 {
 title: t('role'),
 dataIndex: 'role',
 key: 'role',
 render: (role: string) => {
 const kind = role === 'manager' ? 'info' : role === 'waiter' ? 'active' : 'default';
 return <StatusTag status={kind} label={t(`pos_role_${role}`)} />;
 },
 },
 {
 title: t('configs'),
 dataIndex: 'config_ids',
 key: 'config_ids',
 render: (ids: string[]) => <Tag>{ids.length}</Tag>,
 },
 {
 title: t('barcode'),
 dataIndex: 'barcode',
 key: 'barcode',
 render: (barcode: string | undefined) => barcode ? <Tag icon={<BarcodeOutlined />}>{barcode}</Tag> : '-',
 },
 {
 title: t('status'),
 dataIndex: 'locked_until',
 key: 'locked_until',
 render: (locked: string | undefined, record: Employee) => {
 if (locked && new Date(locked) > new Date()) {
 return <StatusTag status="error" icon={<LockOutlined />} label={t('locked')} />;
 }
 return record.is_active ? <StatusTag status="active" label={t('active')} /> : <StatusTag status="inactive" label={t('inactive')} />;
 },
 },
 {
 title: t('active'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (val: boolean, record: Employee) => (
 <Switch checked={val} onChange={(checked) => handleToggleActive(record.id, checked)} />
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: Employee) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>
 {t('edit')}
 </Button>
 <Button icon={<UnlockOutlined />} onClick={() => handleResetPin(record)}>
 {t('reset_pin')}
 </Button>
 </Space>
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('posEmployees.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div style={{ padding: 24 }}>
 <PageHeader
 title={t('pos_employees')}
 extra={
 <Space>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('pos-employees', employees, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
 {t('add_employee')}
 </Button>
 </Space>
 }
 />

 <ResponsiveTableAdapter
 columns={visibleColumns}
 dataSource={employees}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />

 <FormDialog
 title={editingId ? t('edit_employee') : t('add_employee')}
 open={modalOpen}
 onOk={handleSubmit}
 onClose={() => setModalOpen(false)}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="name_ku" label={t('name_ku')}>
 <Input />
 </Form.Item>
 {!editingId && (
 <Form.Item
 name="pin"
 label={t('pin')}
 rules={[
 { required: true },
 { min: 4, message: t('pin_must_be_4_digits') },
 { max: 6, message: t('pin_must_be_4_digits') },
 ]}
 >
 <Input.Password
 maxLength={6}
 placeholder="4-6 digits"
 visibilityToggle
 />
 </Form.Item>
 )}
 <Form.Item name="role" label={t('role')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="cashier">{t('pos_role_cashier')}</Select.Option>
 <Select.Option value="manager">{t('pos_role_manager')}</Select.Option>
 <Select.Option value="waiter">{t('pos_role_waiter')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="config_ids" label={t('configs')}>
 <Select mode="multiple" placeholder={t('select_configs')}>
 {configs.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="barcode" label={t('barcode')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="is_active" label={t('active')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default POSEmployees;
