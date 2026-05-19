import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Button, Space, Tag, Form, DatePicker, InputNumber, Empty, Spin, Input } from 'antd';
import { ArrowLeftOutlined, FallOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';

interface Asset {
 id: string;
 asset_code: string;
 name: string;
 acquisition_date: string;
 acquisition_cost: number;
 salvage_value: number;
 useful_life_months: number;
 depreciation_method: string;
 status: string;
 book_value: number;
 accumulated_depreciation: number;
 location?: string;
 notes?: string;
 depreciation_entries?: DepreciationEntry[];
}

interface DepreciationEntry {
 id: string;
 period: string;
 period_end_date: string;
 depreciation_amount: number;
 journal_entry_id: string;
 status: string;
 created_at: string;
}

interface ScheduleItem {
 period: string;
 opening_book_value: number;
 depreciation_amount: number;
 closing_book_value: number;
}

const statusColors: Record<string, string> = {
 active: 'green',
 fully_depreciated: 'orange',
 disposed: 'red',
};

const AssetDetail: React.FC = () => {
 const { t } = useTranslation();
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const [asset, setAsset] = useState<Asset | null>(null);
 const [loading, setLoading] = useState(false);
 const [history, setHistory] = useState<DepreciationEntry[]>([]);
 const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
 const [disposeModal, setDisposeModal] = useState(false);
 const [disposeForm] = Form.useForm();
 const [disposing, setDisposing] = useState(false);

 const fetchAsset = async () => {
 if (!id) return;
 setLoading(true);
 try {
 const r = await api.get(`/api/fixed-assets/assets/${id}`);
 setAsset(r.data);
 setHistory(r.data.depreciation_entries || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchSchedule = async () => {
 if (!id) return;
 try {
 const r = await api.get('/api/fixed-assets/assets/reports/depreciation-schedule', { params: { asset_id: id, months: 60 } });
 setSchedule(r.data.items || []);
 } catch {
 // Ignore
 }
 };

 useEffect(() => {
 fetchAsset();
 fetchSchedule();
 }, [id]);

 const handleDispose = async (values: Record<string, unknown>) => {
 if (!id) return;
 setDisposing(true);
 try {
 await api.post(`/api/fixed-assets/assets/${id}/dispose`, {
 disposal_date: (values.disposal_date as Dayjs).format('YYYY-MM-DD'),
 proceeds: values.proceeds,
 notes: values.notes,
 });
 message.success(t('success'));
 setDisposeModal(false);
 fetchAsset();
 } catch (err: unknown) {
 const errorDetail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
 message.error(errorDetail || t('error'));
 } finally {
 setDisposing(false);
 }
 };

 if (loading) return <Spin />;
 if (!asset) return <Empty description={t('assets.not_found')} />;

 const historyColumns = [
 { title: t('assets.period'), dataIndex: 'period', key: 'period' },
 { title: t('date'), dataIndex: 'period_end_date', key: 'date' },
 { title: t('assets.depreciation_amount'), dataIndex: 'depreciation_amount', key: 'amount', render: (v: number) => v.toLocaleString() },
 { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'posted' ? 'green' : 'default'}>{s}</Tag> },
 ];

 const chartData = schedule.map((s) => ({
 period: s.period,
 value: s.closing_book_value,
 }));

 return (
 <>
 <PageHeader
 title={asset.name}
 extra={
 <Space>
 {asset.status === 'active' && (
 <Button icon={<StopOutlined />} onClick={() => setDisposeModal(true)}>{t('assets.dispose')}</Button>
 )}
 <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assets')}>{t('back')}</Button>
 </Space>
 }
 />
 <Card title={t('assets.asset_info')}>
 <Descriptions bordered column={2}>
 <Descriptions.Item label={t('assets.asset_code')}>{asset.asset_code}</Descriptions.Item>
 <Descriptions.Item label={t('status')}>
 <Tag color={statusColors[asset.status] || 'default'}>{t(`assets.status_${asset.status}`)}</Tag>
 </Descriptions.Item>
 <Descriptions.Item label={t('assets.acquisition_date')}>{asset.acquisition_date}</Descriptions.Item>
 <Descriptions.Item label={t('assets.acquisition_cost')}>{asset.acquisition_cost.toLocaleString()}</Descriptions.Item>
 <Descriptions.Item label={t('assets.salvage_value')}>{asset.salvage_value.toLocaleString()}</Descriptions.Item>
 <Descriptions.Item label={t('assets.useful_life')}>{asset.useful_life_months} {t('months')}</Descriptions.Item>
 <Descriptions.Item label={t('assets.depreciation_method')}>{t(`assets.${asset.depreciation_method}`)}</Descriptions.Item>
 <Descriptions.Item label={t('assets.accumulated_depreciation')}>{asset.accumulated_depreciation.toLocaleString()}</Descriptions.Item>
 <Descriptions.Item label={t('assets.book_value')}>{asset.book_value.toLocaleString()}</Descriptions.Item>
 <Descriptions.Item label={t('assets.location')}>{asset.location || '—'}</Descriptions.Item>
 {asset.notes && <Descriptions.Item label={t('notes')} span={2}>{asset.notes}</Descriptions.Item>}
 </Descriptions>
 </Card>

 <Card title={t('assets.depreciation_history')} style={{ marginTop: 16 }}>
 <ResponsiveTableAdapter columns={historyColumns} dataSource={history} rowKey="id" pagination={false} locale={{ emptyText: <Empty description={t('assets.no_depreciation_yet')} /> }} />
 </Card>

 {schedule.length > 0 && (
 <Card title={t('assets.projected_schedule')} style={{ marginTop: 16 }}>
 <ResponsiveChart
 legendItems={[
 { id: 'bookValue', labelKey: asTranslationKey('assets.book_value'), color: '#1890ff' },
 ]}
 >
 <LineChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="period" />
 <YAxis />
 <Tooltip />
 <Line type="monotone" dataKey="value" stroke="#1890ff" name={t('assets.book_value')} />
 </LineChart>
 </ResponsiveChart>
 </Card>
 )}

 <FormDialog
 title={t('assets.dispose')}
 open={disposeModal}
 onClose={() => setDisposeModal(false)}
 onOk={() => disposeForm.submit()}
 confirmLoading={disposing}
 >
 <Form form={disposeForm} layout="vertical" onFinish={handleDispose}>
 <Form.Item name="disposal_date" label={t('assets.disposal_date')} rules={[{ required: true }]} initialValue={dayjs()}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="proceeds" label={t('assets.disposal_proceeds')} rules={[{ required: true }]} initialValue={0}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="notes" label={t('notes')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default AssetDetail;
