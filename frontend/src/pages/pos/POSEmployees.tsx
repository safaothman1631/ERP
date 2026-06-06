import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Switch, Form, Input, Select, App, Modal, Radio } from 'antd';
import { PlusOutlined, EditOutlined, LockOutlined, UnlockOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
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

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

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
 const [roleTab, setRoleTab] = useState<'all' | 'cashier' | 'manager' | 'waiter'>('all');
 const [statusFilter, setStatusFilter] = useState('');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('posEmployees.hiddenCols') || '[]'); } catch { return []; }
 });

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

 // Kit list tabs (All / Cashier / Manager / Waiter) — client-side filtered on the loaded array.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'cashier', label: t('pos_role_cashier') },
 { key: 'manager', label: t('pos_role_manager') },
 { key: 'waiter', label: t('pos_role_waiter') },
 ];

 // Presentation-only derived view (role tab + active/inactive filter + search). Does not touch fetch/logic.
 const filteredEmployees = useMemo(
 () => {
 const q = search.trim().toLowerCase();
 return employees.filter((e) => {
 if (roleTab !== 'all' && e.role !== roleTab) return false;
 if (statusFilter === 'active' && !e.is_active) return false;
 if (statusFilter === 'inactive' && e.is_active) return false;
 if (q && !Object.values(e).some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
 return true;
 });
 },
 [employees, roleTab, statusFilter, search],
 );

 const allColumns = [
 {
 title: t('name'),
 dataIndex: 'name',
 key: 'name',
 render: (_: any, record: Employee) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(record.name)}</span>
 <div>
 <div style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{record.name}</div>
 {record.name_ku && <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{record.name_ku}</div>}
 </div>
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
 render: (ids: string[]) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{ids.length}</span>
 ),
 },
 {
 title: t('barcode'),
 dataIndex: 'barcode',
 key: 'barcode',
 render: (barcode: string | undefined) => barcode
 ? (
 <span style={{
 display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px',
 borderRadius: 'var(--radius-sm, 6px)', background: 'var(--surface-2)',
 border: '1px solid var(--border)', color: 'var(--ink-700)',
 fontFamily: 'var(--font-mono)', fontSize: 12.5,
 }}>
 <BarcodeOutlined />{barcode}
 </span>
 )
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
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
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: Employee) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'reset_pin', icon: <UnlockOutlined />, label: t('reset_pin'), onClick: () => handleResetPin(record) },
 ]}
 />
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' && c.title ? c.title : (c.key as string),
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
 <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
 {t('add_employee')}
 </Button>
 </Space>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={roleTab}
 onTabChange={(k) => { setRoleTab(k as typeof roleTab); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={(roleTab !== 'all' ? 1 : 0) + (statusFilter ? 1 : 0)}
 onClear={() => { setRoleTab('all'); setStatusFilter(''); }}
 >
 <Radio.Group
 value={roleTab}
 onChange={(e) => { setRoleTab(e.target.value); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="cashier">{t('pos_role_cashier')}</Radio>
 <Radio value="manager">{t('pos_role_manager')}</Radio>
 <Radio value="waiter">{t('pos_role_waiter')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => { setStatusFilter(v); }}
 options={[
 { value: 'active', label: t('active') },
 { value: 'inactive', label: t('inactive') },
 ]}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('pos-employees', filteredEmployees, cols);
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
 columns={columns}
 dataSource={filteredEmployees}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </KitListCard>

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
