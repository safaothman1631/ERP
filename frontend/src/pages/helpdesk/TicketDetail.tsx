import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Tabs, Button, Space, Form, Input, Select, message, List, Tag, Empty } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, WarningOutlined, PlusOutlined, UserAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, StatusTag, LoadingSkeleton } from '../../design-system';
import type { StatusKind } from '../../design-system';
import { space } from '../../theme/tokens';
import { FormDialog } from '../../components/responsive/FormDialog';
import { useLoadingState } from '../../hooks/useLoadingState';
import { saveReturnContext, clearReturnContext } from '../../utils/returnContext';

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

interface EmployeeOption { id: string; name: string; }

export default function TicketDetail() {
 const { id } = useParams<{ id: string }>();
 const { t } = useTranslation();
 const navigate = useNavigate();
 const location = useLocation();
 const [ticket, setTicket] = useState<Ticket | null>(null);
 const [replies, setReplies] = useState<Reply[]>([]);
 const [loading, setLoading] = useState(false);
 const { showSkeleton } = useLoadingState(loading);
 const [replyOpen, setReplyOpen] = useState(false);
 const [replyForm] = Form.useForm();
 const [assignOpen, setAssignOpen] = useState(false);
 const [assignForm] = Form.useForm();
 const [employees, setEmployees] = useState<EmployeeOption[]>([]);
 const [employeeSearch, setEmployeeSearch] = useState('');

 const filteredEmployees = useMemo(() => {
   const q = employeeSearch.trim().toLowerCase();
   if (!q) return employees;
   return employees.filter((e) => e.name.toLowerCase().includes(q));
 }, [employees, employeeSearch]);

 const fetchEmployees = async () => {
  try {
   const r = await api.get('/api/hr/employees', { params: { limit: 500 } });
   setEmployees((r.data.items || []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));
  } catch {
   // silently fail — empty list will trigger CTA
  }
 };

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
 void fetchEmployees();
 }, [id]);

 // Handle return-token round-trip: if we just came back from the new-employee
 // form, auto-open the assign dialog with the new employee pre-selected.
 useEffect(() => {
  if (!ticket) return;
  const params = new URLSearchParams(location.search);
  const newEmployeeId = params.get('newEmployeeId');
  const consumedToken = params.get('consumedToken');
  if (newEmployeeId) {
   // Refresh employees so the new one shows up, then open assign
   void (async () => {
    await fetchEmployees();
    assignForm.setFieldsValue({ user_id: newEmployeeId });
    setAssignOpen(true);
    if (consumedToken) clearReturnContext(consumedToken);
    // Clean the URL so a refresh doesn't re-trigger
    const cleaned = new URLSearchParams(location.search);
    cleaned.delete('newEmployeeId');
    cleaned.delete('consumedToken');
    navigate({ pathname: location.pathname, search: cleaned.toString() }, { replace: true });
   })();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [ticket?.id]);

 const handleQuickAddEmployee = () => {
  const token = saveReturnContext({
   surface: `${location.pathname}#assigned_to`,
   state: {
    ticketId: id,
    returnPath: location.pathname,
    formField: 'user_id',
   },
  });
  setAssignOpen(false);
  navigate(`/hr/employees?returnTo=${encodeURIComponent(token)}&autoOpen=1`);
 };

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
 <Select
 showSearch
 data-testid="assigned-to-select"
 placeholder={t('helpdesk.select_employee', 'Select employee')}
 filterOption={false}
 onSearch={setEmployeeSearch}
 options={filteredEmployees.map((e) => ({ value: e.id, label: e.name }))}
 notFoundContent={
 <div data-empty-surface="selector" data-empty-entity="employee" style={{ padding: 12, textAlign: 'center' }}>
 <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('helpdesk.no_employees', 'No employees yet')} />
 <Button
 type="primary"
 icon={<UserAddOutlined />}
 onClick={handleQuickAddEmployee}
 data-testid="quick-create-employee"
 style={{ marginTop: 8 }}
 >
 {t('helpdesk.add_employee', 'Add new employee')}
 </Button>
 </div>
 }
 dropdownRender={(menu) => (
 <>
 {menu}
 <div style={{ borderTop: '1px solid #f0f0f0', padding: 8 }}>
 <Button
 type="link"
 icon={<PlusOutlined />}
 onClick={handleQuickAddEmployee}
 data-testid="quick-create-employee-footer"
 >
 {t('helpdesk.add_employee', 'Add new employee')}
 </Button>
 </div>
 </>
 )}
 />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
