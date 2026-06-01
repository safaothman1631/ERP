import React, { useState, useEffect } from 'react';
import { Card, Button, DatePicker, Form, InputNumber, Select, message, Space, Typography, Input } from 'antd';
import { PlusOutlined, DeleteOutlined, LineChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';
import { palette } from '../../theme/tokens';

const { Title, Text: _Text } = Typography;
const { Option } = Select;

interface CurrencyRate {
 id: string;
 currency: string;
 rate: number;
 effective_date: string;
 source: string;
 notes?: string;
 created_at?: string;
 created_by?: string;
}

const CurrencyRates: React.FC = () => {
 const { t } = useTranslation();
 const [rates, setRates] = useState<CurrencyRate[]>([]);
 const [loading, setLoading] = useState(false);
 const [isModalVisible, setIsModalVisible] = useState(false);
 const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
 const [showChart, setShowChart] = useState(false);
 const [chartData, setChartData] = useState<any[]>([]);
 const [form] = Form.useForm();

 const currencies = ['USD', 'EUR', 'GBP', 'TRY', 'SAR', 'AED', 'KWD', 'JOD'];

 useEffect(() => {
 fetchRates();
 }, [selectedCurrency]);

 const fetchRates = async (currency?: string) => {
 setLoading(true);
 try {
 const params: any = { page_size: 100 };
 if (currency || selectedCurrency) {
 params.currency = currency || selectedCurrency;
 }
 const response = await api.get('/api/currency-rates', { params });
 setRates(response.data.items || []);
 
 // Prepare chart data
 if (response.data.items?.length > 0) {
 const chartPoints = response.data.items
 .slice(0, 30)
 .reverse()
 .map((r: CurrencyRate) => ({
 date: dayjs(r.effective_date).format('MMM DD'),
 rate: r.rate,
 }));
 setChartData(chartPoints);
 }
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('fx.fetchError'));
 } finally {
 setLoading(false);
 }
 };

 const handleCreate = async (values: any) => {
 try {
 await api.post('/api/currency-rates', {
 currency: values.currency,
 rate: values.rate,
 effective_date: values.effective_date.format('YYYY-MM-DD'),
 source: values.source || 'manual',
 notes: values.notes || '',
 });
 message.success(t('fx.rateCreated'));
 setIsModalVisible(false);
 form.resetFields();
 fetchRates();
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('fx.createError'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/currency-rates/${id}`);
 message.success(t('fx.rateDeleted'));
 fetchRates();
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('fx.deleteError'));
 }
 };

 const columns = [
 {
 title: t('fx.currency'),
 dataIndex: 'currency',
 key: 'currency',
 width: 100,
 },
 {
 title: t('fx.rate'),
 dataIndex: 'rate',
 key: 'rate',
 width: 120,
 render: (rate: number) => rate.toFixed(4),
 },
 {
 title: t('fx.effectiveDate'),
 dataIndex: 'effective_date',
 key: 'effective_date',
 width: 120,
 render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
 },
 {
 title: t('fx.source'),
 dataIndex: 'source',
 key: 'source',
 width: 100,
 },
 {
 title: t('fx.notes'),
 dataIndex: 'notes',
 key: 'notes',
 ellipsis: true,
 },
 {
 title: t('common.actions'),
 key: 'actions',
 width: 100,
 render: (_: any, record: CurrencyRate) => (
 <Button
 type="text"
 danger
 icon={<DeleteOutlined />}
 onClick={() => handleDelete(record.id)}
 />
 ),
 },
 ];

 return (
 <div style={{ padding: '24px' }}>
 <Card
 title={<Title level={3} style={{ margin: 0 }}>{t('fx.currencyRates')}</Title>}
 extra={
 <Space>
 <Select
 value={selectedCurrency}
 onChange={(value) => {
 setSelectedCurrency(value);
 fetchRates(value);
 }}
 style={{ width: 120 }}
 >
 {currencies.map((c) => (
 <Option key={c} value={c}>
 {c}
 </Option>
 ))}
 </Select>
 <Button
 icon={<LineChartOutlined />}
 onClick={() => setShowChart(!showChart)}
 >
 {showChart ? t('fx.hideChart') : t('fx.showChart')}
 </Button>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => setIsModalVisible(true)}
 >
 {t('fx.addRate')}
 </Button>
 </Space>
 }
 >
 {showChart && chartData.length > 0 && (
 <div style={{ marginBottom: '24px' }}>
 <ResponsiveChart
 legendItems={[
 { id: 'rate', labelKey: asTranslationKey('fx.rate'), color: palette.primary500 },
 ]}
 minMobileBlockSize={300}
 >
 <LineChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="date" />
 <YAxis />
 <Tooltip />
 <Line type="monotone" dataKey="rate" stroke={palette.primary500} name={t('fx.rate')} />
 </LineChart>
 </ResponsiveChart>
 </div>
 )}

 <ResponsiveTableAdapter
 columns={columns}
 dataSource={rates}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </Card>

 <FormDialog
 title={t('fx.addRate')}
 open={isModalVisible}
 onClose={() => {
 setIsModalVisible(false);
 form.resetFields();
 }}
 onOk={() => form.submit()}
 >
 <Form
 form={form}
 layout="vertical"
 onFinish={handleCreate}
 initialValues={{
 effective_date: dayjs(),
 source: 'manual',
 }}
 >
 <Form.Item
 name="currency"
 label={t('fx.currency')}
 rules={[{ required: true, message: t('fx.currencyRequired') }]}
 >
 <Select>
 {currencies.map((c) => (
 <Option key={c} value={c}>
 {c}
 </Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item
 name="rate"
 label={t('fx.rate')}
 rules={[{ required: true, message: t('fx.rateRequired') }]}
 >
 <InputNumber
 min={0.0001}
 step={0.0001}
 precision={4}
 style={{ width: '100%' }}
 placeholder="1500.0000"
 />
 </Form.Item>

 <Form.Item
 name="effective_date"
 label={t('fx.effectiveDate')}
 rules={[{ required: true, message: t('fx.dateRequired') }]}
 >
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>

 <Form.Item name="source" label={t('fx.source')}>
 <Select>
 <Option value="manual">{t('fx.sourceManual')}</Option>
 <Option value="cbi">{t('fx.sourceCBI')}</Option>
 <Option value="imported">{t('fx.sourceImported')}</Option>
 </Select>
 </Form.Item>

 <Form.Item name="notes" label={t('fx.notes')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default CurrencyRates;
