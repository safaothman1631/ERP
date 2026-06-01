import type React from 'react';
import { useEffect, useState } from 'react';
import { Button, Input, Form, InputNumber, Switch } from 'antd';
import { message } from '../../utils/message';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, FilterBar, StatusTag } from '../../design-system';
import type { StatusKind } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface RepairOrder {
 id: string;
 customer_name: string;
 product_name?: string;
 serial_no?: string;
 issue_description: string;
 status?: string;
 received_at?: string;
 estimated_cost: number;
 is_under_warranty: boolean;
}

const RepairOrders: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<RepairOrder[]>([]);
 const [loading, setLoading] = useState(false);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [drawer, setDrawer] = useState(false);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/repairs/orders', { params: { limit: 100 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchData();
 }, []);

 const handleCreate = async (values: any) => {
 try {
 await api.post('/api/repairs/orders', values);
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const getStatusTag = (status?: string) => {
 const s = status || 'received';
 const kindMap: Record<string, StatusKind> = {
 received: 'info',
 diagnosed: 'info',
 in_repair: 'warning',
 done: 'success',
 delivered: 'default',
 };
 return <StatusTag status={kindMap[s] || 'default'} label={t(`repairs.status_${s}`)} />;
 };

 const filteredData = data.filter((r) => {
 const matchSearch =
 !search ||
 r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
 r.serial_no?.toLowerCase().includes(search.toLowerCase());
 const matchStatus = !statusFilter || (r.status || 'received') === statusFilter;
 return matchSearch && matchStatus;
 });

 const columns = [
 { title: t('repairs.customer_name'), dataIndex: 'customer_name', key: 'customer_name' },
 { title: t('repairs.product'), dataIndex: 'product_name', key: 'product_name' },
 { title: t('repairs.serial_no'), dataIndex: 'serial_no', key: 'serial_no' },
 {
 title: t('repairs.issue'),
 dataIndex: 'issue_description',
 key: 'issue_description',
 ellipsis: true,
 },
 {
 title: t('repairs.status'),
 dataIndex: 'status',
 key: 'status',
 render: (s: string) => getStatusTag(s),
 },
 {
 title: t('repairs.received_at'),
 dataIndex: 'received_at',
 key: 'received_at',
 render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '—'),
 },
 {
 title: t('repairs.warranty'),
 dataIndex: 'is_under_warranty',
 key: 'is_under_warranty',
 render: (v: boolean) => <StatusTag status={v ? 'success' : 'default'} label={v ? t('yes') : t('no')} />,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: RepairOrder) => (
 <Button
 icon={<EyeOutlined />}
 onClick={() => navigate(`/repairs/orders/${record.id}`)}
 >
 {t('view')}
 </Button>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('repairs.repair_orders')}
 subtitle={t('repairs.repair_orders_subtitle')}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 form.resetFields();
 setDrawer(true);
 }}
 >
 {t('repairs.new_order')}
 </Button>
 }
 />

 <FilterBar
 searchValue={search}
 onSearchChange={setSearch}
 searchPlaceholder={t('search')}
 filters={[
 {
 key: 'status',
 label: t('repairs.filter_by_status'),
 options: [
 { value: 'received', label: t('repairs.status_received') },
 { value: 'diagnosed', label: t('repairs.status_diagnosed') },
 { value: 'in_repair', label: t('repairs.status_in_repair') },
 { value: 'done', label: t('repairs.status_done') },
 { value: 'delivered', label: t('repairs.status_delivered') },
 ],
 },
 ]}
 values={{ status: statusFilter || undefined }}
 onChange={(v) => setStatusFilter((v.status as string) || '')}
 />

 <ResponsiveTableAdapter
 dataSource={filteredData}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />

 <FormDialog
 title={t('repairs.new_order')}
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
 initialValues={{ estimated_cost: 0, is_under_warranty: false }}
 >
 <Form.Item
 label={t('repairs.customer_name')}
 name="customer_name"
 rules={[{ required: true, message: t('required') }]}
 >
 <Input placeholder={t('repairs.customer_name_placeholder')} />
 </Form.Item>
 <Form.Item label={t('repairs.product')} name="product_name">
 <Input placeholder={t('repairs.product_name_placeholder')} />
 </Form.Item>
 <Form.Item label={t('repairs.serial_no')} name="serial_no">
 <Input placeholder={t('repairs.serial_no_placeholder')} />
 </Form.Item>
 <Form.Item
 label={t('repairs.issue_description')}
 name="issue_description"
 rules={[{ required: true, message: t('required') }]}
 >
 <Input.TextArea rows={3} placeholder={t('repairs.issue_placeholder')} />
 </Form.Item>
 <Form.Item label={t('repairs.estimated_cost')} name="estimated_cost">
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item
 label={t('repairs.under_warranty')}
 name="is_under_warranty"
 valuePropName="checked"
 >
 <Switch />
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

export default RepairOrders;
