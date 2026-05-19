import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tabs, Button, Space, Form, Input, Select, message, List, Tag } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, StatusTag, LoadingSkeleton } from '../../design-system';
import type { StatusKind } from '../../design-system';
import { space } from '../../theme/tokens';
import { FormDialog } from '../../components/responsive/FormDialog';
import { useLoadingState } from '../../hooks/useLoadingState';

interface Ticket {
 id: string;
 subject: string;
 description?: string;
 status: string;
 priority: string;
 assigned_to?: string;
 created_at: string;
 sla_resolution_due?: string;
}

interface Reply {
 id: string;
 body: string;
 author_id: string;
 created_at: string;
 is_internal: boolean;
}

export default function TicketDetail() {
 const { id } = useParams<{ id: string }>();
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [ticket, setTicket] = useState<Ticket | null>(null);
 const [replies, setReplies] = useState<Reply[]>([]);
 const [loading, setLoading] = useState(false);
 const { showSkeleton } = useLoadingState(loading);
 const [replyOpen, setReplyOpen] = useState(false);
 const [replyForm] = Form.useForm();
 const [assignOpen, setAssignOpen] = useState(false);
 const [assignForm] = Form.useForm();

 const load = async () => {
 if (!id) return;
 setLoading(true);
 try {
 const [ticketRes, repliesRes] = await Promise.all([
 api.get(`/api/helpdesk/tickets/${id}`),
 api.get(`/api/helpdesk/tickets/${id}/replies`),
 ]);
 setTicket(ticketRes.data);
 setReplies(repliesRes.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 load();
 }, [id]);

 const onResolve = async () => {
 if (!id) return;
 try {
 await api.post(`/api/helpdesk/tickets/${id}/resolve`);
 message.success(t('helpdesk.ticket_resolved'));
 load();
 } catch {
 message.error(t('error'));
 }
 };

 const onClose = async () => {
 if (!id) return;
 try {
 await api.post(`/api/helpdesk/tickets/${id}/close`);
 message.success(t('helpdesk.ticket_closed'));
 load();
 } catch {
 message.error(t('error'));
 }
 };

 const onReopen = async () => {
 if (!id) return;
 try {
 await api.post(`/api/helpdesk/tickets/${id}/reopen`);
 message.success(t('helpdesk.ticket_reopened'));
 load();
 } catch {
 message.error(t('error'));
 }
 };

 const onEscalate = async () => {
 if (!id) return;
 try {
 await api.post(`/api/helpdesk/tickets/${id}/escalate`, { priority: 'urgent', reason: 'Manual escalation' });
 message.success(t('helpdesk.ticket_escalated'));
 load();
 } catch {
 message.error(t('error'));
 }
 };

 const onReply = async () => {
 const v = await replyForm.validateFields();
 if (!id) return;
 try {
 await api.post(`/api/helpdesk/tickets/${id}/replies`, { ticket_id: id, ...v });
 message.success(t('helpdesk.reply_added'));
 setReplyOpen(false);
 replyForm.resetFields();
 load();
 } catch {
 message.error(t('error'));
 }
 };

 const onAssign = async () => {
 const v = await assignForm.validateFields();
 if (!id) return;
 try {
 await api.post(`/api/helpdesk/tickets/${id}/assign`, { user_id: v.user_id });
 message.success(t('helpdesk.ticket_assigned'));
 setAssignOpen(false);
 assignForm.resetFields();
 load();
 } catch {
 message.error(t('error'));
 }
 };

 if (showSkeleton || !ticket) {
 return <LoadingSkeleton variant="card" />;
 }

 const statusKind: StatusKind =
 ticket.status === 'closed' ? 'success' : ticket.status === 'resolved' ? 'info' : 'warning';

 const tabItems = [
 {
 key: 'conversation',
 label: t('helpdesk.conversation'),
 children: (
 <div>
 <Button type="primary" onClick={() => setReplyOpen(true)} style={{ marginBottom: space.md }}>
 {t('helpdesk.add_reply')}
 </Button>
 <List
 dataSource={replies}
 renderItem={(r) => (
 <List.Item>
 <List.Item.Meta
 title={
 <Space>
 {r.author_id}
 {r.is_internal && <Tag color="orange">{t('helpdesk.internal')}</Tag>}
 </Space>
 }
 description={
 <>
 <div>{r.body}</div>
 <small>{new Date(r.created_at).toLocaleString()}</small>
 </>
 }
 />
 </List.Item>
 )}
 locale={{ emptyText: t('helpdesk.no_replies') }}
 />
 </div>
 ),
 },
 {
 key: 'time_logs',
 label: t('helpdesk.time_logs'),
 children: <div>{t('helpdesk.no_time_logs')}</div>,
 },
 {
 key: 'history',
 label: t('helpdesk.history'),
 children: <div>{t('helpdesk.no_history')}</div>,
 },
 ];

 return (
 <div style={{ padding: space.lg }}>
 <PageHeader
 title={ticket.subject}
 subtitle={`#${ticket.id.slice(0, 8)}`}
 extra={
 <Space>
 <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/helpdesk/tickets')}>
 {t('back')}
 </Button>
 <Button onClick={() => setAssignOpen(true)}>{t('helpdesk.assign')}</Button>
 {ticket.status !== 'resolved' && (
 <Button icon={<CheckOutlined />} onClick={onResolve}>
 {t('helpdesk.resolve')}
 </Button>
 )}
 {ticket.status === 'resolved' && (
 <Button icon={<ReloadOutlined />} onClick={onReopen}>
 {t('helpdesk.reopen')}
 </Button>
 )}
 {ticket.status !== 'closed' && (
 <Button icon={<CloseOutlined />} onClick={onClose}>
 {t('helpdesk.close')}
 </Button>
 )}
 <Button icon={<WarningOutlined />} onClick={onEscalate} danger>
 {t('helpdesk.escalate')}
 </Button>
 </Space>
 }
 />

 <Card style={{ marginTop: space.md }}>
 <Space direction="vertical" style={{ width: '100%' }}>
 <div>
 <strong>{t('helpdesk.status')}:</strong> <StatusTag status={statusKind} label={t(`helpdesk.status_${ticket.status}`)} />
 </div>
 <div>
 <strong>{t('helpdesk.priority')}:</strong> <Tag>{t(`helpdesk.priority_${ticket.priority}`)}</Tag>
 </div>
 {ticket.sla_resolution_due && (
 <div>
 <strong>{t('helpdesk.sla_due')}:</strong> {new Date(ticket.sla_resolution_due).toLocaleString()}
 </div>
 )}
 <div>
 <strong>{t('description')}:</strong>
 <div style={{ marginTop: space.xs }}>{ticket.description || t('no_description')}</div>
 </div>
 </Space>
 </Card>

 <Card style={{ marginTop: space.md }}>
 <Tabs items={tabItems} />
 </Card>

 <FormDialog title={t('helpdesk.add_reply')} open={replyOpen} onOk={onReply} onClose={() => setReplyOpen(false)}>
 <Form form={replyForm} layout="vertical">
 <Form.Item name="body" label={t('helpdesk.reply_body')} rules={[{ required: true }]}>
 <Input.TextArea rows={4} />
 </Form.Item>
 <Form.Item name="is_internal" valuePropName="checked">
 <input type="checkbox" /> {t('helpdesk.internal_note')}
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog title={t('helpdesk.assign')} open={assignOpen} onOk={onAssign} onClose={() => setAssignOpen(false)}>
 <Form form={assignForm} layout="vertical">
 <Form.Item name="user_id" label={t('helpdesk.assign_to')} rules={[{ required: true }]}>
 <Input placeholder={t('helpdesk.user_id_placeholder')} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
