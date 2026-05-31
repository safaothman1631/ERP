import React, { useEffect, useMemo, useState } from 'react';
import { Button, Tag, Space, Select, Form, InputNumber, Input, Typography, Dropdown } from 'antd';

import { message } from '../utils/message';
import { PlusOutlined, SendOutlined, WalletOutlined, DollarOutlined, InboxOutlined, FilePdfOutlined, MailOutlined, BellOutlined, QrcodeOutlined, CloudUploadOutlined, InfoCircleOutlined, MoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ExportButton from '../components/ExportButton';
import ChatterPanel from '../components/ChatterPanel';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import { PageHeader, StatusTag, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { palette, space } from '../theme/tokens';
import { useAuthStore } from '../store';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { useAddGate } from '../components/AddGate/useAddGate';
import { EmptyState } from '../components/AddGate/EmptyState';
import { asTranslationKey } from '../i18n/types';

const { Text } = Typography;

const noWrap: React.CSSProperties = { whiteSpace: 'nowrap' };

const Invoices: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [page, setPage] = useState(1);
 const [statusFilter, setStatusFilter] = useState('');
 const [retainerModal, setRetainerModal] = useState(false);
 const [retainerForm] = Form.useForm();
 const [retainerSaving, setRetainerSaving] = useState(false);
 const [applyRetainerModal, setApplyRetainerModal] = useState<string | null>(null);
 const [applyRetainerForm] = Form.useForm();
 const [retainerInvoices, setRetainerInvoices] = useState<any[]>([]);
 const [applyingSaving, setApplyingSaving] = useState(false);
 const [emailModal, setEmailModal] = useState<string | null>(null);
 const [emailForm] = Form.useForm();
 const [emailSending, setEmailSending] = useState(false);
 const [einvoiceLoadingKey, setEInvoiceLoadingKey] = useState<string | null>(null);
 const [einvoiceModal, setEInvoiceModal] = useState<{ title: string; data: Record<string, unknown> | null }>({ title: '', data: null });
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('invoices.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');
 const [chatterDrawer, setChatterDrawer] = useState<string | null>(null);

 // AddGate: wire Selective Add for invoices section (R9.1, R9.5)
 const addGate = useAddGate('sales.invoices');
 const invoicesQuery = useListQuery<any, { items?: any[]; total?: number }>({
 queryKey: listQueryKeys.invoices({ page, status: statusFilter, page_size: 20 }),
 queryFn: () => api.get('/api/invoices', { params: { page, status: statusFilter, page_size: 20 } }),
 });
 const data = invoicesQuery.data?.items ?? [];
 const total = invoicesQuery.data?.total ?? 0;
 const loading = invoicesQuery.isLoading || invoicesQuery.isFetching;

 // Sync record count into AddGate store (R9.5, R9.6)
 useEffect(() => { addGate.setRecordCount(total); }, [total, addGate.setRecordCount]);

 const handleSend = async (id: string) => {
 try {
 const res = await api.post(`/api/invoices/${id}/send`);
 if (res.data?.einvoice?.status) {
 message.success(`${t('success')} - ${t('einvoice_submitted')}`);
 } else {
 message.success(t('success'));
 }
 void invoicesQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const handleEInvoiceAction = async (id: string, action: 'submit' | 'status' | 'qr') => {
 const loadingKey = `${action}:${id}`;
 setEInvoiceLoadingKey(loadingKey);
 try {
 const res = action === 'submit'
 ? await api.post(`/api/einvoice/submit/${id}`)
 : action === 'status'
 ? await api.get(`/api/einvoice/status/${id}`)
 : await api.get(`/api/einvoice/qr/${id}`);

 setEInvoiceModal({
 title: action === 'qr' ? t('qr_code') : action === 'status' ? t('einvoice_status') : t('einvoice_submit'),
 data: res.data as Record<string, unknown>,
 });
 if (action !== 'qr') {
 void invoicesQuery.refetch();
 }
 } catch {
 message.error(t('error'));
 } finally {
 setEInvoiceLoadingKey(null);
 }
 };

 const handleCreateRetainer = async (values: any) => {
 setRetainerSaving(true);
 try {
 await api.post('/api/invoices/retainer', values);
 message.success(t('success'));
 setRetainerModal(false);
 void invoicesQuery.refetch();
 } catch { message.error(t('error')); } finally { setRetainerSaving(false); }
 };

 const openApplyRetainer = async (invoiceId: string) => {
 try {
 const r = await api.get('/api/invoices', { params: { status: 'retainer', page_size: 100 } });
 setRetainerInvoices(r.data.items || []);
 setApplyRetainerModal(invoiceId);
 applyRetainerForm.resetFields();
 } catch { message.error(t('error')); }
 };

 const handleApplyRetainer = async (values: any) => {
 if (!applyRetainerModal) return;
 setApplyingSaving(true);
 try {
 await api.post(`/api/invoices/${applyRetainerModal}/apply-retainer`, {
 retainer_invoice_id: values.retainer_invoice_id,
 amount: values.amount,
 });
 message.success(t('success'));
 setApplyRetainerModal(null);
 void invoicesQuery.refetch();
 } catch { message.error(t('error')); } finally { setApplyingSaving(false); }
 };

 const handleDownloadPdf = async (id: string) => {
 try {
 const res = await api.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' });
 const url = window.URL.createObjectURL(new Blob([res.data]));
 const link = document.createElement('a');
 link.href = url;
 link.download = `invoice-${id}.pdf`;
 link.click();
 window.URL.revokeObjectURL(url);
 } catch { message.error(t('error')); }
 };

 const openEmailModal = (id: string) => {
 emailForm.resetFields();
 setEmailModal(id);
 };

 const handleSendEmail = async (values: { to_email: string; subject: string; message: string }) => {
 if (!emailModal) return;
 setEmailSending(true);
 try {
 await api.post(`/api/invoices/${emailModal}/send`, values);
 message.success(t('email_sent'));
 setEmailModal(null);
 } catch { message.error(t('error')); } finally { setEmailSending(false); }
 };

 const handleSendReminder = async (id: string) => {
 try {
 await api.post(`/api/invoices/${id}/send-reminder`);
 message.success(t('reminder_sent'));
 void invoicesQuery.refetch();
 } catch { message.error(t('error')); }
 };

 const columns: any[] = [
 {
 title: '#',
 dataIndex: 'invoice_number',
 key: 'invoice_number',
 width: 132,
 ellipsis: true,
 render: (v: string) => <Text strong style={{ color: palette.primary500, ...noWrap }}>{v || '-'}</Text>,
 },
 { title: t('date'), dataIndex: 'date', key: 'date', width: 122, render: (d: string) => <span style={noWrap}>{d ? formatDate(d) : '-'}</span> },
 { title: t('due_date'), dataIndex: 'due_date', key: 'due_date', width: 122, render: (d: string) => <span style={noWrap}>{d ? formatDate(d) : '-'}</span> },
 {
 title: t('total'),
 dataIndex: 'total',
 key: 'total',
 width: 154,
 align: 'right',
 render: (v: number, r: any) => <Text strong style={noWrap}>{formatCurrency(Number(v || 0), r.currency_code || 'IQD')}</Text>,
 },
 {
 title: t('balance_due'),
 dataIndex: 'balance_due',
 key: 'balance_due',
 width: 154,
 align: 'right',
 render: (v: number, r: any) => <Text strong style={{ color: v > 0 ? palette.danger : palette.success, ...noWrap }}>{formatCurrency(Number(v || 0), r.currency_code || 'IQD')}</Text>,
 },
 {
 title: t('status'), dataIndex: 'status', key: 'status',
 width: 180,
 render: (s: string, r: any) => (
 <Space wrap style={{ minWidth: 0 }}>
 <StatusTag status={s} label={t(s)} />
 {r.is_retainer && <Tag color="purple" style={{ borderRadius: 6 }}>{t('retainerInvoice')}</Tag>}
 {r.is_progress && <Tag color="cyan" style={{ borderRadius: 6 }}>{t('progressInvoice')}</Tag>}
 </Space>
 ),
 },
 {
 title: t('actions'), key: 'actions',
 width: 220,
 fixed: 'right',
 render: (_: any, r: any) => {
 const menuItems: { key: string; label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[] = [];
 if (!r.is_retainer && r.status !== 'paid' && r.status !== 'void') {
 menuItems.push({ key: 'retainer', icon: <WalletOutlined />, label: t('applyToInvoice'), onClick: () => openApplyRetainer(r.id) });
 }
 if (r.status !== 'void') {
 menuItems.push(
 { key: 'einvoice-submit', icon: <CloudUploadOutlined />, label: t('einvoice_submit'), disabled: !!einvoiceLoadingKey, onClick: () => handleEInvoiceAction(r.id, 'submit') },
 { key: 'einvoice-status', icon: <InfoCircleOutlined />, label: t('einvoice_status'), disabled: !!einvoiceLoadingKey, onClick: () => handleEInvoiceAction(r.id, 'status') },
 { key: 'qr', icon: <QrcodeOutlined />, label: t('qr_code'), disabled: !!einvoiceLoadingKey, onClick: () => handleEInvoiceAction(r.id, 'qr') },
 );
 }
 menuItems.push(
 { key: 'pdf', icon: <FilePdfOutlined />, label: 'PDF', onClick: () => handleDownloadPdf(r.id) },
 { key: 'email', icon: <MailOutlined />, label: t('send_email'), onClick: () => openEmailModal(r.id) },
 );
 if (r.status === 'overdue') {
 menuItems.push({ key: 'reminder', icon: <BellOutlined />, label: t('send_reminder'), danger: true, onClick: () => handleSendReminder(r.id) });
 }

 return (
 <Space wrap={false} style={noWrap}>
 {r.status === 'draft' && <Button icon={<SendOutlined />} onClick={() => handleSend(r.id)}>{t('send')}</Button>}
 <Dropdown menu={{ items: menuItems }} trigger={['click']}>
 <Button icon={<MoreOutlined />}>{t('more', 'More')}</Button>
 </Dropdown>
 </Space>
 );
 },
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'invoice_number' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('invoices.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div data-addgate-section="sales.invoices">
 <PageHeader
 title={t('invoices')}
 subtitle={t('invoices_subtitle', 'Track invoices, balances, and customer payments')}
 helpKey="invoices"
 sectionId="sales.invoices"
 extra={
 <Space>
 <ExportButton endpoint="/api/export/invoices" filename="invoices" params={{ status: statusFilter || undefined }} />
 <Button icon={<DollarOutlined />} onClick={() => { retainerForm.resetFields(); setRetainerModal(true); }}>
 {t('retainerInvoice')}
 </Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/invoices/new')} data-add-action="sales.invoices">
 {t('new_invoice')}
 </Button>
 </Space>
 }
 />
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: space.md, alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
 <Select
 placeholder={t('status')}
 value={statusFilter || undefined}
 onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
 allowClear
 style={{ width: 200 }}
 >
 <Select.Option value="draft">{t('draft')}</Select.Option>
 <Select.Option value="sent">{t('sent')}</Select.Option>
 <Select.Option value="paid">{t('paid')}</Select.Option>
 <Select.Option value="overdue">{t('overdue')}</Select.Option>
 </Select>
 <Space>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('invoices', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </Space>
 </div>

 <ResponsiveTableAdapter
 dataSource={data}
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 tableLayout="fixed"
 scroll={{ x: 1120 }}
 onRow={(record) => ({
 onClick: () => setChatterDrawer(record.id),
 style: { cursor: 'pointer' },
 })}
 pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
 locale={{
 emptyText: (
 <EmptyState
 illustration={<InboxOutlined style={{ fontSize: 32 }} />}
 titleKey={asTranslationKey('addGate.section.invoices.title')}
 descriptionKey={asTranslationKey('addGate.section.invoices.description')}
 ctaKey={asTranslationKey('addGate.section.invoices.cta')}
 onCta={() => navigate('/invoices/new')}
 mandatory={addGate.mode === 'mandatory'}
 />
 ),
 }}
 />

 <FormDialog open={retainerModal} onClose={() => setRetainerModal(false)} title={t('retainerInvoice')} hideFooter>
 <Form form={retainerForm} layout="vertical" onFinish={handleCreateRetainer}>
 <Form.Item label={t('amount')} name="amount" rules={[{ required: true, message: t('required_amount') }]}>
 <InputNumber min={0} style={{ width: '100%' }} placeholder={t('placeholder_amount')} />
 </Form.Item>
 <Form.Item label={t('customer')} name="contact_id" rules={[{ required: true, message: t('required_contact') }]}>
 <Select placeholder={t('placeholder_customer')} />
 </Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={retainerSaving}>{t('save')}</Button>
 <Button onClick={() => setRetainerModal(false)}>{t('cancel')}</Button>
 </Space>
 </Form>
 </FormDialog>

 <FormDialog open={!!applyRetainerModal} onClose={() => setApplyRetainerModal(null)} title={t('retainerInvoice')} hideFooter>
 <Form form={applyRetainerForm} layout="vertical" onFinish={handleApplyRetainer}>
 <Form.Item label={t('retainerInvoice')} name="retainer_invoice_id" rules={[{ required: true, message: t('required_field') }]}>
 <Select placeholder={t('placeholder_select')} options={retainerInvoices.map((ri: any) => ({ label: `${ri.invoice_number} - ${formatCurrency(Number(ri.balance_due || 0), ri.currency_code || 'IQD')}`, value: ri.id }))} />
 </Form.Item>
 <Form.Item label={t('amount')} name="amount" rules={[{ required: true, message: t('required_amount') }]}>
 <InputNumber min={0} style={{ width: '100%' }} placeholder={t('placeholder_amount')} />
 </Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={applyingSaving}>{t('confirm')}</Button>
 <Button onClick={() => setApplyRetainerModal(null)}>{t('cancel')}</Button>
 </Space>
 </Form>
 </FormDialog>

 <FormDialog open={!!emailModal} onClose={() => setEmailModal(null)} title={t('send_email')} hideFooter>
 <Form form={emailForm} layout="vertical" onFinish={handleSendEmail}>
 <Form.Item label={t('to_email', 'To email')} name="to_email" rules={[{ required: true, message: t('required_email') }, { type: 'email', message: t('invalid_email') }]}><Input placeholder={t('placeholder_email')} /></Form.Item>
 <Form.Item label={t('subject', 'Subject')} name="subject"><Input placeholder={t('placeholder_subject')} /></Form.Item>
 <Form.Item label={t('message', 'Message')} name="message"><Input.TextArea rows={3} placeholder={t('placeholder_message')} /></Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={emailSending} icon={<MailOutlined />}>{t('send')}</Button>
 <Button onClick={() => setEmailModal(null)}>{t('cancel')}</Button>
 </Space>
 </Form>
 </FormDialog>

 <FormDialog
 open={!!einvoiceModal.data}
 onClose={() => setEInvoiceModal({ title: '', data: null })}
 title={einvoiceModal.title} hideFooter
 >
 <Space orientation="vertical" style={{ width: '100%' }}>
 {typeof einvoiceModal.data?.qr_data_url === 'string' && (
 <div style={{ textAlign: 'center' }}>
 <img src={einvoiceModal.data.qr_data_url as string} alt="QR" loading="lazy" decoding="async" style={{ maxWidth: 220, width: '100%' }} />
 </div>
 )}
 <Text><strong>{t('fiscal_id')}:</strong> {String(einvoiceModal.data?.fiscal_id || '-')}</Text>
 <Text><strong>{t('status')}:</strong> {String(einvoiceModal.data?.status || '-')}</Text>
 <Text><strong>{t('provider_uuid')}:</strong> {String(einvoiceModal.data?.provider_uuid || '-')}</Text>
 <Text><strong>{t('error')}:</strong> {String(einvoiceModal.data?.error_message || '-')}</Text>
 <Text><strong>{t('einvoice_payload')}:</strong> {String(einvoiceModal.data?.qr_payload || '-')}</Text>
 </Space>
 </FormDialog>

 <FormDialog
 title={t('chatter.activities')}
 open={!!chatterDrawer}
 onClose={() => setChatterDrawer(null)}
 >
 {chatterDrawer && <ChatterPanel entityType="invoice" entityId={chatterDrawer} />}
 </FormDialog>
 </div>
 );
};

export default Invoices;
