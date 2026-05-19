import type React from 'react';
import { useEffect, useState } from 'react';
import { Tabs, Button, Space, Input, Form, Select, InputNumber, Card } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, SearchOutlined, DeleteOutlined, LineChartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Popconfirm } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';

interface Field {
 id: string;
 name: string;
 area_dunum: number;
 soil_type?: string;
 location?: string;
 created_at: string;
}

interface YieldData {
 date: string;
 quantity: number;
 crop_name?: string;
}

const FieldsAndYield: React.FC = () => {
 const { t } = useTranslation();
 const [activeTab, setActiveTab] = useState('1');
 const [fields, setFields] = useState<Field[]>([]);
 const [selectedField, setSelectedField] = useState<string | null>(null);
 const [yieldData, setYieldData] = useState<YieldData[]>([]);
 const [loading, setLoading] = useState(false);
 const [loadingYield, setLoadingYield] = useState(false);
 const [search, setSearch] = useState('');
 const [drawer, setDrawer] = useState(false);
 const [form] = Form.useForm();

 const fetchFields = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/agriculture/fields', { params: { limit: 100 } });
 setFields(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchYieldData = async (fieldId: string) => {
 setLoadingYield(true);
 try {
 const res = await api.get(`/api/agriculture/fields/${fieldId}/yield`);
 setYieldData(res.data.harvests || []);
 } catch {
 message.error(t('agriculture.yield_error'));
 } finally {
 setLoadingYield(false);
 }
 };

 useEffect(() => {
 void fetchFields();
 }, []);

 useEffect(() => {
 if (selectedField) {
 void fetchYieldData(selectedField);
 } else {
 setYieldData([]);
 }
 }, [selectedField]);

 const handleCreateField = async (values: any) => {
 try {
 await api.post('/api/agriculture/fields', values);
 message.success(t('success'));
 setDrawer(false);
 form.resetFields();
 void fetchFields();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDeleteField = async (id: string) => {
 try {
 await api.delete(`/api/agriculture/fields/${id}`);
 message.success(t('agriculture.field_deleted'));
 void fetchFields();
 } catch {
 message.error(t('error'));
 }
 };

 const filteredFields = fields.filter((f) =>
 !search ||
 f.name?.toLowerCase().includes(search.toLowerCase()) ||
 f.location?.toLowerCase().includes(search.toLowerCase())
 );

 const fieldColumns: any[] = [
 { title: t('agriculture.field_name'), dataIndex: 'name', key: 'name', width: 200 },
 { title: t('agriculture.location'), dataIndex: 'location', key: 'location', width: 200 },
 {
 title: t('agriculture.area_dunum'),
 dataIndex: 'area_dunum',
 key: 'area_dunum',
 width: 120,
 align: 'right',
 render: (v: number) => v.toLocaleString(),
 },
 { title: t('agriculture.soil_type'), dataIndex: 'soil_type', key: 'soil_type', width: 150 },
 {
 title: t('actions'),
 key: 'actions',
 width: 100,
 align: 'center',
 render: (_: any, rec: Field) => (
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDeleteField(rec.id)}>
 <Button type="text" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 ),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('agriculture.title')}
 subtitle={t('agriculture.subtitle')}
 breadcrumb={[{ label: t('agriculture.title') }]}
 extra={
 activeTab === '1' ? (
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawer(true)}>
 {t('agriculture.add_field')}
 </Button>
 ) : null
 }
 />

 <div style={{ background: '#fff', padding: space.lg, borderRadius: 8 }}>
 <Tabs activeKey={activeTab} onChange={setActiveTab}>
 <Tabs.TabPane tab={t('agriculture.fields')} key="1">
 <Space style={{ marginBottom: space.md }}>
 <Input
 placeholder={t('search')}
 prefix={<SearchOutlined />}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 style={{ width: 300 }}
 allowClear
 />
 </Space>

 <ResponsiveTableAdapter
 columns={fieldColumns}
 dataSource={filteredFields}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 scroll={{ x: 800 }}
 />
 </Tabs.TabPane>

 <Tabs.TabPane tab={t('agriculture.yield_tracking')} key="2">
 <Space direction="vertical" style={{ width: '100%' }}>
 <Select
 placeholder={t('agriculture.select_field')}
 value={selectedField}
 onChange={setSelectedField}
 style={{ width: 350 }}
 showSearch
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {fields.map((f) => (
 <Select.Option key={f.id} value={f.id}>
 {f.name} ({f.area_dunum} {t('agriculture.dunum')})
 </Select.Option>
 ))}
 </Select>

 {selectedField && (
 <Card
 title={t('agriculture.harvest_history')}
 loading={loadingYield}
 extra={<LineChartOutlined />}
 >
 {yieldData.length > 0 ? (
 <ResponsiveChart
 legendItems={[
 { id: 'quantity', labelKey: asTranslationKey('agriculture.quantity'), color: '#52c41a' },
 ]}
 >
 <LineChart data={yieldData}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="date" />
 <YAxis />
 <Tooltip
 content={(props: any) => {
 if (!props.active || !props.payload || props.payload.length === 0) return null;
 const data = props.payload[0].payload;
 return (
 <div
 style={{
 background: '#fff',
 padding: '8px 12px',
 border: '1px solid #ddd',
 borderRadius: 4,
 }}
 >
 <div>
 <strong>{data.date}</strong>
 </div>
 <div>
 {t('agriculture.quantity')}: {data.quantity.toLocaleString()} kg
 </div>
 {data.crop_name && (
 <div>
 {t('agriculture.crop')}: {data.crop_name}
 </div>
 )}
 </div>
 );
 }}
 />
 <Line type="monotone" dataKey="quantity" stroke="#52c41a" strokeWidth={2} />
 </LineChart>
 </ResponsiveChart>
 ) : (
 <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
 {t('agriculture.no_yield_data')}
 </div>
 )}
 </Card>
 )}
 </Space>
 </Tabs.TabPane>
 </Tabs>
 </div>

 <FormDialog title={t('agriculture.add_field')} open={drawer} onClose={() => setDrawer(false)}>
 <Form form={form} layout="vertical" onFinish={handleCreateField}>
 <Form.Item name="name" label={t('agriculture.field_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="location" label={t('agriculture.location')}>
 <Input />
 </Form.Item>
 <Form.Item name="area_dunum" label={t('agriculture.area_dunum')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="soil_type" label={t('agriculture.soil_type')}>
 <Input placeholder={t('agriculture.soil_type_placeholder')} />
 </Form.Item>
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

export default FieldsAndYield;
