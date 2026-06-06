import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, Space, DatePicker, Radio } from 'antd';
import { PlusOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
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

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const IntercompanyTransactions = () => {
 const { t } = useTranslation();
 const [loading, setLoading] = useState(false);
 const [transactions, setTransactions] = useState<ICTransaction[]>([]);
 const [companies, setCompanies] = useState<Company[]>([]);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [tab, setTab] = useState<'all' | 'eliminated' | 'open'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('intercompany.hiddenCols') || '[]'); } catch { return []; }
 });
 const [form] = Form.useForm();

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

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: ICTransaction) => {
 const { id: _id, eliminated: _eliminated, date, ...rest } = record;
 form.resetFields();
 form.setFieldsValue({ ...rest, date: date ? dayjs(date) : undefined });
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

 // Client-side segment of the already-loaded rows by elimination status (presentation only).
 const filteredTransactions = useMemo(() => {
 let rows = transactions;
 if (tab === 'eliminated') rows = rows.filter((x) => x.eliminated);
 else if (tab === 'open') rows = rows.filter((x) => !x.eliminated);
 if (search) {
 const q = search.toLowerCase();
 rows = rows.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }
 return rows;
 }, [transactions, tab, search]);

 // Kit list tabs (All / Eliminated / Open) — segments of the elimination flag.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 { key: 'eliminated', label: t('multi_entity.eliminated_yes', 'Eliminated') },
 { key: 'open', label: t('multi_entity.eliminated_no', 'Not eliminated') },
 ];

 const allColumns: ColumnsType<ICTransaction> = [
 {
 title: t('multi_entity.date'),
 dataIndex: 'date',
 key: 'date',
 render: (date) => (
 <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
 {dayjs(date).format('YYYY-MM-DD')}
 </span>
 ),
 },
 {
 title: t('multi_entity.from_company'),
 dataIndex: 'from_company_id',
 key: 'from_company_id',
 render: (id) => {
 const name = getCompanyName(id);
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(name)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{name}</span>
 </div>
 );
 },
 },
 {
 title: t('multi_entity.to_company'),
 dataIndex: 'to_company_id',
 key: 'to_company_id',
 render: (id) => <span style={{ color: 'var(--ink-700)' }}>{getCompanyName(id)}</span>,
 },
 {
 title: t('multi_entity.amount'),
 dataIndex: 'amount',
 key: 'amount',
 render: (amount, record) => (
 <span style={{ color: 'var(--ink-900)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
 {`${amount.toLocaleString()} ${record.currency}`}
 </span>
 ),
 },
 {
 title: t('multi_entity.description'),
 dataIndex: 'description',
 key: 'description',
 render: (v) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('multi_entity.reference'),
 dataIndex: 'reference',
 key: 'reference',
 render: (v) => v
 ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('multi_entity.eliminated'),
 dataIndex: 'eliminated',
 key: 'eliminated',
 render: (eliminated) => (
 <StatusTag status={eliminated ? 'success' : 'warning'} label={eliminated ? t('multi_entity.eliminated_yes') : t('multi_entity.eliminated_no')} />
 ),
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: unknown, record: ICTransaction) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(
 () => allColumns.filter((c) => !hiddenCols.includes(String(c.key))),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [hiddenCols, t, companies],
 );
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: String(c.key),
 label: typeof c.title === 'string' ? c.title : String(c.key),
 pinned: c.key === 'from_company_id' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('intercompany.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <>
 <PageHeader
 title={t('multi_entity.ic_transactions')}
 subtitle={t('multi_entity.ic_transactions_subtitle')}
 extra={
 <Space>
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('multi_entity.add_ic_transaction')}
 </Button>
 </Space>
 }
 />
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => setTab(k as typeof tab)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={tab !== 'all' ? 1 : 0}
 onClear={() => setTab('all')}
 >
 <Radio.Group
 value={tab}
 onChange={(e) => setTab(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 <Radio value="eliminated">{t('multi_entity.eliminated_yes', 'Eliminated')}</Radio>
 <Radio value="open">{t('multi_entity.eliminated_no', 'Not eliminated')}</Radio>
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('multi_entity.eliminated', 'Status')}
 anyLabel={t('all', 'All')}
 value={tab === 'all' ? '' : tab}
 onChange={(v) => setTab((v || 'all') as typeof tab)}
 options={[
 { value: 'eliminated', label: t('multi_entity.eliminated_yes', 'Eliminated') },
 { value: 'open', label: t('multi_entity.eliminated_no', 'Not eliminated') },
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
 downloadCsv('intercompany', filteredTransactions, cols);
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
 dataSource={filteredTransactions}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </KitListCard>

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
