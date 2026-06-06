import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Space, Input, Form, Select, InputNumber, Radio } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
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

interface Property {
 id: string;
 name: string;
 address: string;
 property_type: string;
 total_units: number;
 purchase_price: number;
 created_at: string;
}

interface Lease {
 id: string;
 unit_id: string;
 tenant_id: string;
 start_date: string;
 end_date: string;
 monthly_rent: number;
 deposit: number;
 status: string;
 created_at: string;
}

interface Unit {
 id: string;
 property_id: string;
 unit_number: string;
 bedrooms: number;
 bathrooms: number;
 area_sqm: number;
 rent_amount: number;
 is_available: boolean;
}

interface Tenant {
 id: string;
 name: string;
 phone?: string;
 email?: string;
 national_id?: string;
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

const PropertiesAndLeases: React.FC = () => {
 const { t } = useTranslation();
 const [activeTab, setActiveTab] = useState<'1' | '2'>('1');
 const [properties, setProperties] = useState<Property[]>([]);
 const [leases, setLeases] = useState<Lease[]>([]);
 const [units, setUnits] = useState<Unit[]>([]);
 const [tenants, setTenants] = useState<Tenant[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [leaseStatus, setLeaseStatus] = useState<string>('');
 const [propertyType, setPropertyType] = useState<string>('');
 const [drawer, setDrawer] = useState(false);
 const [drawerType, setDrawerType] = useState<'property' | 'lease'>('property');
 const [form] = Form.useForm();
 const [hiddenColsProperty, setHiddenColsProperty] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('real-estate.properties.hiddenCols') || '[]'); } catch { return []; }
 });
 const [hiddenColsLease, setHiddenColsLease] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('real-estate.leases.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchProperties = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/real-estate/properties', { params: { limit: 100 } });
 setProperties(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchLeases = async () => {
 setLoading(true);
 try {
 const [leasesRes, unitsRes, tenantsRes] = await Promise.all([
 api.get('/api/real-estate/leases', { params: { limit: 100 } }),
 api.get('/api/real-estate/units', { params: { limit: 200 } }),
 api.get('/api/real-estate/tenants', { params: { limit: 200 } }),
 ]);
 setLeases(leasesRes.data.items || []);
 setUnits(unitsRes.data.items || []);
 setTenants(tenantsRes.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchProperties();
 void fetchLeases();
 }, []);

 const handleCreateProperty = async (values: any) => {
 try {
 await api.post('/api/real-estate/properties', values);
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchProperties();
 } catch {
 message.error(t('error'));
 }
 };

 const handleCreateLease = async (values: any) => {
 try {
 await api.post('/api/real-estate/leases', values);
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchLeases();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string, type: 'property' | 'lease') => {
 try {
 await api.delete(`/api/real-estate/${type === 'property' ? 'properties' : 'leases'}/${id}`);
 message.success(t('real_estate.deleted'));
 if (type === 'property') {
 void fetchProperties();
 } else {
 void fetchLeases();
 }
 } catch {
 message.error(t('error'));
 }
 };

 const handleGenerateInvoice = async (leaseId: string) => {
 try {
 await api.post('/api/real-estate/rent-invoices', {
 lease_id: leaseId,
 period_start: dayjs().format('YYYY-MM-DD'),
 period_end: dayjs().add(1, 'month').format('YYYY-MM-DD'),
 amount: leases.find((l) => l.id === leaseId)?.monthly_rent || 0,
 due_date: dayjs().add(1, 'month').format('YYYY-MM-DD'),
 });
 message.success(t('real_estate.invoice_generated'));
 } catch {
 message.error(t('error'));
 }
 };

 const openDrawer = (type: 'property' | 'lease') => {
 setDrawerType(type);
 setDrawer(true);
 form.resetFields();
 };

 const filteredProperties = properties.filter((p) => {
 const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.address?.toLowerCase().includes(search.toLowerCase());
 const matchType = !propertyType || p.property_type === propertyType;
 return matchSearch && matchType;
 });

 const filteredLeases = leases.filter((l) => {
 const tenant = tenants.find((tn) => tn.id === l.tenant_id);
 const matchSearch = !search || tenant?.name?.toLowerCase().includes(search.toLowerCase());
 const matchStatus = !leaseStatus || l.status === leaseStatus;
 return matchSearch && matchStatus;
 });

 // Kit list tabs (Properties / Leases) — entity switch.
 const tabs: KitListTab[] = [
 { key: '1', label: t('real_estate.properties') },
 { key: '2', label: t('real_estate.leases') },
 ];

 const allPropertyColumns: any[] = [
 {
 title: t('real_estate.property_name'), dataIndex: 'name', key: 'name', width: 220,
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
 title: t('real_estate.address'), dataIndex: 'address', key: 'address', width: 250,
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('real_estate.type'),
 dataIndex: 'property_type',
 key: 'property_type',
 width: 140,
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(`real_estate.type_${v}`)}</span>
 ),
 },
 {
 title: t('real_estate.units'),
 dataIndex: 'total_units',
 key: 'total_units',
 width: 90,
 align: 'center' as const,
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 ),
 },
 {
 title: t('real_estate.purchase_price'),
 dataIndex: 'purchase_price',
 key: 'purchase_price',
 width: 160,
 align: 'right' as const,
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600 }}>
 {v.toLocaleString()}
 </span>
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: Property) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id, 'property') },
 ]}
 />
 ),
 },
 ];

 const allLeaseColumns: any[] = [
 {
 title: t('real_estate.tenant'),
 dataIndex: 'tenant_id',
 key: 'tenant_id',
 width: 180,
 render: (tid: string) => {
 const name = tenants.find((tn) => tn.id === tid)?.name || tid;
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(name)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{name}</span>
 </div>
 );
 },
 },
 {
 title: t('real_estate.property'),
 dataIndex: 'unit_id',
 key: 'unit_id',
 width: 180,
 render: (uid: string) => {
 const unit = units.find((u) => u.id === uid);
 const prop = properties.find((p) => p.id === unit?.property_id);
 return <span style={{ color: 'var(--ink-700)' }}>{prop?.name || uid}</span>;
 },
 },
 {
 title: t('real_estate.start_date'), dataIndex: 'start_date', key: 'start_date', width: 130,
 render: (v: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{v}</span>
 ),
 },
 {
 title: t('real_estate.end_date'), dataIndex: 'end_date', key: 'end_date', width: 130,
 render: (v: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{v}</span>
 ),
 },
 {
 title: t('real_estate.rent'),
 dataIndex: 'monthly_rent',
 key: 'monthly_rent',
 width: 140,
 align: 'right' as const,
 render: (v: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600 }}>
 {v.toLocaleString()}
 </span>
 ),
 },
 {
 title: t('real_estate.status'),
 dataIndex: 'status',
 key: 'status',
 width: 110,
 render: (s: string) => (
 <StatusTag status={s === 'active' ? 'success' : s === 'expired' ? 'error' : 'warning'} />
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: Lease) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'invoice', icon: <FileTextOutlined />, label: t('real_estate.generate_invoice'), onClick: () => handleGenerateInvoice(record.id) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id, 'lease') },
 ]}
 />
 ),
 },
 ];

 const propertyColumns = useMemo(
 () => allPropertyColumns.filter((c) => !hiddenColsProperty.includes(c.key)),
 [hiddenColsProperty, t, properties],
 );
 const leaseColumns = useMemo(
 () => allLeaseColumns.filter((c) => !hiddenColsLease.includes(c.key)),
 [hiddenColsLease, t, tenants, units, properties, leases],
 );

 const propertyColumnsMeta: ColumnVisibilityItem[] = allPropertyColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const leaseColumnsMeta: ColumnVisibilityItem[] = allLeaseColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'tenant_id' || c.key === 'actions',
 }));

 const persistHiddenProperty = (next: string[]) => {
 setHiddenColsProperty(next);
 try { localStorage.setItem('real-estate.properties.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };
 const persistHiddenLease = (next: string[]) => {
 setHiddenColsLease(next);
 try { localStorage.setItem('real-estate.leases.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const isProperties = activeTab === '1';

 return (
 <>
 <PageHeader
 title={t('real_estate.title')}
 subtitle={t('real_estate.subtitle')}
 breadcrumb={[{ label: t('real_estate.title') }]}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(isProperties ? 'property' : 'lease')}>
 {isProperties ? t('real_estate.add_property') : t('real_estate.add_lease')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={activeTab}
 onTabChange={(k) => { setActiveTab(k as '1' | '2'); setSearch(''); setLeaseStatus(''); setPropertyType(''); }}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
 {isProperties ? (
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={propertyType ? 1 : 0}
 onClear={() => setPropertyType('')}
 >
 <Radio.Group
 value={propertyType || 'all'}
 onChange={(e) => setPropertyType(e.target.value === 'all' ? '' : e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="residential">{t('real_estate.type_residential')}</Radio>
 <Radio value="commercial">{t('real_estate.type_commercial')}</Radio>
 <Radio value="industrial">{t('real_estate.type_industrial')}</Radio>
 <Radio value="land">{t('real_estate.type_land')}</Radio>
 <Radio value="mixed">{t('real_estate.type_mixed')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('real_estate.type', 'Type')}
 anyLabel={t('all', 'All')}
 value={propertyType}
 onChange={(v) => setPropertyType(v)}
 options={[
 { value: 'residential', label: t('real_estate.type_residential') },
 { value: 'commercial', label: t('real_estate.type_commercial') },
 { value: 'industrial', label: t('real_estate.type_industrial') },
 { value: 'land', label: t('real_estate.type_land') },
 { value: 'mixed', label: t('real_estate.type_mixed') },
 ]}
 />
 </div>
 ) : (
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={leaseStatus ? 1 : 0}
 onClear={() => setLeaseStatus('')}
 >
 <Radio.Group
 value={leaseStatus || 'all'}
 onChange={(e) => setLeaseStatus(e.target.value === 'all' ? '' : e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="active">{t('real_estate.status_active')}</Radio>
 <Radio value="expired">{t('real_estate.status_expired')}</Radio>
 <Radio value="terminated">{t('real_estate.status_terminated')}</Radio>
 <Radio value="pending">{t('real_estate.status_pending')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('real_estate.status', 'Status')}
 anyLabel={t('all', 'All')}
 value={leaseStatus}
 onChange={(v) => setLeaseStatus(v)}
 options={[
 { value: 'active', label: t('real_estate.status_active') },
 { value: 'expired', label: t('real_estate.status_expired') },
 { value: 'terminated', label: t('real_estate.status_terminated') },
 { value: 'pending', label: t('real_estate.status_pending') },
 ]}
 />
 </div>
 )}
 <div style={{ marginInlineStart: 'auto' }}>
 {isProperties ? (
 <KitListToolbarActions
 columns={propertyColumnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenColsProperty}
 onColumnsChange={persistHiddenProperty}
 onExport={() => {
 const cols = propertyColumnsMeta.filter((c) => !hiddenColsProperty.includes(c.key) && c.key !== 'actions');
 downloadCsv('properties', filteredProperties, cols);
 }}
 onPrint={() => window.print()}
 onImport={() => message.info(t('coming_soon', 'Coming soon'))}
 onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
 onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
 />
 ) : (
 <KitListToolbarActions
 columns={leaseColumnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenColsLease}
 onColumnsChange={persistHiddenLease}
 onExport={() => {
 const cols = leaseColumnsMeta.filter((c) => !hiddenColsLease.includes(c.key) && c.key !== 'actions');
 downloadCsv('leases', filteredLeases, cols);
 }}
 onPrint={() => window.print()}
 onImport={() => message.info(t('coming_soon', 'Coming soon'))}
 onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
 onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
 />
 )}
 </div>
 </>
 }
 >
 {isProperties ? (
 <ResponsiveTableAdapter
 dataSource={filteredProperties}
 columns={propertyColumns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 ) : (
 <ResponsiveTableAdapter
 dataSource={filteredLeases}
 columns={leaseColumns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 )}
 </KitListCard>

 <FormDialog
 title={drawerType === 'property' ? t('real_estate.add_property') : t('real_estate.add_lease')}
 open={drawer}
 onClose={() => setDrawer(false)}
 >
 <Form
 form={form}
 layout="vertical"
 onFinish={drawerType === 'property' ? handleCreateProperty : handleCreateLease}
 >
 {drawerType === 'property' ? (
 <>
 <Form.Item name="name" label={t('real_estate.property_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="address" label={t('real_estate.address')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="property_type" label={t('real_estate.type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="residential">{t('real_estate.type_residential')}</Select.Option>
 <Select.Option value="commercial">{t('real_estate.type_commercial')}</Select.Option>
 <Select.Option value="industrial">{t('real_estate.type_industrial')}</Select.Option>
 <Select.Option value="land">{t('real_estate.type_land')}</Select.Option>
 <Select.Option value="mixed">{t('real_estate.type_mixed')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="total_units" label={t('real_estate.units')} initialValue={1}>
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="purchase_price" label={t('real_estate.purchase_price')} initialValue={0}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 </>
 ) : (
 <>
 <Form.Item name="unit_id" label={t('real_estate.unit')} rules={[{ required: true }]}>
 <Select
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {units.map((u) => (
 <Select.Option key={u.id} value={u.id}>
 {properties.find((p) => p.id === u.property_id)?.name || ''} - {u.unit_number}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="tenant_id" label={t('real_estate.tenant')} rules={[{ required: true }]}>
 <Select
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {tenants.map((ten) => (
 <Select.Option key={ten.id} value={ten.id}>
 {ten.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="start_date" label={t('real_estate.start_date')} rules={[{ required: true }]}>
 <Input type="date" />
 </Form.Item>
 <Form.Item name="end_date" label={t('real_estate.end_date')} rules={[{ required: true }]}>
 <Input type="date" />
 </Form.Item>
 <Form.Item name="monthly_rent" label={t('real_estate.rent')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="deposit" label={t('real_estate.deposit')} initialValue={0}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="status" label={t('real_estate.status')} initialValue="active">
 <Select>
 <Select.Option value="active">{t('real_estate.status_active')}</Select.Option>
 <Select.Option value="expired">{t('real_estate.status_expired')}</Select.Option>
 <Select.Option value="terminated">{t('real_estate.status_terminated')}</Select.Option>
 <Select.Option value="pending">{t('real_estate.status_pending')}</Select.Option>
 </Select>
 </Form.Item>
 </>
 )}
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

export default PropertiesAndLeases;
