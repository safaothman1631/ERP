import React, { useEffect, useState } from 'react';
import {
 Button, Space, Tabs, Tag, Form, Input, Select, message, Steps, Avatar, Tooltip, DatePicker, Checkbox, Modal } from 'antd';
import {
 PlusOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
 FileTextOutlined, UserOutlined, BellOutlined, EyeOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
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
 const [signForm] = Form.useForm();
 const [requestForm] = Form.useForm();
 const [currentStep, setCurrentStep] = useState(0);

 const fetchRequests = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/documents/sign-requests');
 const allRequests = res.data.items || [];
 // Split sent vs received based on created_by
 const userId = localStorage.getItem('userId') || localStorage.getItem('userEmail');
 setSentRequests(allRequests.filter((r: any) => r.created_by === userId));
 setReceivedRequests(allRequests.filter((r: any) => r.created_by !== userId));
 } catch (error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchFiles = async () => {
 try {
 const res = await api.get('/api/documents/files', { params: { limit: 100 } });
 setFiles(res.data.items || []);
 } catch {}
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

 const handleRemind = (requestId: string) => {
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
 const statusMap: Record<string, { color: string; label: string }> = {
 pending: { color: 'processing', label: t('dms.status_pending') },
 completed: { color: 'success', label: t('dms.status_signed') },
 cancelled: { color: 'default', label: t('dms.status_cancelled') },
 declined: { color: 'error', label: t('dms.status_declined') },
 };
 const config = statusMap[status] || statusMap.pending;
 return <Tag color={config.color}>{config.label}</Tag>;
 };

 const sentColumns = [
 {
 title: t('dms.document'),
 dataIndex: 'file_id',
 key: 'file_id',
 render: (v: string) => {
 const file = files.find((f) => f.id === v);
 return (
 <Space>
 <FileTextOutlined />
 {file?.name || v}
 </Space>
 );
 },
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
 { title: t('dms.sent_at'), dataIndex: 'created_at', key: 'created_at', render: (v: string) => new Date(v).toLocaleDateString() },
 {
 title: t('actions'),
 key: 'actions',
 width: 200,
 render: (_: any, record: any) => (
 <Space>
 <Tooltip title={t('dms.view')}>
 <Button icon={<EyeOutlined />} onClick={() => handleView(record.id)} />
 </Tooltip>
 {record.status === 'pending' && (
 <>
 <Tooltip title={t('dms.send_reminder')}>
 <Button icon={<BellOutlined />} onClick={() => handleRemind(record.id)} />
 </Tooltip>
 <Tooltip title={t('dms.cancel')}>
 <Button icon={<CloseCircleOutlined />} danger onClick={() => handleCancel(record.id)} />
 </Tooltip>
 </>
 )}
 </Space>
 ),
 },
 ];

 const receivedColumns = [
 {
 title: t('dms.document'),
 dataIndex: 'file_id',
 key: 'file_id',
 render: (v: string) => {
 const file = files.find((f) => f.id === v);
 return (
 <Space>
 <FileTextOutlined />
 {file?.name || v}
 </Space>
 );
 },
 },
 { title: t('dms.requested_by'), dataIndex: 'created_by', key: 'created_by' },
 { title: t('status'), dataIndex: 'status', key: 'status', render: getStatusTag },
 { title: t('dms.received_at'), dataIndex: 'created_at', key: 'created_at', render: (v: string) => new Date(v).toLocaleDateString() },
 {
 title: t('actions'),
 key: 'actions',
 width: 150,
 render: (_: any, record: any) => (
 <Space>
 {record.status === 'pending' && (
 <Button
 type="primary"
 icon={<CheckCircleOutlined />}
 onClick={() => {
 setSelectedRequest(record);
 setSignDrawerOpen(true);
 }}
 >
 {t('dms.sign_now')}
 </Button>
 )}
 {record.status !== 'pending' && (
 <Button icon={<EyeOutlined />} onClick={() => handleView(record.id)}>
 {t('dms.view')}
 </Button>
 )}
 </Space>
 ),
 },
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
 <Tabs
 items={[
 {
 key: 'sent',
 label: t('dms.sent'),
 children: <ResponsiveTableAdapter dataSource={sentRequests} columns={sentColumns} loading={loading} rowKey="id" pagination={{ pageSize: 20 }} />,
 },
 {
 key: 'received',
 label: t('dms.received'),
 children: <ResponsiveTableAdapter dataSource={receivedRequests} columns={receivedColumns} loading={loading} rowKey="id" pagination={{ pageSize: 20 }} />,
 },
 {
 key: 'templates',
 label: t('dms.templates'),
 children: <ComingSoon featureNameKey="dms.templates" />,
 },
 ]}
 />
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
 {(fields) =>
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
 <div style={{ background: '#fafafa', padding: space.md, borderRadius: 8, textAlign: 'center' }}>
 <p>{t('dms.document_preview')}</p>
 <div style={{ height: 400, border: '1px solid #d9d9d9' }}>
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
 <Tag color="success" style={{ fontSize: 16, padding: space.sm }}>
 {t('dms.already_signed')}
 </Tag>
 )}
 </Space>
 )}
 </FormDialog>
 </div>
 );
};

export default SignatureRequests;
