import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Tabs, Button, Space, Input, Form, Select, InputNumber } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, DeleteOutlined, LineChartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../api';
import { PageHeader, SectionCard, ChartCard, type ColumnVisibilityItem } from '../../design-system';
import KitListCard from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
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

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

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
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('agriculture.fields.hiddenCols') || '[]'); } catch { return []; }
 });

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

 const allFieldColumns: any[] = [
 {
 title: t('agriculture.field_name'),
 dataIndex: 'name',
 key: 'name',
 width: 220,
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(v)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
 </div>
 ),
 },
 {
 title: t('agriculture.location'),
 dataIndex: 'location',
 key: 'location',
 width: 200,
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)' }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('agriculture.area_dunum'),
 dataIndex: 'area_dunum',
 key: 'area_dunum',
 width: 120,
 align: 'right',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
 {v.toLocaleString()}
 </span>
 ),
 },
 {
 title: t('agriculture.soil_type'),
 dataIndex: 'soil_type',
 key: 'soil_type',
 width: 150,
 render: (v: string) => v
 ? (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{v}</span>
 )
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, rec: Field) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDeleteField(rec.id) },
 ]}
 />
 ),
 },
 ];

 const fieldColumns = useMemo(
 () => allFieldColumns.filter((c) => !hiddenCols.includes(c.key)),
 [hiddenCols, t],
 );
 const columnsMeta: ColumnVisibilityItem[] = allFieldColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' && c.title ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('agriculture.fields.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

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

 <Tabs activeKey={activeTab} onChange={setActiveTab}>
 <Tabs.TabPane tab={t('agriculture.fields')} key="1">
 <KitListCard
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('agriculture-fields', filteredFields, cols);
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
 columns={fieldColumns}
 dataSource={filteredFields}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 scroll={{ x: 800 }}
 />
 </KitListCard>
 </Tabs.TabPane>

 <Tabs.TabPane tab={t('agriculture.yield_tracking')} key="2">
 <SectionCard>
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
 <ChartCard
 title={t('agriculture.harvest_history')}
 loading={loadingYield}
 extra={<LineChartOutlined style={{ color: 'var(--ink-400)' }} />}
 >
 {yieldData.length > 0 ? (
 <ResponsiveChart
 legendItems={[
 { id: 'quantity', labelKey: asTranslationKey('agriculture.quantity'), color: 'var(--success-500)' },
 ]}
 >
 <LineChart data={yieldData}>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
 <XAxis dataKey="date" tick={{ fill: 'var(--ink-400)' }} />
 <YAxis tick={{ fill: 'var(--ink-400)' }} />
 <Tooltip
 content={(props: any) => {
 if (!props.active || !props.payload || props.payload.length === 0) return null;
 const data = props.payload[0].payload;
 return (
 <div
 style={{
 background: 'var(--surface)',
 padding: '8px 12px',
 border: '1px solid var(--border)',
 borderRadius: 'var(--radius-sm)',
 color: 'var(--ink-900)',
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
 <Line type="monotone" dataKey="quantity" stroke="var(--success-500)" strokeWidth={2} />
 </LineChart>
 </ResponsiveChart>
 ) : (
 <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-400)' }}>
 {t('agriculture.no_yield_data')}
 </div>
 )}
 </ChartCard>
 )}
 </Space>
 </SectionCard>
 </Tabs.TabPane>
 </Tabs>

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
