import { useEffect, useState } from 'react';
import { Button, Form, Input, Select, Space, DatePicker, Card, Tag } from 'antd';
import { PlusOutlined, FilterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { PageHeader } from '../../design-system';
import api from '../../api';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface ICTransaction {
 id: string;
 from_company_id: string;
 to_company_id: string;
 amount: number;
 currency: string;
 description: string;
 reference: string;
 date: string;
 eliminated?: boolean;
}

interface Company {
 id: string;
 name: string;
}

const IntercompanyTransactions = () => {
 const { t } = useTranslation();
 const [loading, setLoading] = useState(false);
 const [transactions, setTransactions] = useState<ICTransaction[]>([]);
 const [companies, setCompanies] = useState<Company[]>([]);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [filterVisible, setFilterVisible] = useState(false);
 const [form] = Form.useForm();
 const [filterForm] = Form.useForm();

 const fetchCompanies = async () => {
 try {
 const { data } = await api.get('/api/companies');
 setCompanies(data);
 } catch (_err) {
 message.error(t('multi_entity.error_loading_companies'));
 }
 };

 const fetchTransactions = async () => {
 setLoading(true);
 try {
 const { data } = await api.get('/api/companies/intercompany');
 setTransactions(data);
 } catch (_err) {
 message.error(t('multi_entity.error_loading_ic_transactions'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchCompanies();
 fetchTransactions();
 }, []);

 const handleCreate = () => {
 form.resetFields();
 setDrawerOpen(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 const payload = {
 ...values,
 date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : undefined,
 };
 await api.post('/api/companies/intercompany', payload);
 message.success(t('multi_entity.ic_transaction_created'));
 setDrawerOpen(false);
 fetchTransactions();
 } catch (_err) {
 message.error(t('multi_entity.error_creating_ic_transaction'));
 }
 };

 const getCompanyName = (id: string) => {
 return companies.find((c) => c.id === id)?.name || id;
 };

 const columns: ColumnsType<ICTransaction> = [
 {
 title: t('multi_entity.date'),
 dataIndex: 'date',
 key: 'date',
 render: (date) => dayjs(date).format('YYYY-MM-DD'),
 },
 {
 title: t('multi_entity.from_company'),
 dataIndex: 'from_company_id',
 key: 'from_company_id',
 render: (id) => getCompanyName(id),
 },
 {
 title: t('multi_entity.to_company'),
 dataIndex: 'to_company_id',
 key: 'to_company_id',
 render: (id) => getCompanyName(id),
 },
 {
 title: t('multi_entity.amount'),
 dataIndex: 'amount',
 key: 'amount',
 render: (amount, record) => `${amount.toLocaleString()} ${record.currency}`,
 },
 {
 title: t('multi_entity.description'),
 dataIndex: 'description',
 key: 'description',
 },
 {
 title: t('multi_entity.reference'),
 dataIndex: 'reference',
 key: 'reference',
 },
 {
 title: t('multi_entity.eliminated'),
 dataIndex: 'eliminated',
 key: 'eliminated',
 render: (eliminated) => (
 <Tag color={eliminated ? 'green' : 'orange'}>
 {eliminated ? t('multi_entity.eliminated_yes') : t('multi_entity.eliminated_no')}
 </Tag>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('multi_entity.ic_transactions')}
 subtitle={t('multi_entity.ic_transactions_subtitle')}
 extra={
 <Space>
 <Button icon={<FilterOutlined />} onClick={() => setFilterVisible(!filterVisible)}>
 {t('filter')}
 </Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('multi_entity.add_ic_transaction')}
 </Button>
 </Space>
 }
 />
 {filterVisible && (
 <Card style={{ marginBottom: 16 }}>
 <Form form={filterForm} layout="inline">
 <Form.Item name="from_company" label={t('multi_entity.from_company')}>
 <Select style={{ width: 200 }} allowClear>
 {companies.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="to_company" label={t('multi_entity.to_company')}>
 <Select style={{ width: 200 }} allowClear>
 {companies.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="eliminated" label={t('multi_entity.eliminated')}>
 <Select style={{ width: 150 }} allowClear>
 <Select.Option value="yes">{t('multi_entity.eliminated_yes')}</Select.Option>
 <Select.Option value="no">{t('multi_entity.eliminated_no')}</Select.Option>
 </Select>
 </Form.Item>
 </Form>
 </Card>
 )}
 <Card>
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={transactions}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </Card>

 <FormDialog
 title={t('multi_entity.add_ic_transaction')}
 open={drawerOpen}
 onClose={() => setDrawerOpen(false)}
 footer={
 <Space style={{ float: 'right' }}>
 <Button onClick={() => setDrawerOpen(false)}>{t('cancel')}</Button>
 <Button type="primary" onClick={handleSave}>
 {t('save')}
 </Button>
 </Space>
 }
 >
 <Form form={form} layout="vertical">
 <Form.Item
 name="from_company_id"
 label={t('multi_entity.from_company')}
 rules={[{ required: true, message: t('multi_entity.from_company_required') }]}
 >
 <Select
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {companies.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item
 name="to_company_id"
 label={t('multi_entity.to_company')}
 rules={[{ required: true, message: t('multi_entity.to_company_required') }]}
 >
 <Select
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {companies.map((c) => (
 <Select.Option key={c.id} value={c.id}>
 {c.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item
 name="amount"
 label={t('multi_entity.amount')}
 rules={[{ required: true, message: t('multi_entity.amount_required') }]}
 >
 <Input type="number" />
 </Form.Item>
 <Form.Item
 name="currency"
 label={t('multi_entity.currency')}
 rules={[{ required: true, message: t('multi_entity.currency_required') }]}
 >
 <Select>
 <Select.Option value="IQD">IQD</Select.Option>
 <Select.Option value="USD">USD</Select.Option>
 <Select.Option value="EUR">EUR</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="date" label={t('multi_entity.date')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="description" label={t('multi_entity.description')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="reference" label={t('multi_entity.reference')}>
 <Input />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default IntercompanyTransactions;
