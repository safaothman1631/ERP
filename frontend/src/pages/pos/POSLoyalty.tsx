import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, App, Switch, DatePicker, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import type { StatusKind } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitSearchInput from '../../design-system/KitSearchInput';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
import { downloadCsv } from '../../utils/exportCsv';

// Map loyalty program types → StatusTag semantic kinds (auto-flip tokens).
const PROGRAM_TYPE_KIND: Record<string, StatusKind> = {
 loyalty: 'info',
 coupons: 'active',
 gift_card: 'viewed',
 ewallet: 'warning',
 promotion: 'error',
};

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

interface LoyaltyProgram {
 id: string;
 name: string;
 name_ku?: string;
 program_type: string;
 point_ratio: number;
 min_amount: number;
 date_from?: string;
 date_to?: string;
 is_active: boolean;
}

interface LoyaltyCard {
 id: string;
 program_id: string;
 partner_id: string;
 code: string;
 points_balance: number;
 is_active: boolean;
 created_at: string;
}

const POSLoyalty: React.FC = () => {
 const { t } = useTranslation();
 const { message } = App.useApp();
 const [form] = Form.useForm();

 const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
 const [cards, setCards] = useState<LoyaltyCard[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [cardModalOpen, setCardModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState('programs');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('pos_loyalty.hiddenCols') || '[]'); } catch { return []; }
 });

 useEffect(() => {
 loadPrograms();
 }, []);

 useEffect(() => {
 if (activeTab === 'cards') {
 loadCards();
 }
 }, [activeTab]);

 const loadPrograms = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/pos/loyalty/programs');
 setPrograms(res.data.items || []);
 } catch (_error) {
 message.error(t('error_loading'));
 } finally {
 setLoading(false);
 }
 };

 const loadCards = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/pos/loyalty/cards');
 setCards(res.data.items || []);
 } catch (_error) {
 message.error(t('error_loading'));
 } finally {
 setLoading(false);
 }
 };

 const handleAdd = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({
 program_type: 'loyalty',
 point_ratio: 1,
 min_amount: 0,
 applies_on: 'current',
 is_active: true,
 });
 setModalOpen(true);
 };

 const handleEdit = (record: LoyaltyProgram) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 date_from: record.date_from ? dayjs(record.date_from) : undefined,
 date_to: record.date_to ? dayjs(record.date_to) : undefined,
 });
 setModalOpen(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: LoyaltyProgram) => {
 setEditingId(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({
 ...rest,
 name: `${record.name ?? ''} (${t('copy', 'copy')})`,
 date_from: record.date_from ? dayjs(record.date_from) : undefined,
 date_to: record.date_to ? dayjs(record.date_to) : undefined,
 });
 setModalOpen(true);
 };

 const handleSubmit = async () => {
 try {
 const values = await form.validateFields();
 const data = {
 ...values,
 date_from: values.date_from ? values.date_from.toISOString() : undefined,
 date_to: values.date_to ? values.date_to.toISOString() : undefined,
 };

 if (editingId) {
 await api.put(`/api/pos/loyalty/programs/${editingId}`, data);
 message.success(t('updated_successfully'));
 } else {
 await api.post('/api/pos/loyalty/programs', data);
 message.success(t('created_successfully'));
 }
 setModalOpen(false);
 loadPrograms();
 } catch (_error) {
 message.error(t('error_saving'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('confirm_delete'),
 content: t('confirm_delete_program'),
 onOk: async () => {
 try {
 await api.delete(`/api/pos/loyalty/programs/${id}`);
 message.success(t('deleted_successfully'));
 loadPrograms();
 } catch (_error) {
 message.error(t('error_deleting'));
 }
 },
 });
 };

 const handleIssueCard = () => {
 setCardModalOpen(true);
 };

 const programColumns = [
 {
 title: t('name'),
 dataIndex: 'name',
 key: 'name',
 render: (_: any, record: LoyaltyProgram) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(record.name)}</span>
 <div>
 <div style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{record.name}</div>
 {record.name_ku && <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{record.name_ku}</div>}
 </div>
 </div>
 ),
 },
 {
 title: t('type'),
 dataIndex: 'program_type',
 key: 'program_type',
 render: (type: string) => (
 <StatusTag status={PROGRAM_TYPE_KIND[type] ?? 'default'} label={t(`loyalty_type_${type}`)} />
 ),
 },
 {
 title: t('point_ratio'),
 dataIndex: 'point_ratio',
 key: 'point_ratio',
 render: (val: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600 }}>
 {`${val} pts / 1000 ${t('currency')}`}
 </span>
 ),
 },
 {
 title: t('min_amount'),
 dataIndex: 'min_amount',
 key: 'min_amount',
 render: (val: number) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600 }}>
 {val.toLocaleString()}
 </span>
 ),
 },
 {
 title: t('valid_period'),
 key: 'period',
 render: (_: any, record: LoyaltyProgram) => {
 if (!record.date_from && !record.date_to) return t('always');
 const from = record.date_from ? dayjs(record.date_from).format('YYYY-MM-DD') : '∞';
 const to = record.date_to ? dayjs(record.date_to).format('YYYY-MM-DD') : '∞';
 return <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{`${from} — ${to}`}</span>;
 },
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (val: boolean) => (
 <StatusTag status={val ? 'active' : 'inactive'} label={val ? t('active') : t('inactive')} />
 ),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: LoyaltyProgram) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];

 const cardColumns = [
 {
 title: t('code'),
 dataIndex: 'code',
 key: 'code',
 render: (code: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{code}</span>
 ),
 },
 {
 title: t('program'),
 dataIndex: 'program_id',
 key: 'program_id',
 render: (pid: string) => {
 const prog = programs.find((p) => p.id === pid);
 return prog ? prog.name : pid;
 },
 },
 {
 title: t('partner'),
 dataIndex: 'partner_id',
 key: 'partner_id',
 },
 {
 title: t('points_balance'),
 dataIndex: 'points_balance',
 key: 'points_balance',
 render: (val: number) => <StatusTag status="info" label={val.toFixed(2)} />,
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (val: boolean) => (
 <StatusTag status={val ? 'active' : 'inactive'} label={val ? t('active') : t('inactive')} />
 ),
 },
 {
 title: t('created_at'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (val: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>
 {dayjs(val).format('YYYY-MM-DD HH:mm')}
 </span>
 ),
 },
 ];

 // Kit list tabs — the page's natural top-level segments (programs vs issued cards).
 const tabs: KitListTab[] = [
 { key: 'programs', label: t('programs') },
 { key: 'cards', label: t('loyalty_cards') },
 ];

 const isCards = activeTab === 'cards';
 const activeColumns = isCards ? cardColumns : programColumns;
 const activeData: any[] = isCards ? cards : programs;
 const filteredData = useMemo(() => {
 if (!search) return activeData;
 const q = search.toLowerCase();
 return activeData.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }, [activeData, search]);

 // Column show/hide meta for the active tab (exclude the actions column).
 const columnsMeta: ColumnVisibilityItem[] = activeColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' && c.title ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'code' || c.key === 'actions',
 }));
 const visibleColumns = useMemo(
 () => activeColumns.filter((c) => !hiddenCols.includes(c.key)),
 [activeColumns, hiddenCols],
 );
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('pos_loyalty.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div style={{ padding: 24 }}>
 <PageHeader
 title={t('loyalty_programs')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
 {t('add_program')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={activeTab}
 onTabChange={setActiveTab}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => { setSearch(v); }}
 placeholder={t('search')}
 />
 {isCards && (
 <Button icon={<GiftOutlined />} onClick={handleIssueCard}>
 {t('issue_card')}
 </Button>
 )}
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv(isCards ? 'loyalty_cards' : 'loyalty_programs', activeData, cols);
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
 columns={visibleColumns}
 dataSource={filteredData}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </KitListCard>

 <FormDialog
 title={editingId ? t('edit_program') : t('add_program')}
 open={modalOpen}
 onOk={handleSubmit}
 onClose={() => setModalOpen(false)}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="name_ku" label={t('name_ku')}>
 <Input />
 </Form.Item>
 <Form.Item name="program_type" label={t('type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="loyalty">{t('loyalty_type_loyalty')}</Select.Option>
 <Select.Option value="coupons">{t('loyalty_type_coupons')}</Select.Option>
 <Select.Option value="gift_card">{t('loyalty_type_gift_card')}</Select.Option>
 <Select.Option value="ewallet">{t('loyalty_type_ewallet')}</Select.Option>
 <Select.Option value="promotion">{t('loyalty_type_promotion')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="point_ratio" label={t('point_ratio')} rules={[{ required: true }]}>
 <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="pts / 1000 IQD" />
 </Form.Item>
 <Form.Item name="min_amount" label={t('min_amount')}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="date_from" label={t('valid_from')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="date_to" label={t('valid_to')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="applies_on" label={t('applies_on')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="current">{t('current_order')}</Select.Option>
 <Select.Option value="future">{t('future_orders')}</Select.Option>
 <Select.Option value="both">{t('both')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="is_active" label={t('active')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('issue_loyalty_card')}
 open={cardModalOpen}
 onOk={async () => {
 // Simple form for issuing a card
 message.info(t('feature_coming_soon'));
 setCardModalOpen(false);
 }}
 onCancel={() => setCardModalOpen(false)}
 >
 <p>{t('issue_card_description')}</p>
 </FormDialog>
 </div>
 );
};

export default POSLoyalty;
