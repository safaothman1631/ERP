import { useState, useEffect } from 'react';
import { Button, Form, Input, Tabs, Space, Card, Select } from 'antd';
import { message } from '../../utils/message';
import { CheckOutlined, CloseOutlined, SwapOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { StatusTag } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { TextArea } = Input;

interface ApprovalRequest {
 id: string;
 doc_type: string;
 doc_id: string;
 doc_summary: {
 number: string;
 total: number;
 currency: string;
 contact_name?: string;
 };
 requested_by: string;
 current_step: number;
 total_steps: number;
 status: string;
 created_at: string;
 steps: any[];
}

export default function MyApprovals() {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [inboxItems, setInboxItems] = useState<ApprovalRequest[]>([]);
 const [submittedItems, setSubmittedItems] = useState<ApprovalRequest[]>([]);
 const [loading, setLoading] = useState(false);
 const [activeTab, setActiveTab] = useState('inbox');
 const [actionModal, setActionModal] = useState<{ visible: boolean; action: string; requestId: string }>({
 visible: false,
 action: '',
 requestId: '',
 });
 const [actionForm] = Form.useForm();
 const [users, setUsers] = useState<any[]>([]);

 useEffect(() => {
 if (activeTab === 'inbox') {
 fetchInbox();
 } else {
 fetchSubmitted();
 }
 }, [activeTab]);

 const fetchInbox = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/approvals/approval-requests/inbox');
 setInboxItems(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 setLoading(false);
 };

 const fetchSubmitted = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/approvals/approval-requests', {
 params: { page_size: 100 }
 });
 setSubmittedItems(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 setLoading(false);
 };

 const fetchUsers = async () => {
 try {
 const res = await api.get('/api/users');
 setUsers(res.data.items || []);
 } catch {
 // Silently fail
 }
 };

 const handleAction = (action: string, requestId: string) => {
 if (action === 'delegate') {
 fetchUsers();
 }
 setActionModal({ visible: true, action, requestId });
 actionForm.resetFields();
 };

 const handleSubmitAction = async (values: any) => {
 const { action, requestId } = actionModal;
 try {
 if (action === 'approve') {
 await api.post(`/api/approvals/approval-requests/${requestId}/approve`, {
 comments: values.comments,
 });
 message.success(t('approvals.approved'));
 } else if (action === 'reject') {
 await api.post(`/api/approvals/approval-requests/${requestId}/reject`, {
 comments: values.comments,
 });
 message.success(t('approvals.rejected'));
 } else if (action === 'delegate') {
 await api.post(`/api/approvals/approval-requests/${requestId}/delegate`, {
 delegate_to: values.delegate_to,
 comments: values.comments,
 });
 message.success(t('approvals.delegated'));
 }
 setActionModal({ visible: false, action: '', requestId: '' });
 actionForm.resetFields();
 if (activeTab === 'inbox') {
 fetchInbox();
 } else {
 fetchSubmitted();
 }
 } catch (err: any) {
 message.error(err.response?.data?.detail || t('error'));
 }
 };

 const getStatusTag = (status: string) => {
 return <StatusTag status={status} label={t(`approvals.status_${status}`)} />;
 };

 const inboxColumns = [
 {
 title: t('approvals.doc_type'),
 dataIndex: 'doc_type',
 key: 'doc_type',
 render: (type: string) => t(`approvals.doc_type_${type}`),
 },
 {
 title: t('approvals.document_number'),
 key: 'doc_number',
 render: (_: any, record: ApprovalRequest) => record.doc_summary.number,
 },
 {
 title: t('approvals.amount'),
 key: 'amount',
 render: (_: any, record: ApprovalRequest) =>
 `${record.doc_summary.total.toLocaleString()} ${record.doc_summary.currency}`,
 },
 {
 title: t('approvals.contact'),
 key: 'contact',
 render: (_: any, record: ApprovalRequest) => record.doc_summary.contact_name || '-',
 },
 {
 title: t('approvals.step_label'),
 key: 'step',
 render: (_: any, record: ApprovalRequest) => `${record.current_step} / ${record.total_steps}`,
 },
 {
 title: t('approvals.created_at'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (date: string) => new Date(date).toLocaleDateString(),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: ApprovalRequest) => (
 <Space>
 <Button
 type="primary"
 icon={<CheckOutlined />}
 onClick={() => handleAction('approve', record.id)}
 >
 {t('approvals.approve')}
 </Button>
 <Button
 danger
 icon={<CloseOutlined />}
 onClick={() => handleAction('reject', record.id)}
 >
 {t('approvals.reject')}
 </Button>
 <Button
 icon={<SwapOutlined />}
 onClick={() => handleAction('delegate', record.id)}
 >
 {t('approvals.delegate')}
 </Button>
 <Button
 icon={<EyeOutlined />}
 onClick={() => navigate(`/approvals/${record.id}`)}
 >
 {t('view')}
 </Button>
 </Space>
 ),
 },
 ];

 const submittedColumns = [
 {
 title: t('approvals.doc_type'),
 dataIndex: 'doc_type',
 key: 'doc_type',
 render: (type: string) => t(`approvals.doc_type_${type}`),
 },
 {
 title: t('approvals.document_number'),
 key: 'doc_number',
 render: (_: any, record: ApprovalRequest) => record.doc_summary.number,
 },
 {
 title: t('approvals.amount'),
 key: 'amount',
 render: (_: any, record: ApprovalRequest) =>
 `${record.doc_summary.total.toLocaleString()} ${record.doc_summary.currency}`,
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => getStatusTag(status),
 },
 {
 title: t('approvals.step_label'),
 key: 'step',
 render: (_: any, record: ApprovalRequest) => `${record.current_step} / ${record.total_steps}`,
 },
 {
 title: t('approvals.created_at'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (date: string) => new Date(date).toLocaleDateString(),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: ApprovalRequest) => (
 <Button
 icon={<EyeOutlined />}
 onClick={() => navigate(`/approvals/${record.id}`)}
 >
 {t('view')}
 </Button>
 ),
 },
 ];

 return (
 <Card title={t('approvals.my_approvals')}>
 <Tabs activeKey={activeTab} onChange={setActiveTab}>
 <Tabs.TabPane tab={`${t('approvals.my_inbox')} (${inboxItems.length})`} key="inbox">
 <ResponsiveTableAdapter
 columns={inboxColumns}
 dataSource={inboxItems}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 />
 </Tabs.TabPane>
 <Tabs.TabPane tab={`${t('approvals.i_submitted')} (${submittedItems.length})`} key="submitted">
 <ResponsiveTableAdapter
 columns={submittedColumns}
 dataSource={submittedItems}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 />
 </Tabs.TabPane>
 </Tabs>

 <FormDialog
 open={actionModal.visible}
 title={t(`approvals.${actionModal.action}_title`)}
 onClose={() => setActionModal({ visible: false, action: '', requestId: '' })}
 onOk={() => actionForm.submit()}
 >
 <Form form={actionForm} layout="vertical" onFinish={handleSubmitAction}>
 {actionModal.action === 'delegate' && (
 <Form.Item name="delegate_to" label={t('approvals.delegate_to')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children">
 {users.map((u) => (
 <Select.Option key={u.id} value={u.id}>
 {u.name || u.email}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 )}
 <Form.Item
 name="comments"
 label={t('approvals.comments')}
 rules={actionModal.action === 'reject' ? [{ required: true }] : []}
 >
 <TextArea rows={4} />
 </Form.Item>
 </Form>
 </FormDialog>
 </Card>
 );
}
