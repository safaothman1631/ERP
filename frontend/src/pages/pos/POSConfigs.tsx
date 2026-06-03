import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, Switch, InputNumber, Select, Tabs, Modal, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, CheckCircleOutlined, ApiOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitSearchInput from '../../design-system/KitSearchInput';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
// growth-to-100 § G3 — ESC/POS hardware pairing wizard (printer/scanner/drawer/display).
import { HardwarePairingWizard } from '../../components/pos/HardwarePairingWizard';

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const POSConfigs: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [pricelists, setPricelists] = useState<any[]>([]);
 const [categories, setCategories] = useState<any[]>([]);
 const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [hwWizardOpen, setHwWizardOpen] = useState(false);
 const [search, setSearch] = useState('');
 // Presentation-only status segment (client-side filter over the already-loaded list).
 const [statusTab, setStatusTab] = useState<'all' | 'active' | 'inactive'>('all');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('posConfigs.hiddenCols') || '[]'); } catch { return []; }
 });
 const [form] = Form.useForm();

 const fetchPricelists = async () => {
 try {
 const res = await api.get('/api/pos/pricelists', { params: { page_size: 100 } });
 setPricelists(res.data.items || []);
 } catch {
 // Silent fail
 }
 };

 const fetchCategories = async () => {
 try {
 const res = await api.get('/api/pos/categories', { params: { page_size: 500 } });
 setCategories(res.data.items || []);
 } catch {
 // Silent fail
 }
 };

 const fetchPaymentMethods = async () => {
 try {
 const res = await api.get('/api/pos/payment-methods', { params: { page_size: 100 } });
 setPaymentMethods(res.data.items || []);
 } catch {
 // Silent fail
 }
 };

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/pos/configs', { params: { page_size: 100 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 fetchPricelists();
 fetchCategories();
 fetchPaymentMethods();
 }, []);

 const openModal = (record?: any) => {
 if (record) {
 setEditingId(record.id);
 form.setFieldsValue(record);
 } else {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({
 is_active: true,
 cash_control: true,
 allow_discount: true,
 max_discount_percent: 100,
 barcode_scanner: true,
 iface_type: 'shop',
 auto_invoice: false,
 restaurant_mode: false,
 customer_display: false,
 iface_print_via_proxy: false,
 iface_cashdrawer: false,
 iface_scan_via_proxy: false,
 iface_customer_facing_display: false,
 });
 }
 setModalVisible(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const openDuplicate = (record: any) => {
 setEditingId(null);
 const { id: _id, ...rest } = record;
 form.resetFields();
 form.setFieldsValue({ ...rest, name: `${record.name ?? ''} (${t('copy', 'copy')})` });
 setModalVisible(true);
 };

 const handleSubmit = async (values: any) => {
 try {
 if (editingId) {
 await api.put(`/api/pos/configs/${editingId}`, values);
 message.success(t('success'));
 } else {
 await api.post('/api/pos/configs', values);
 message.success(t('success'));
 }
 setModalVisible(false);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/pos/configs/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleClone = async (id: string) => {
 try {
 await api.post(`/api/pos/configs/${id}/clone`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleToggleActive = async (id: string) => {
 try {
 await api.post(`/api/pos/configs/${id}/activate`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 // Status segments (presentation-only filter over the loaded list).
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'active', label: t('active') },
 { key: 'inactive', label: t('inactive') },
 ];
 const visibleData = useMemo(() => {
 let rows = data;
 if (statusTab === 'active') rows = rows.filter((r) => r.is_active);
 else if (statusTab === 'inactive') rows = rows.filter((r) => !r.is_active);
 if (search) {
 const q = search.toLowerCase();
 rows = rows.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
 );
 }
 return rows;
 }, [data, statusTab, search]);

 const columns = [
 {
 title: t('name'),
 dataIndex: 'name',
 key: 'name',
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
 title: t('name_ku'),
 dataIndex: 'name_ku',
 key: 'name_ku',
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('pos.iface_type'),
 dataIndex: 'iface_type',
 key: 'iface_type',
 render: (type: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(`pos.${type}`)}</span>
 ),
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (active: boolean) => (
 <StatusTag status={active ? 'active' : 'inactive'} label={active ? t('active') : t('inactive')} />
 ),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => openModal(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openModal(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => openDuplicate(record) },
 { key: 'clone', icon: <CopyOutlined />, label: t('pos.clone', 'Clone'), onClick: () => handleClone(record.id) },
 {
 key: 'toggle',
 icon: <CheckCircleOutlined />,
 label: record.is_active ? t('deactivate') : t('activate'),
 onClick: () => handleToggleActive(record.id),
 },
 { type: 'divider' },
 {
 key: 'delete',
 icon: <DeleteOutlined />,
 label: t('delete'),
 danger: true,
 onClick: () => {
 Modal.confirm({
 title: t('confirm_delete'),
 onOk: () => handleDelete(record.id),
 });
 },
 },
 ]}
 />
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
 try { localStorage.setItem('posConfigs.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const tabItems = [
 {
 key: 'general',
 label: t('pos.general'),
 children: (
 <>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="name_ku" label={t('name_ku')}>
 <Input />
 </Form.Item>
 <Form.Item name="iface_type" label={t('pos.iface_type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="shop">{t('pos.shop')}</Select.Option>
 <Select.Option value="restaurant">{t('pos.restaurant')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="is_active" label={t('active')} valuePropName="checked">
 <Switch />
 </Form.Item>
 <Form.Item name="cash_control" label={t('pos.cash_control')} valuePropName="checked">
 <Switch />
 </Form.Item>
 <Form.Item name="opening_cash_default" label={t('pos.opening_cash_default')}>
 <InputNumber style={{ width: '100%' }} min={0} />
 </Form.Item>
 <Form.Item name="allow_discount" label={t('pos.allow_discount')} valuePropName="checked">
 <Switch />
 </Form.Item>
 <Form.Item name="max_discount_percent" label={t('pos.max_discount_percent')}>
 <InputNumber style={{ width: '100%' }} min={0} max={100} />
 </Form.Item>
 <Form.Item name="receipt_header" label={t('pos.receipt_header')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="receipt_footer" label={t('pos.receipt_footer')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item name="auto_invoice" label={t('pos.auto_invoice')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </>
 ),
 },
 {
 key: 'products',
 label: t('pos.products'),
 children: (
 <>
 <Form.Item name="default_pricelist_id" label={t('pos.default_pricelist')}>
 <Select allowClear>
 {pricelists.map((p) => (
 <Select.Option key={p.id} value={p.id}>
 {p.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="available_pricelist_ids" label={t('pos.available_pricelists')}>
 <Select mode="multiple" allowClear>
 {pricelists.map((p) => (
 <Select.Option key={p.id} value={p.id}>
 {p.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="available_category_ids" label={t('pos.available_categories')}>
 <Select mode="multiple" allowClear>
 {categories.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 </>
 ),
 },
 {
 key: 'payment',
 label: t('pos.payment'),
 children: (
 <>
 <Form.Item name="payment_method_ids" label={t('pos.payment_methods')}>
 <Select mode="multiple" allowClear>
 {paymentMethods.map((pm) => (
 <Select.Option key={pm.id} value={pm.id}>
 {pm.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="cash_journal_id" label={t('pos.cash_journal_id')}>
 <Input />
 </Form.Item>
 <Form.Item name="card_journal_id" label={t('pos.card_journal_id')}>
 <Input />
 </Form.Item>
 </>
 ),
 },
 {
 key: 'restaurant',
 label: t('pos.restaurant'),
 children: (
 <>
 <Form.Item name="restaurant_mode" label={t('pos.restaurant_mode')} valuePropName="checked">
 <Switch />
 </Form.Item>
 <Form.Item name="floor_ids" label={t('pos.floors')}>
 <Select mode="multiple" allowClear placeholder={t('pos.floors_hint')} />
 </Form.Item>
 </>
 ),
 },
 {
 key: 'hardware',
 label: t('pos.hardware'),
 children: (
 <>
 <Form.Item name="barcode_scanner" label={t('pos.barcode_scanner')} valuePropName="checked">
 <Switch />
 </Form.Item>
 <Form.Item name="customer_display" label={t('pos.customer_display')} valuePropName="checked">
 <Switch />
 </Form.Item>
 <Form.Item name="iface_print_via_proxy" label={t('pos.iface_print_via_proxy')} valuePropName="checked">
 <Switch />
 </Form.Item>
 <Form.Item name="iface_cashdrawer" label={t('pos.iface_cashdrawer')} valuePropName="checked">
 <Switch />
 </Form.Item>
 <Form.Item name="iface_scan_via_proxy" label={t('pos.iface_scan_via_proxy')} valuePropName="checked">
 <Switch />
 </Form.Item>
 <Form.Item name="iface_customer_facing_display" label={t('pos.iface_customer_facing_display')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('pos.configs')}
 extra={
 <Space>
 <Button icon={<ApiOutlined />} onClick={() => setHwWizardOpen(true)}>
 {t('pos.pair_hardware', { defaultValue: 'Pair hardware' })}
 </Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
 {t('pos.new_config')}
 </Button>
 </Space>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={statusTab}
 onTabChange={(k) => setStatusTab(k as typeof statusTab)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 {/* Group Filters + Status in a single flex unit so they ALWAYS wrap
 together to the same line — never one stranded on a row by itself. */}
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusTab !== 'all' ? 1 : 0}
 onClear={() => setStatusTab('all')}
 >
 <Radio.Group
 value={statusTab}
 onChange={(e) => setStatusTab(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="active">{t('active')}</Radio>
 <Radio value="inactive">{t('inactive')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={statusTab === 'all' ? '' : statusTab}
 onChange={(v) => setStatusTab((v || 'all') as typeof statusTab)}
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
 downloadCsv('pos-configs', visibleData, cols);
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
 dataSource={visibleData}
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 pagination={false}
 />
 </KitListCard>

 <FormDialog
 title={editingId ? t('edit') : t('pos.new_config')}
 open={modalVisible}
 onClose={() => setModalVisible(false)} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Tabs items={tabItems} />

 <Form.Item style={{ marginTop: 24 }}>
 <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
 <Button onClick={() => setModalVisible(false)}>{t('cancel')}</Button>
 <Button type="primary" htmlType="submit">
 {editingId ? t('update') : t('create')}
 </Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>

 <Modal
 title={t('pos.pair_hardware', { defaultValue: 'Pair hardware' })}
 open={hwWizardOpen}
 onCancel={() => setHwWizardOpen(false)}
 footer={null}
 width={760}
 destroyOnClose
 >
 <HardwarePairingWizard
 t={(k, fb) => t(k, { defaultValue: fb })}
 onComplete={() => { setHwWizardOpen(false); message.success(t('success')); }}
 onCancel={() => setHwWizardOpen(false)}
 />
 </Modal>
 </div>
 );
};

export default POSConfigs;
