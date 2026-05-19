import React, { useState, useEffect } from 'react';
import { Input, Button, Form, Space, Empty, Spin } from 'antd';
import { UserAddOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { FormDialog } from '../responsive/FormDialog';

const { Search } = Input;

interface POSCustomerSelectorProps {
 visible: boolean;
 onClose: () => void;
 onSelect: (customer: any) => void;
}

const POSCustomerSelector: React.FC<POSCustomerSelectorProps> = ({
 visible,
 onClose,
 onSelect,
}) => {
 const { t } = useTranslation();
 const [searchQuery, setSearchQuery] = useState('');
 const [customers, setCustomers] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [showQuickCreate, setShowQuickCreate] = useState(false);
 const [form] = Form.useForm();

 useEffect(() => {
 if (visible) {
 searchCustomers('');
 }
 }, [visible]);

 const searchCustomers = async (query: string) => {
 setLoading(true);
 try {
 const res = await api.get('/api/contacts', {
 params: {
 contact_type: 'customer',
 page: 1,
 page_size: 20,
 },
 });
 
 let items = res.data.items || [];
 
 // Client-side filter if query provided
 if (query) {
 const q = query.toLowerCase();
 items = items.filter((c: any) =>
 c.display_name?.toLowerCase().includes(q) ||
 c.company_name?.toLowerCase().includes(q) ||
 c.phone?.toLowerCase().includes(q) ||
 c.email?.toLowerCase().includes(q)
 );
 }
 
 setCustomers(items);
 } catch (error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleSearch = (value: string) => {
 setSearchQuery(value);
 searchCustomers(value);
 };

 const handleQuickCreate = async (values: any) => {
 try {
 const res = await api.post('/api/pos/customers/quick-create', values);
 message.success(t('pos.customer_created'));
 onSelect(res.data);
 handleClose();
 } catch (error) {
 message.error(t('error'));
 }
 };

 const handleClose = () => {
 setSearchQuery('');
 setShowQuickCreate(false);
 form.resetFields();
 onClose();
 };

 return (
 <FormDialog
 title={t('pos.select_customer')}
 open={visible}
 onClose={handleClose}
 hideFooter >
 <Space orientation="vertical" style={{ width: '100%' }}>
 <Search
 placeholder={t('pos.search_customer')}
 allowClear
 enterButton={<SearchOutlined />}
 onSearch={handleSearch}
 onChange={(e) => setSearchQuery(e.target.value)}
 value={searchQuery}
 />

 {!showQuickCreate && (
 <Button
 type="dashed"
 icon={<UserAddOutlined />}
 block
 onClick={() => setShowQuickCreate(true)}
 >
 {t('pos.quick_create_customer')}
 </Button>
 )}

 {showQuickCreate ? (
 <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: 8 }}>
 <Form
 form={form}
 layout="vertical"
 onFinish={handleQuickCreate}
 >
 <Form.Item
 label={t('name')}
 name="name"
 rules={[{ required: true, message: t('required') }]}
 >
 <Input placeholder={t('customer_name')} />
 </Form.Item>

 <Form.Item
 label={t('phone')}
 name="phone"
 >
 <Input placeholder={t('phone')} />
 </Form.Item>

 <Form.Item
 label={t('email')}
 name="email"
 >
 <Input type="email" placeholder={t('email')} />
 </Form.Item>

 <Space>
 <Button type="primary" htmlType="submit">
 {t('create')}
 </Button>
 <Button onClick={() => setShowQuickCreate(false)}>
 {t('cancel')}
 </Button>
 </Space>
 </Form>
 </div>
 ) : (
 <div style={{ maxHeight: 400, overflow: 'auto' }}>
 {loading ? (
 <div style={{ textAlign: 'center', padding: 40 }}>
 <Spin />
 </div>
 ) : customers.length === 0 ? (
 <Empty description={t('pos.no_customers_found')} />
 ) : (
 <div style={{ display: 'grid', gap: 8 }}>
 {customers.map((customer: any) => (
 <div
 key={customer.id}
 role="button"
 tabIndex={0}
 onClick={() => {
 onSelect(customer);
 handleClose();
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 onSelect(customer);
 handleClose();
 }
 }}
 style={{
 cursor: 'pointer',
 border: '1px solid #f0f0f0',
 borderRadius: 8,
 padding: '12px 14px',
 }}
 >
 <div style={{ fontWeight: 600 }}>{customer.display_name || customer.company_name}</div>
 <Space orientation="vertical" style={{ marginTop: 4, color: '#666' }}>
 {customer.phone && <span>📞 {customer.phone}</span>}
 {customer.email && <span>✉️ {customer.email}</span>}
 </Space>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </Space>
 </FormDialog>
 );
};

export default POSCustomerSelector;
