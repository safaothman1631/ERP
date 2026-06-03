import React, { useState, useEffect, useMemo } from 'react';
import {
 Button,
 DatePicker,
 Form,
 Select,
 message,
 Space,
 Typography,
 Descriptions,
 Input,
 Radio,
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
import { PageHeader, SectionCard, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';

const { Text } = Typography;
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
 // Presentation-only: client-side status segment over the already-loaded runs.
 // The /api/revaluations query is unchanged (no server status param exists).
 const [statusTab, setStatusTab] = useState<'all' | 'posted' | 'draft'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('revaluations.hiddenCols') || '[]'); } catch { return []; }
 });

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

 const allColumns = [
 {
 title: t('fx.periodEnd'),
 dataIndex: 'period_end',
 key: 'period_end',
 width: 140,
 render: (date: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>
 {dayjs(date).format('YYYY-MM-DD')}
 </span>
 ),
 },
 {
 title: t('fx.status'),
 dataIndex: 'status',
 key: 'status',
 width: 100,
 render: (status: string) => (
 <StatusTag
 status={status === 'posted' ? 'success' : 'info'}
 icon={status === 'posted' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
 label={t(`fx.status_${status}`)}
 />
 ),
 },
 {
 title: t('fx.totalGain'),
 dataIndex: 'total_gain',
 key: 'total_gain',
 align: 'right' as const,
 width: 140,
 render: (val: number) => (
 <Text type="success" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
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
 <Text type="danger" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
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
 <Text strong type={val >= 0 ? 'success' : 'danger'} style={{ fontFamily: 'var(--font-mono)' }}>
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
 render: (date: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-500)', fontSize: 12.5 }}>
 {dayjs(date).format('YYYY-MM-DD HH:mm')}
 </span>
 ),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: RevaluationRun) => (
 <KitRowActions
 ariaLabel={t('common.actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('common.view'), onClick: () => showDetail(record.id) },
 ...(record.status === 'posted' && !record.reversed
 ? [{ key: 'reverse', icon: <RollbackOutlined />, label: t('fx.reverse'), danger: true, onClick: () => handleReverse(record.id) }]
 : []),
 ]}
 />
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' && c.title ? c.title : c.key,
 pinned: c.key === 'period_end' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('revaluations.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 // Client-side status segment + free-text search over the loaded runs (presentation only).
 const filteredRuns = useMemo(() => {
 const byStatus = statusTab === 'all' ? runs : runs.filter((r) => r.status === statusTab);
 if (!search) return byStatus;
 const q = search.toLowerCase();
 return byStatus.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }, [runs, statusTab, search]);
 const tabs: KitListTab[] = [
 { key: 'all', label: t('common.all', 'All'), count: runs.length },
 { key: 'posted', label: t('fx.status_posted', 'Posted'), count: runs.filter((r) => r.status === 'posted').length },
 { key: 'draft', label: t('fx.status_draft', 'Draft'), count: runs.filter((r) => r.status === 'draft').length },
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
 <div>
 <PageHeader
 title={t('fx.revaluations')}
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
 />
 <KitListCard
 tabs={tabs}
 activeTab={statusTab}
 onTabChange={(k) => setStatusTab(k as typeof statusTab)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 {/* Group Filters + Status in one flex unit so they always wrap together. */}
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusTab !== 'all' ? 1 : 0}
 onClear={() => setStatusTab('all')}
 >
 <Radio.Group
 value={statusTab}
 onChange={(e) => setStatusTab(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('common.all', 'All')}</Radio>
 <Radio value="posted">{t('fx.status_posted', 'Posted')}</Radio>
 <Radio value="draft">{t('fx.status_draft', 'Draft')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('fx.status')}
 anyLabel={t('common.all', 'All')}
 value={statusTab === 'all' ? '' : statusTab}
 onChange={(v) => setStatusTab((v || 'all') as typeof statusTab)}
 options={[
 { value: 'posted', label: t('fx.status_posted', 'Posted') },
 { value: 'draft', label: t('fx.status_draft', 'Draft') },
 ]}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('revaluations', filteredRuns, cols);
 }}
 onPrint={() => window.print()}
 onImport={() => message.info(t('coming_soon', 'Coming soon'))}
 onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
 onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
 />
 </div>
 </>
 }
 >
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={filteredRuns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </KitListCard>

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
 <SectionCard>
 <Statistic
 title={t('fx.totalGain')}
 value={previewData.total_gain}
 precision={2}
 valueStyle={{ color: 'var(--success-fg)' }}
 suffix="IQD"
 />
 </SectionCard>
 </Col>
 <Col span={8}>
 <SectionCard>
 <Statistic
 title={t('fx.totalLoss')}
 value={previewData.total_loss}
 precision={2}
 valueStyle={{ color: 'var(--danger-fg)' }}
 suffix="IQD"
 />
 </SectionCard>
 </Col>
 <Col span={8}>
 <SectionCard>
 <Statistic
 title={t('fx.netImpact')}
 value={previewData.net}
 precision={2}
 valueStyle={{
 color: previewData.net >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)',
 }}
 suffix="IQD"
 />
 </SectionCard>
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
 <StatusTag status={selectedRun.status === 'posted' ? 'success' : 'info'} label={t(`fx.status_${selectedRun.status}`)} />
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
