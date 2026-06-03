import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Form, Input, Select, message, Steps, Avatar, Tooltip, Checkbox, Modal, Radio } from 'antd';
import { PlusOutlined, FileTextOutlined, UserOutlined, EyeOutlined, BellOutlined, CloseCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import type { StatusKind } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { space } from '../../theme/tokens';
import { downloadCsv } from '../../utils/exportCsv';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { ComingSoon } from '../../components/feedback/ComingSoon';

const { TextArea } = Input;

const SignatureRequests: React.FC = () => {
 const { t } = useTranslation();
 const [sentRequests, setSentRequests] = useState<any[]>([]);
 const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [newRequestDrawerOpen, setNewRequestDrawerOpen] = useState(false);
 const [signDrawerOpen, setSignDrawerOpen] = useState(false);
 const [selectedRequest, setSelectedRequest] = useState<any>(null);
 const [files, setFiles] = useState<any[]>([]);
 const [_signForm] = Form.useForm();
 const [requestForm] = Form.useForm();
 const [currentStep, setCurrentStep] = useState(0);
 const [tab, setTab] = useState<'sent' | 'received' | 'templates'>('sent');
 const [statusFilter, setStatusFilter] = useState('');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('signature_requests.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchRequests = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/documents/sign-requests');
 const allRequests = res.data.items || [];
 // Split sent vs received based on created_by
 const userId = localStorage.getItem('userId') || localStorage.getItem('userEmail');
 setSentRequests(allRequests.filter((r: any) => r.created_by === userId));
 setReceivedRequests(allRequests.filter((r: any) => r.created_by !== userId));
 } catch (_error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchFiles = async () => {
 try {
 const res = await api.get('/api/documents/files', { params: { limit: 100 } });
 setFiles(res.data.items || []);
 } catch { /* noop */ }
 };

 useEffect(() => {
 void fetchRequests();
 void fetchFiles();
 }, []);

 const handleCreateRequest = async (values: any) => {
 try {
 const signers = values.signers.map((email: string, index: number) => ({
 email,
 role: values[`role_${index}`] || 'signer',
 order: values.sequential ? index + 1 : 0,
 }));
 await api.post('/api/documents/sign-requests', {
 file_id: values.file_id,
 signers,
 message: values.message,
 expires_in_days: values.expires_in_days || 14,
 });
 message.success(t('dms.signature_request_sent'));
 setNewRequestDrawerOpen(false);
 requestForm.resetFields();
 setCurrentStep(0);
 void fetchRequests();
 } catch {
 message.error(t('error'));
 }
 };

 const handleSign = async () => {
 if (!selectedRequest) return;
 try {
 await api.post('/api/documents/signatures', {
 sign_request_id: selectedRequest.id,
 signer_email: localStorage.getItem('userEmail') || 'user@example.com',
 signature_data_url: 'data:image/png;base64,placeholder',
 });
 message.success(t('dms.document_signed'));
 setSignDrawerOpen(false);
 setSelectedRequest(null);
 void fetchRequests();
 } catch {
 message.error(t('error'));
 }
 };

 const handleCancel = async (requestId: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.post(`/api/documents/sign-requests/${requestId}/cancel`);
 message.success(t('dms.request_cancelled'));
 void fetchRequests();
 },
 });
 };

 const handleRemind = (_requestId: string) => {
 message.info(t('dms.reminder_coming_soon'));
 };

 const handleView = async (requestId: string) => {
 try {
 const res = await api.get(`/api/documents/sign-requests/${requestId}`);
 setSelectedRequest(res.data);
 setSignDrawerOpen(true);
 } catch {
 message.error(t('error'));
 }
 };

 const getStatusTag = (status: string) => {
 const statusMap: Record<string, { kind: StatusKind; label: string }> = {
 pending: { kind: 'info', label: t('dms.status_pending') },
 completed: { kind: 'success', label: t('dms.status_signed') },
 cancelled: { kind: 'default', label: t('dms.status_cancelled') },
 declined: { kind: 'error', label: t('dms.status_declined') },
 };
 const config = statusMap[status] || statusMap.pending;
 return <StatusTag status={config.kind} label={config.label} />;
 };

 // Kit primary cell — initials circle + document name (mirrors Contacts).
 const renderDocument = (v: string) => {
 const file = files.find((f) => f.id === v);
 const name = file?.name || v;
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 12,
 }}><FileTextOutlined /></span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{name}</span>
 </div>
 );
 };

 const sentColumns = [
 {
 title: t('dms.document'),
 dataIndex: 'file_id',
 key: 'file_id',
 render: renderDocument,
 },
 {
 title: t('dms.signers'),
 dataIndex: 'signers',
 key: 'signers',
 render: (signers: any[]) => (
 <Avatar.Group maxCount={3}>
 {(signers || []).map((s: any, i: number) => (
 <Tooltip key={i} title={s.email}>
 <Avatar icon={<UserOutlined />} />
 </Tooltip>
 ))}
 </Avatar.Group>
 ),
 },
 { title: t('status'), dataIndex: 'status', key: 'status', render: getStatusTag },
 {
 title: t('dms.sent_at'), dataIndex: 'created_at', key: 'created_at',
 render: (v: string) => <span style={{ color: 'var(--ink-500)' }}>{new Date(v).toLocaleDateString()}</span>,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('dms.view', 'View'), onClick: () => handleView(record.id) },
 ...(record.status === 'pending'
 ? [
 { key: 'remind', icon: <BellOutlined />, label: t('dms.send_reminder'), onClick: () => handleRemind(record.id) },
 { type: 'divider' as const },
 { key: 'cancel', icon: <CloseCircleOutlined />, label: t('dms.cancel'), danger: true, onClick: () => handleCancel(record.id) },
 ]
 : []),
 ]}
 />
 ),
 },
 ];

 const receivedColumns = [
 {
 title: t('dms.document'),
 dataIndex: 'file_id',
 key: 'file_id',
 render: renderDocument,
 },
 {
 title: t('dms.requested_by'), dataIndex: 'created_by', key: 'created_by',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 { title: t('status'), dataIndex: 'status', key: 'status', render: getStatusTag },
 {
 title: t('dms.received_at'), dataIndex: 'created_at', key: 'created_at',
 render: (v: string) => <span style={{ color: 'var(--ink-500)' }}>{new Date(v).toLocaleDateString()}</span>,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={
 record.status === 'pending'
 ? [
 {
 key: 'sign', icon: <CheckCircleOutlined />, label: t('dms.sign_now'),
 onClick: () => { setSelectedRequest(record); setSignDrawerOpen(true); },
 },
 { key: 'view', icon: <EyeOutlined />, label: t('dms.view', 'View'), onClick: () => handleView(record.id) },
 ]
 : [
 { key: 'view', icon: <EyeOutlined />, label: t('dms.view', 'View'), onClick: () => handleView(record.id) },
 ]
 }
 />
 ),
 },
 ];

 // Status options shared by both datasets (client-side display filter only — no query/endpoint change).
 const statusOptions = [
 { value: 'pending', label: t('dms.status_pending') },
 { value: 'completed', label: t('dms.status_signed') },
 { value: 'cancelled', label: t('dms.status_cancelled') },
 { value: 'declined', label: t('dms.status_declined') },
 ];

 const activeColumns = tab === 'received' ? receivedColumns : sentColumns;
 const columns = useMemo(
 () => activeColumns.filter((c) => !hiddenCols.includes(c.key)),
 [activeColumns, hiddenCols],
 );
 const columnsMeta: ColumnVisibilityItem[] = activeColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' ? c.title : c.key,
 pinned: c.key === 'file_id' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('signature_requests.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 const sourceRows = tab === 'received' ? receivedRequests : sentRequests;
 const visibleRows = statusFilter ? sourceRows.filter((r) => r.status === statusFilter) : sourceRows;
 const filteredRows = useMemo(() => {
 if (!search) return visibleRows;
 const q = search.toLowerCase();
 return visibleRows.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }, [visibleRows, search]);

 const tabs: KitListTab[] = [
 { key: 'sent', label: t('dms.sent') },
 { key: 'received', label: t('dms.received') },
 { key: 'templates', label: t('dms.templates') },
 ];

 return (
 <div>
 <PageHeader
 title={t('dms.signatures')}
 subtitle={t('dms.signatures_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { requestForm.resetFields(); setNewRequestDrawerOpen(true); }}>
 {t('dms.new_request')}
 </Button>
 }
 />

 <div style={{ marginTop: space.md }}>
 <KitListCard
 tabs={tabs}
 activeTab={tab}
 onTabChange={(k) => { setTab(k as typeof tab); setStatusFilter(''); }}
 toolbar={tab === 'templates' ? undefined : (
 <>
 <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusFilter ? 1 : 0}
 onClear={() => setStatusFilter('')}
 >
 <Radio.Group
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="">{t('all', 'All')}</Radio>
 {statusOptions.map((o) => (
 <Radio key={o.value} value={o.value}>{o.label}</Radio>
 ))}
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status', 'Status')}
 anyLabel={t('all', 'All')}
 value={statusFilter}
 onChange={(v) => setStatusFilter(v)}
 options={statusOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('signature_requests', filteredRows, cols);
 }}
 onPrint={() => window.print()}
 onImport={() => message.info(t('coming_soon', 'Coming soon'))}
 onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
 onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
 />
 </div>
 </>
 )}
 >
 {tab === 'templates' ? (
 <ComingSoon featureNameKey="dms.templates" />
 ) : (
 <ResponsiveTableAdapter
 dataSource={filteredRows}
 columns={columns}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 />
 )}
 </KitListCard>
 </div>

 {/* New Signature Request Drawer */}
 <FormDialog
 title={t('dms.new_signature_request')}
 open={newRequestDrawerOpen}
 onClose={() => { setNewRequestDrawerOpen(false); setCurrentStep(0); requestForm.resetFields(); }}
 extra={
 <Button type="primary" onClick={() => requestForm.submit()}>
 {t('dms.send')}
 </Button>
 }
 >
 <Steps
 current={currentStep}
 style={{ marginBottom: space.lg }}
 items={[
 { title: t('dms.select_document') },
 { title: t('dms.add_signers') },
 { title: t('dms.configure') },
 ]}
 />

 <Form form={requestForm} layout="vertical" onFinish={handleCreateRequest}>
 {currentStep === 0 && (
 <Form.Item name="file_id" label={t('dms.document')} rules={[{ required: true }]}>
 <Select
 showSearch
 placeholder={t('dms.select_document')}
 filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
 options={files.map((f) => ({ value: f.id, label: f.name }))}
 />
 </Form.Item>
 )}

 {currentStep === 1 && (
 <>
 <Form.Item name="signers" label={t('dms.signers')} rules={[{ required: true }]}>
 <Select mode="tags" placeholder={t('dms.enter_emails')} />
 </Form.Item>
 <Form.List name="roles">
 {(_fields) =>
 (requestForm.getFieldValue('signers') || []).map((_: any, index: number) => (
 <Form.Item key={index} name={`role_${index}`} label={t('dms.role')} initialValue="signer">
 <Select>
 <Select.Option value="signer">{t('dms.signer')}</Select.Option>
 <Select.Option value="approver">{t('dms.approver')}</Select.Option>
 <Select.Option value="witness">{t('dms.witness')}</Select.Option>
 </Select>
 </Form.Item>
 ))
 }
 </Form.List>
 </>
 )}

 {currentStep === 2 && (
 <>
 <Form.Item name="sequential" valuePropName="checked">
 <Checkbox>{t('dms.sequential')}</Checkbox>
 </Form.Item>
 <Form.Item name="message" label={t('dms.message')}>
 <TextArea rows={4} placeholder={t('dms.optional_message')} />
 </Form.Item>
 <Form.Item name="expires_in_days" label={t('dms.due_date')} initialValue={14}>
 <Select>
 <Select.Option value={7}>7 {t('dms.days')}</Select.Option>
 <Select.Option value={14}>14 {t('dms.days')}</Select.Option>
 <Select.Option value={30}>30 {t('dms.days')}</Select.Option>
 </Select>
 </Form.Item>
 </>
 )}
 </Form>

 <Space style={{ marginTop: space.lg }}>
 {currentStep > 0 && (
 <Button onClick={() => setCurrentStep(currentStep - 1)}>{t('back')}</Button>
 )}
 {currentStep < 2 && (
 <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
 {t('next')}
 </Button>
 )}
 </Space>
 </FormDialog>

 {/* Sign Document Drawer */}
 <FormDialog
 title={t('dms.sign_document')}
 open={signDrawerOpen}
 onClose={() => { setSignDrawerOpen(false); setSelectedRequest(null); }}
 >
 {selectedRequest && (
 <Space direction="vertical" style={{ width: '100%' }}>
 <div>
 <h3>{t('dms.document')}</h3>
 <p>{files.find((f) => f.id === selectedRequest.file_id)?.name || selectedRequest.file_id}</p>
 </div>

 <div>
 <h3>{t('dms.message')}</h3>
 <p>{selectedRequest.message || t('dms.no_message')}</p>
 </div>

 {/* Preview */}
 <div style={{ background: 'var(--surface-2)', padding: space.md, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
 <p>{t('dms.document_preview')}</p>
 <div style={{ height: 400, border: '1px solid var(--border)' }}>
 {/* Placeholder preview */}
 <p style={{ paddingTop: 180 }}>{t('dms.pdf_preview_here')}</p>
 </div>
 </div>

 {selectedRequest.status === 'pending' && (
 <>
 <Form.Item>
 <Checkbox>{t('dms.i_agree')}</Checkbox>
 </Form.Item>

 <Button type="primary" block icon={<CheckCircleOutlined />} onClick={handleSign}>
 {t('dms.sign')}
 </Button>
 </>
 )}

 {selectedRequest.status !== 'pending' && (
 <StatusTag status="success" label={t('dms.already_signed')} />
 )}
 </Space>
 )}
 </FormDialog>
 </div>
 );
};

export default SignatureRequests;
