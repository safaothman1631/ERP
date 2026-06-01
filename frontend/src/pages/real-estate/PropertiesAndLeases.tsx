import type React from 'react';
import { useEffect, useState } from 'react';
import { Tabs, Button, Space, Input, Form, Select, InputNumber, Tag, Popconfirm } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, StatusTag, FilterBar, DataTable } from '../../design-system';
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

const PropertiesAndLeases: React.FC = () => {
 const { t } = useTranslation();
 const [activeTab, setActiveTab] = useState('1');
 const [properties, setProperties] = useState<Property[]>([]);
 const [leases, setLeases] = useState<Lease[]>([]);
 const [units, setUnits] = useState<Unit[]>([]);
 const [tenants, setTenants] = useState<Tenant[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [drawer, setDrawer] = useState(false);
 const [drawerType, setDrawerType] = useState<'property' | 'lease'>('property');
 const [form] = Form.useForm();

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

 const filteredProperties = properties.filter((p) =>
 !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.address?.toLowerCase().includes(search.toLowerCase())
 );

 const filteredLeases = leases.filter((l) => {
 const tenant = tenants.find((t) => t.id === l.tenant_id);
 return !search || tenant?.name?.toLowerCase().includes(search.toLowerCase());
 });

 const propertyColumns: any[] = [
 { title: t('real_estate.property_name'), dataIndex: 'name', key: 'name', width: 200 },
 { title: t('real_estate.address'), dataIndex: 'address', key: 'address', width: 250 },
 {
 title: t('real_estate.type'),
 dataIndex: 'property_type',
 key: 'property_type',
 width: 130,
 render: (v: string) => <Tag>{t(`real_estate.type_${v}`)}</Tag>,
 },
 {
 title: t('real_estate.units'),
 dataIndex: 'total_units',
 key: 'total_units',
 width: 80,
 align: 'center',
 },
 {
 title: t('real_estate.purchase_price'),
 dataIndex: 'purchase_price',
 key: 'purchase_price',
 width: 150,
 align: 'right',
 render: (v: number) => v.toLocaleString(),
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 100,
 align: 'center',
 render: (_: any, rec: Property) => (
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(rec.id, 'property')}>
 <Button type="text" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 ),
 },
 ];

 const leaseColumns: any[] = [
 {
 title: t('real_estate.tenant'),
 dataIndex: 'tenant_id',
 key: 'tenant_id',
 width: 150,
 render: (tid: string) => tenants.find((t) => t.id === tid)?.name || tid,
 },
 {
 title: t('real_estate.property'),
 dataIndex: 'unit_id',
 key: 'unit_id',
 width: 150,
 render: (uid: string) => {
 const unit = units.find((u) => u.id === uid);
 const prop = properties.find((p) => p.id === unit?.property_id);
 return prop?.name || uid;
 },
 },
 { title: t('real_estate.start_date'), dataIndex: 'start_date', key: 'start_date', width: 120 },
 { title: t('real_estate.end_date'), dataIndex: 'end_date', key: 'end_date', width: 120 },
 {
 title: t('real_estate.rent'),
 dataIndex: 'monthly_rent',
 key: 'monthly_rent',
 width: 130,
 align: 'right',
 render: (v: number) => v.toLocaleString(),
 },
 {
 title: t('real_estate.status'),
 dataIndex: 'status',
 key: 'status',
 width: 100,
 render: (s: string) => (
 <StatusTag status={s === 'active' ? 'success' : s === 'expired' ? 'error' : 'warning'} />
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 180,
 align: 'center',
 render: (_: any, rec: Lease) => (
 <Space>
 <Button
 type="primary"
 icon={<FileTextOutlined />}
 onClick={() => handleGenerateInvoice(rec.id)}
 >
 {t('real_estate.generate_invoice')}
 </Button>
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(rec.id, 'lease')}>
 <Button type="text" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('real_estate.title')}
 subtitle={t('real_estate.subtitle')}
 breadcrumb={[{ label: t('real_estate.title') }]}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(activeTab === '1' ? 'property' : 'lease')}>
 {activeTab === '1' ? t('real_estate.add_property') : t('real_estate.add_lease')}
 </Button>
 }
 />

 <FilterBar
 searchPlaceholder={t('search')}
 searchValue={search}
 onSearchChange={setSearch}
 />

 <Tabs
 activeKey={activeTab}
 onChange={setActiveTab}
 items={[
 {
 key: '1',
 label: t('real_estate.properties'),
 children: (
 <DataTable<Property>
 columns={propertyColumns}
 dataSource={filteredProperties}
 rowKey="id"
 loading={loading}
 stickyHeader={false}
 pagination={{ pageSize: 20 }}
 />
 ),
 },
 {
 key: '2',
 label: t('real_estate.leases'),
 children: (
 <DataTable<Lease>
 columns={leaseColumns}
 dataSource={filteredLeases}
 rowKey="id"
 loading={loading}
 stickyHeader={false}
 pagination={{ pageSize: 20 }}
 />
 ),
 },
 ]}
 />

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
