import React, { useState, useEffect } from 'react';
import {
 Card,
 Button,
 DatePicker,
 Form,
 Select,
 message,
 Space,
 Typography,
 Tag,
 Descriptions,
 Input,
 Row,
 Col,
 Statistic, Modal } from 'antd';
import {
 PlusOutlined,
 CheckCircleOutlined,
 ClockCircleOutlined,
 EyeOutlined,
 RollbackOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { palette } from '../../theme/tokens';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface RevaluationRun {
 id: string;
 period_end: string;
 status: string;
 total_gain: number;
 total_loss: number;
 net_impact: number;
 journal_entry_id?: string;
 lines: Array<{
 account_id: string;
 account_name: string;
 currency: string;
 foreign_balance: number;
 current_rate: number;
 revalued_local: number;
 book_local: number;
 gain_loss: number;
 }>;
 created_at: string;
 created_by?: string;
 notes?: string;
 reversed?: boolean;
}

interface PreviewData {
 processed: number;
 total_gain: number;
 total_loss: number;
 net: number;
 period_end: string;
 lines: Array<{
 account_id: string;
 account_name: string;
 currency: string;
 foreign_balance: number;
 current_rate: number;
 revalued_local: number;
 book_local: number;
 gain_loss: number;
 }>;
}

const RevaluationRuns: React.FC = () => {
 const { t } = useTranslation();
 const [runs, setRuns] = useState<RevaluationRun[]>([]);
 const [loading, setLoading] = useState(false);
 const [isDrawerVisible, setIsDrawerVisible] = useState(false);
 const [isDetailVisible, setIsDetailVisible] = useState(false);
 const [selectedRun, setSelectedRun] = useState<RevaluationRun | null>(null);
 const [previewData, setPreviewData] = useState<PreviewData | null>(null);
 const [previewLoading, setPreviewLoading] = useState(false);
 const [accounts, setAccounts] = useState<any[]>([]);
 const [form] = Form.useForm();

 useEffect(() => {
 fetchRuns();
 fetchAccounts();
 }, []);

 const fetchRuns = async () => {
 setLoading(true);
 try {
 const response = await api.get('/api/revaluations', {
 params: { page_size: 100 },
 });
 setRuns(response.data.items || []);
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('fx.fetchRunsError'));
 } finally {
 setLoading(false);
 }
 };

 const fetchAccounts = async () => {
 try {
 const response = await api.get('/api/accounts', {
 params: { page_size: 500 },
 });
 setAccounts(response.data.items || []);
 } catch (error: any) {
 console.error('Failed to fetch accounts:', error);
 }
 };

 const handlePreview = async (values: { period_end: Dayjs }) => {
 setPreviewLoading(true);
 try {
 const response = await api.post('/api/revaluations/preview', {
 period_end: values.period_end.format('YYYY-MM-DD'),
 });
 setPreviewData(response.data);
 message.success(t('fx.previewGenerated'));
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('fx.previewError'));
 } finally {
 setPreviewLoading(false);
 }
 };

 const handlePost = async (values: any) => {
 try {
 await api.post('/api/revaluations/run', {
 period_end: values.period_end.format('YYYY-MM-DD'),
 gain_account_id: values.gain_account_id,
 loss_account_id: values.loss_account_id,
 notes: values.notes || '',
 });
 message.success(t('fx.revaluationPosted'));
 setIsDrawerVisible(false);
 setPreviewData(null);
 form.resetFields();
 fetchRuns();
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('fx.postError'));
 }
 };

 const handleReverse = async (runId: string) => {
 Modal.confirm({
 title: t('fx.confirmReverse'),
 content: t('fx.confirmReverseContent'),
 okText: t('common.yes'),
 cancelText: t('common.no'),
 onOk: async () => {
 try {
 await api.post(`/api/revaluations/${runId}/reverse`);
 message.success(t('fx.reversedSuccessfully'));
 fetchRuns();
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('fx.reverseError'));
 }
 },
 });
 };

 const showDetail = async (runId: string) => {
 try {
 const response = await api.get(`/api/revaluations/${runId}`);
 setSelectedRun(response.data);
 setIsDetailVisible(true);
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('fx.fetchDetailError'));
 }
 };

 const columns = [
 {
 title: t('fx.periodEnd'),
 dataIndex: 'period_end',
 key: 'period_end',
 width: 120,
 render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
 },
 {
 title: t('fx.status'),
 dataIndex: 'status',
 key: 'status',
 width: 100,
 render: (status: string) => (
 <Tag color={status === 'posted' ? 'green' : 'blue'}>
 {status === 'posted' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
 {' '}
 {t(`fx.status_${status}`)}
 </Tag>
 ),
 },
 {
 title: t('fx.totalGain'),
 dataIndex: 'total_gain',
 key: 'total_gain',
 align: 'right' as const,
 width: 140,
 render: (val: number) => (
 <Text type="success">
 +{val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
 </Text>
 ),
 },
 {
 title: t('fx.totalLoss'),
 dataIndex: 'total_loss',
 key: 'total_loss',
 align: 'right' as const,
 width: 140,
 render: (val: number) => (
 <Text type="danger">
 -{val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
 </Text>
 ),
 },
 {
 title: t('fx.netImpact'),
 dataIndex: 'net_impact',
 key: 'net_impact',
 align: 'right' as const,
 width: 140,
 render: (val: number) => (
 <Text strong type={val >= 0 ? 'success' : 'danger'}>
 {val >= 0 ? '+' : ''}
 {val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
 </Text>
 ),
 },
 {
 title: t('fx.createdAt'),
 dataIndex: 'created_at',
 key: 'created_at',
 width: 160,
 render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
 },
 {
 title: t('common.actions'),
 key: 'actions',
 width: 180,
 render: (_: any, record: RevaluationRun) => (
 <Space>
 <Button
 type="link"
 icon={<EyeOutlined />}
 onClick={() => showDetail(record.id)}
 >
 {t('common.view')}
 </Button>
 {record.status === 'posted' && !record.reversed && (
 <Button
 type="link"
 danger
 icon={<RollbackOutlined />}
 onClick={() => handleReverse(record.id)}
 >
 {t('fx.reverse')}
 </Button>
 )}
 </Space>
 ),
 },
 ];

 const previewColumns = [
 {
 title: t('fx.account'),
 dataIndex: 'account_name',
 key: 'account_name',
 },
 {
 title: t('fx.currency'),
 dataIndex: 'currency',
 key: 'currency',
 width: 80,
 },
 {
 title: t('fx.foreignBalance'),
 dataIndex: 'foreign_balance',
 key: 'foreign_balance',
 align: 'right' as const,
 width: 130,
 render: (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2 }),
 },
 {
 title: t('fx.rate'),
 dataIndex: 'current_rate',
 key: 'current_rate',
 align: 'right' as const,
 width: 100,
 render: (val: number) => val.toFixed(4),
 },
 {
 title: t('fx.bookValue'),
 dataIndex: 'book_local',
 key: 'book_local',
 align: 'right' as const,
 width: 130,
 render: (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2 }),
 },
 {
 title: t('fx.revaluedValue'),
 dataIndex: 'revalued_local',
 key: 'revalued_local',
 align: 'right' as const,
 width: 130,
 render: (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2 }),
 },
 {
 title: t('fx.gainLoss'),
 dataIndex: 'gain_loss',
 key: 'gain_loss',
 align: 'right' as const,
 width: 130,
 render: (val: number) => (
 <Text strong type={val >= 0 ? 'success' : 'danger'}>
 {val >= 0 ? '+' : ''}
 {val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
 </Text>
 ),
 },
 ];

 return (
 <div style={{ padding: '24px' }}>
 <Card
 title={<Title level={3} style={{ margin: 0 }}>{t('fx.revaluations')}</Title>}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setIsDrawerVisible(true);
 setPreviewData(null);
 form.resetFields();
 }}
 >
 {t('fx.newRevaluation')}
 </Button>
 }
 >
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={runs}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </Card>

 {/* New Revaluation Drawer */}
 <FormDialog
 title={t('fx.newRevaluation')}
 open={isDrawerVisible}
 onClose={() => {
 setIsDrawerVisible(false);
 setPreviewData(null);
 form.resetFields();
 }}
 footer={
 !previewData ? null : (
 <Space>
 <Button onClick={() => setPreviewData(null)}>
 {t('common.back')}
 </Button>
 <Button type="primary" onClick={() => form.submit()}>
 {t('fx.postRevaluation')}
 </Button>
 </Space>
 )
 }
 >
 {!previewData ? (
 <Form
 form={form}
 layout="vertical"
 onFinish={handlePreview}
 initialValues={{ period_end: dayjs().endOf('month') }}
 >
 <Form.Item
 name="period_end"
 label={t('fx.periodEnd')}
 rules={[{ required: true, message: t('fx.periodEndRequired') }]}
 >
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>

 <Button
 type="primary"
 htmlType="submit"
 loading={previewLoading}
 block
 >
 {t('fx.generatePreview')}
 </Button>
 </Form>
 ) : (
 <>
 <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
 <Col span={8}>
 <Card>
 <Statistic
 title={t('fx.totalGain')}
 value={previewData.total_gain}
 precision={2}
 valueStyle={{ color: palette.success }}
 suffix="IQD"
 />
 </Card>
 </Col>
 <Col span={8}>
 <Card>
 <Statistic
 title={t('fx.totalLoss')}
 value={previewData.total_loss}
 precision={2}
 valueStyle={{ color: palette.danger }}
 suffix="IQD"
 />
 </Card>
 </Col>
 <Col span={8}>
 <Card>
 <Statistic
 title={t('fx.netImpact')}
 value={previewData.net}
 precision={2}
 valueStyle={{
 color: previewData.net >= 0 ? palette.success : palette.danger,
 }}
 suffix="IQD"
 />
 </Card>
 </Col>
 </Row>

 <ResponsiveTableAdapter
 columns={previewColumns}
 dataSource={previewData.lines}
 rowKey="account_id"
 pagination={false}
 style={{ marginBottom: '24px' }}
 />

 <Form
 form={form}
 layout="vertical"
 onFinish={handlePost}
 initialValues={{
 period_end: dayjs(previewData.period_end),
 }}
 >
 <Form.Item name="period_end" hidden>
 <DatePicker />
 </Form.Item>

 <Form.Item
 name="gain_account_id"
 label={t('fx.gainAccount')}
 rules={[{ required: true, message: t('fx.gainAccountRequired') }]}
 >
 <Select
 showSearch
 placeholder={t('fx.selectGainAccount')}
 filterOption={(input, option) =>
 String(option?.children ?? '')
 .toLowerCase()
 .indexOf(input.toLowerCase()) >= 0
 }
 >
 {accounts.map((acc) => (
 <Option key={acc.id} value={acc.id}>
 {acc.code} - {acc.name}
 </Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item
 name="loss_account_id"
 label={t('fx.lossAccount')}
 rules={[{ required: true, message: t('fx.lossAccountRequired') }]}
 >
 <Select
 showSearch
 placeholder={t('fx.selectLossAccount')}
 filterOption={(input, option) =>
 String(option?.children ?? '')
 .toLowerCase()
 .indexOf(input.toLowerCase()) >= 0
 }
 >
 {accounts.map((acc) => (
 <Option key={acc.id} value={acc.id}>
 {acc.code} - {acc.name}
 </Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item name="notes" label={t('fx.notes')}>
 <TextArea rows={3} />
 </Form.Item>
 </Form>
 </>
 )}
 </FormDialog>

 {/* Detail Modal */}
 <FormDialog
 title={t('fx.revaluationDetail')}
 open={isDetailVisible}
 onClose={() => {
 setIsDetailVisible(false);
 setSelectedRun(null);
 }} hideFooter
 >
 {selectedRun && (
 <>
 <Descriptions bordered column={2} style={{ marginBottom: '16px' }}>
 <Descriptions.Item label={t('fx.periodEnd')}>
 {dayjs(selectedRun.period_end).format('YYYY-MM-DD')}
 </Descriptions.Item>
 <Descriptions.Item label={t('fx.status')}>
 <Tag color={selectedRun.status === 'posted' ? 'green' : 'blue'}>
 {t(`fx.status_${selectedRun.status}`)}
 </Tag>
 </Descriptions.Item>
 <Descriptions.Item label={t('fx.totalGain')}>
 <Text type="success">
 +{selectedRun.total_gain.toLocaleString('en-US', { minimumFractionDigits: 2 })}
 </Text>
 </Descriptions.Item>
 <Descriptions.Item label={t('fx.totalLoss')}>
 <Text type="danger">
 -{selectedRun.total_loss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
 </Text>
 </Descriptions.Item>
 <Descriptions.Item label={t('fx.netImpact')}>
 <Text strong type={selectedRun.net_impact >= 0 ? 'success' : 'danger'}>
 {selectedRun.net_impact >= 0 ? '+' : ''}
 {selectedRun.net_impact.toLocaleString('en-US', { minimumFractionDigits: 2 })}
 </Text>
 </Descriptions.Item>
 <Descriptions.Item label={t('fx.journalEntry')}>
 {selectedRun.journal_entry_id || '-'}
 </Descriptions.Item>
 </Descriptions>

 <ResponsiveTableAdapter
 columns={previewColumns}
 dataSource={selectedRun.lines}
 rowKey="account_id"
 pagination={false}
 />
 </>
 )}
 </FormDialog>
 </div>
 );
};

export default RevaluationRuns;
