import React, { useMemo, useState, useEffect } from 'react';
import { Button, DatePicker, Form, InputNumber, Select, message, Space, Input, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined, LineChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';
import { PageHeader, SectionCard, type ColumnVisibilityItem } from '../../design-system';
import KitListCard from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';

const { Option } = Select;
const CHART_ACCENT = 'var(--accent-500)';

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
 const [search, setSearch] = useState('');
 const [form] = Form.useForm();
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('currency-rates.hiddenCols') || '[]'); } catch { return []; }
 });

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

 // Kit cell renderers — muted currency/source chips, mono rate (money) + date.
 const allColumns = [
 {
 title: t('fx.currency'),
 dataIndex: 'currency',
 key: 'currency',
 width: 100,
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{v}</span>
 ),
 },
 {
 title: t('fx.rate'),
 dataIndex: 'rate',
 key: 'rate',
 width: 120,
 render: (rate: number) => (
 <span style={{ color: 'var(--ink-900)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
 {rate.toFixed(4)}
 </span>
 ),
 },
 {
 title: t('fx.effectiveDate'),
 dataIndex: 'effective_date',
 key: 'effective_date',
 width: 120,
 render: (date: string) => (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
 {dayjs(date).format('YYYY-MM-DD')}
 </span>
 ),
 },
 {
 title: t('fx.source'),
 dataIndex: 'source',
 key: 'source',
 width: 100,
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{v}</span>
 ),
 },
 {
 title: t('fx.notes'),
 dataIndex: 'notes',
 key: 'notes',
 ellipsis: true,
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-600)' }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: CurrencyRate) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
 const filteredData = useMemo(() => {
 if (!search) return rates;
 const q = search.toLowerCase();
 return rates.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [rates, search]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'currency' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('currency-rates.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const currencyOptions = currencies.map((c) => ({ value: c, label: c }));

 return (
 <div>
 <PageHeader
 title={t('fx.currencyRates')}
 extra={
 <Space>
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
 />

 {showChart && chartData.length > 0 && (
 <SectionCard>
 <ResponsiveChart
 legendItems={[
 { id: 'rate', labelKey: asTranslationKey('fx.rate'), color: CHART_ACCENT },
 ]}
 minMobileBlockSize={300}
 >
 <LineChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
 <XAxis dataKey="date" />
 <YAxis />
 <Tooltip />
 <Line type="monotone" dataKey="rate" stroke={CHART_ACCENT} name={t('fx.rate')} />
 </LineChart>
 </ResponsiveChart>
 </SectionCard>
 )}

 <KitListCard
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); }}
 placeholder={t('search')}
 />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={selectedCurrency ? 1 : 0}
 onClear={() => { setSelectedCurrency('USD'); fetchRates('USD'); }}
 >
 <Radio.Group
 value={selectedCurrency}
 onChange={(e) => { setSelectedCurrency(e.target.value); fetchRates(e.target.value); }}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 {currencies.map((c) => (
 <Radio key={c} value={c}>{c}</Radio>
 ))}
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('fx.currency')}
 anyLabel={t('fx.currency')}
 value={selectedCurrency}
 onChange={(v) => { const next = v || 'USD'; setSelectedCurrency(next); fetchRates(next); }}
 options={currencyOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('currency-rates', filteredData, cols);
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
 dataSource={filteredData}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </KitListCard>

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
