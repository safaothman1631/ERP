import type React from 'react';
import { useEffect, useState } from 'react';
import { Button, Input, Form, Select, DatePicker, InputNumber, Tag } from 'antd';
import { message } from '../../utils/message';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface RentalContract {
 id: string;
 customer_name: string;
 product_id: string;
 quantity: number;
 start_date: string;
 end_date: string;
 daily_rate?: number;
 deposit_amount: number;
 status?: string;
}

const RentalContracts: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<RentalContract[]>([]);
 const [products, setProducts] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [drawer, setDrawer] = useState(false);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/rental/contracts', { params: { limit: 100 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchProducts = async () => {
 try {
 const res = await api.get('/api/rental/products', { params: { limit: 200 } });
 setProducts(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 };

 useEffect(() => {
 void fetchData();
 void fetchProducts();
 }, []);

 const handleCreate = async (values: any) => {
 try {
 const payload = {
 ...values,
 start_date: values.start_date?.format('YYYY-MM-DD'),
 end_date: values.end_date?.format('YYYY-MM-DD'),
 };
 await api.post('/api/rental/contracts', payload);
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const getStatusTag = (status?: string) => {
 if (!status || status === 'draft') return <Tag>{t('rental.status_draft')}</Tag>;
 if (status === 'active') return <Tag color="green">{t('rental.status_active')}</Tag>;
 if (status === 'closed') return <Tag color="default">{t('rental.status_closed')}</Tag>;
 return <Tag>{status}</Tag>;
 };

 const filteredData = data.filter((c) => {
 const matchSearch = !search || c.customer_name?.toLowerCase().includes(search.toLowerCase());
 const matchStatus = !statusFilter || (c.status || 'draft') === statusFilter;
 return matchSearch && matchStatus;
 });

 const columns = [
 { title: t('rental.customer_name'), dataIndex: 'customer_name', key: 'customer_name' },
 {
 title: t('rental.product'),
 dataIndex: 'product_id',
 key: 'product_id',
 render: (pid: string) => {
 const p = products.find((pr) => pr.id === pid);
 return p?.name || pid;
 },
 },
 { title: t('rental.quantity'), dataIndex: 'quantity', key: 'quantity' },
 {
 title: t('rental.start_date'),
 dataIndex: 'start_date',
 key: 'start_date',
 render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '—'),
 },
 {
 title: t('rental.end_date'),
 dataIndex: 'end_date',
 key: 'end_date',
 render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '—'),
 },
 {
 title: t('rental.deposit'),
 dataIndex: 'deposit_amount',
 key: 'deposit_amount',
 render: (v: number) => v?.toLocaleString() || '0',
 },
 {
 title: t('rental.status'),
 dataIndex: 'status',
 key: 'status',
 render: (s: string) => getStatusTag(s),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: RentalContract) => (
 <Button
 icon={<EyeOutlined />}
 onClick={() => navigate(`/rental/contracts/${record.id}`)}
 >
 {t('view')}
 </Button>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('rental.rental_contracts')}
 subtitle={t('rental.rental_contracts_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 form.resetFields();
 setDrawer(true);
 }}
 >
 {t('rental.new_contract')}
 </Button>
 }
 />

 <div
 style={{
 display: 'flex',
 justifyContent: 'space-between',
 marginBottom: space.md,
 gap: space.md,
 flexWrap: 'wrap',
 }}
 >
 <Input
 prefix={<SearchOutlined />}
 placeholder={t('search')}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 style={{ width: 280 }}
 allowClear
 />
 <Select
 placeholder={t('rental.filter_by_status')}
 value={statusFilter}
 onChange={setStatusFilter}
 style={{ width: 180 }}
 allowClear
 >
 <Select.Option value="draft">{t('rental.status_draft')}</Select.Option>
 <Select.Option value="active">{t('rental.status_active')}</Select.Option>
 <Select.Option value="closed">{t('rental.status_closed')}</Select.Option>
 </Select>
 </div>

 <ResponsiveTableAdapter
 dataSource={filteredData}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />

 <FormDialog
 title={t('rental.new_contract')}
 open={drawer}
 onClose={() => {
 setDrawer(false);
 form.resetFields();
 }}
 >
 <Form
 form={form}
 layout="vertical"
 onFinish={handleCreate}
 initialValues={{ quantity: 1, deposit_amount: 0 }}
 >
 <Form.Item
 label={t('rental.customer_name')}
 name="customer_name"
 rules={[{ required: true, message: t('required') }]}
 >
 <Input placeholder={t('rental.customer_name_placeholder')} />
 </Form.Item>
 <Form.Item
 label={t('rental.product')}
 name="product_id"
 rules={[{ required: true, message: t('required') }]}
 >
 <Select
 placeholder={t('rental.select_product')}
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {products.map((p) => (
 <Select.Option key={p.id} value={p.id}>
 {p.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item label={t('rental.quantity')} name="quantity">
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item
 label={t('rental.start_date')}
 name="start_date"
 rules={[{ required: true, message: t('required') }]}
 >
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item
 label={t('rental.end_date')}
 name="end_date"
 rules={[{ required: true, message: t('required') }]}
 >
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('rental.deposit')} name="deposit_amount">
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <div style={{ display: 'flex', gap: space.sm, justifyContent: 'flex-end' }}>
 <Button onClick={() => setDrawer(false)}>{t('cancel')}</Button>
 <Button type="primary" htmlType="submit">
 {t('create')}
 </Button>
 </div>
 </Form>
 </FormDialog>
 </div>
 );
};

export default RentalContracts;
