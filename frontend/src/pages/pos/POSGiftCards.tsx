import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Tag, Form, Input, InputNumber, App, DatePicker, Modal } from 'antd';
import { PlusOutlined, GiftOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader, StatusTag, KeyValueGrid, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../../design-system';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface GiftCard {
 id: string;
 code: string;
 initial_value: number;
 current_value: number;
 partner_id?: string;
 expiration_date?: string;
 is_active: boolean;
 batch_id?: string;
 activated_at?: string;
 created_at: string;
}

const POSGiftCards: React.FC = () => {
 const { t } = useTranslation();
 const { message } = App.useApp();
 const [form] = Form.useForm();
 
 const [cards, setCards] = useState<GiftCard[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [batchModalOpen, setBatchModalOpen] = useState(false);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [selectedCard, setSelectedCard] = useState<GiftCard | null>(null);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('posGiftCards.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 useEffect(() => {
 loadCards();
 }, []);

 const loadCards = async () => {
 setLoading(true);
 try {
 // Get all gift cards - we'll need to fetch them via search or dedicated endpoint
 // For now, using a placeholder approach
 const _res = await api.get('/api/pos/gift-cards/PLACEHOLDER');
 // This will fail but shows the structure
 setCards([]);
 } catch (_error) {
 // Expected to fail - we need a list endpoint
 setCards([]);
 } finally {
 setLoading(false);
 }
 };

 const handleIssueSingle = () => {
 form.resetFields();
 form.setFieldsValue({ initial_value: 50000 });
 setModalOpen(true);
 };

 const handleIssueBatch = () => {
 form.resetFields();
 form.setFieldsValue({ initial_value: 50000, batch_count: 10 });
 setBatchModalOpen(true);
 };

 const handleSubmitSingle = async () => {
 try {
 const values = await form.validateFields();
 const data = {
 ...values,
 expiration_date: values.expiration_date ? values.expiration_date.toISOString() : undefined,
 batch_count: 1,
 };
 
 const _res = await api.post('/api/pos/gift-cards', data);
 message.success(t('gift_card_created'));
 setModalOpen(false);
 loadCards();
 } catch (_error) {
 message.error(t('error_saving'));
 }
 };

 const handleSubmitBatch = async () => {
 try {
 const values = await form.validateFields();
 const data = {
 ...values,
 expiration_date: values.expiration_date ? values.expiration_date.toISOString() : undefined,
 };
 
 const res = await api.post('/api/pos/gift-cards', data);
 const count = res.data.count || 0;
 message.success(t('gift_cards_created', { count }));
 setBatchModalOpen(false);
 loadCards();
 } catch (_error) {
 message.error(t('error_saving'));
 }
 };

 const handleActivate = async (card: GiftCard) => {
 Modal.confirm({
 title: t('activate_gift_card'),
 content: t('activate_gift_card_confirm', { code: card.code }),
 onOk: async () => {
 try {
 await api.post(`/api/pos/gift-cards/${card.code}/activate`);
 message.success(t('gift_card_activated'));
 loadCards();
 } catch (_error) {
 message.error(t('error_activating'));
 }
 },
 });
 };

 const handleViewDetails = (card: GiftCard) => {
 setSelectedCard(card);
 setDrawerOpen(true);
 };

 const columns = [
 {
 title: t('code'),
 dataIndex: 'code',
 key: 'code',
 render: (code: string) => (
 <Space>
 <BarcodeOutlined />
 <code style={{ fontSize: 14, fontWeight: 'bold' }}>{code}</code>
 </Space>
 ),
 },
 {
 title: t('initial_value'),
 dataIndex: 'initial_value',
 key: 'initial_value',
 render: (val: number) => `${val.toLocaleString()} ${t('currency')}`,
 },
 {
 title: t('current_balance'),
 dataIndex: 'current_value',
 key: 'current_value',
 render: (val: number) => (
 <StatusTag status={val > 0 ? 'active' : 'default'} label={`${val.toLocaleString()} ${t('currency')}`} />
 ),
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (val: boolean, record: GiftCard) => {
 if (!val) return <StatusTag status="default" label={t('not_activated')} />;
 if (record.expiration_date && new Date(record.expiration_date) < new Date()) {
 return <StatusTag status="error" label={t('expired')} />;
 }
 return <StatusTag status="active" label={t('active')} />;
 },
 },
 {
 title: t('batch'),
 dataIndex: 'batch_id',
 key: 'batch_id',
 render: (batch?: string) => batch ? <Tag>{batch.slice(0, 8)}</Tag> : '-',
 },
 {
 title: t('expiration'),
 dataIndex: 'expiration_date',
 key: 'expiration_date',
 render: (date?: string) => date ? dayjs(date).format('YYYY-MM-DD') : t('no_expiration'),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: GiftCard) => (
 <Space>
 {!record.is_active && (
 <Button type="primary" onClick={() => handleActivate(record)}>
 {t('activate')}
 </Button>
 )}
 <Button onClick={() => handleViewDetails(record)}>
 {t('view')}
 </Button>
 </Space>
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'code' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('posGiftCards.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div style={{ padding: 24 }}>
 <PageHeader
 title={t('gift_cards')}
 extra={
 <Space>
 <Button icon={<PlusOutlined />} onClick={handleIssueSingle}>
 {t('issue_single_card')}
 </Button>
 <Button type="primary" icon={<GiftOutlined />} onClick={handleIssueBatch}>
 {t('issue_batch')}
 </Button>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('pos-gift-cards', cards, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </Space>
 }
 />

 <ResponsiveTableAdapter
 columns={visibleColumns}
 dataSource={cards}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />

 <FormDialog
 title={t('issue_single_gift_card')}
 open={modalOpen}
 onOk={handleSubmitSingle}
 onClose={() => setModalOpen(false)}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="initial_value" label={t('value')} rules={[{ required: true }]}>
 <InputNumber
 min={1000}
 max={10000000}
 step={1000}
 style={{ width: '100%' }}
 formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
 />
 </Form.Item>
 <Form.Item name="partner_id" label={t('partner_id')}>
 <Input placeholder={t('optional')} />
 </Form.Item>
 <Form.Item name="expiration_date" label={t('expiration_date')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('issue_batch_gift_cards')}
 open={batchModalOpen}
 onOk={handleSubmitBatch}
 onClose={() => setBatchModalOpen(false)}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="batch_count" label={t('quantity')} rules={[{ required: true }]}>
 <InputNumber min={1} max={1000} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="initial_value" label={t('value_per_card')} rules={[{ required: true }]}>
 <InputNumber
 min={1000}
 max={10000000}
 step={1000}
 style={{ width: '100%' }}
 formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
 />
 </Form.Item>
 <Form.Item name="expiration_date" label={t('expiration_date')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('gift_card_details')}
 open={drawerOpen}
 onClose={() => setDrawerOpen(false)}
 >
 {selectedCard && (
 <KeyValueGrid
 columns={1}
 items={[
 { label: t('code'), value: <code>{selectedCard.code}</code> },
 { label: t('initial_value'), value: `${selectedCard.initial_value.toLocaleString()} ${t('currency')}` },
 { label: t('current_balance'), value: `${selectedCard.current_value.toLocaleString()} ${t('currency')}` },
 { label: t('status'), value: <StatusTag status={selectedCard.is_active ? 'active' : 'default'} label={selectedCard.is_active ? t('active') : t('not_activated')} /> },
 ...(selectedCard.activated_at ? [{ label: t('activated_at'), value: dayjs(selectedCard.activated_at).format('YYYY-MM-DD HH:mm') }] : []),
 ...(selectedCard.expiration_date ? [{ label: t('expires'), value: dayjs(selectedCard.expiration_date).format('YYYY-MM-DD') }] : []),
 { label: t('created_at'), value: dayjs(selectedCard.created_at).format('YYYY-MM-DD HH:mm') },
 ]}
 />
 )}
 </FormDialog>
 </div>
 );
};

export default POSGiftCards;
