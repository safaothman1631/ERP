import { useEffect, useState } from 'react';
import { Button, Form, Input, Select, Space, Tag, message, Popconfirm, Modal } from 'antd';
import type { TableProps } from 'antd';
import { PlusOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, BulkActionBar, StatusTag } from '../../design-system';
import type { BulkAction, StatusKind } from '../../design-system';
import SavedFiltersBar from '../../components/SavedFiltersBar';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';
// EP-3 — Class B drawer migration. The `team` entity registry entry opens
// the drawer-with-Steps for quick-create.
import { SelectWithQuickCreate } from '../../design-system/empty/SelectWithQuickCreate';
import { ListWithEmptyState } from '../../design-system/empty/ListWithEmptyState';

interface Ticket {
 id: string;
 subject: string;
 status: string;
 priority: string;
 team_id?: string;
 assigned_to?: string;
 created_at: string;
}

interface Team { id: string; name: string; }

export default function TicketsList() {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [tickets, setTickets] = useState<Ticket[]>([]);
 const [teams, setTeams] = useState<Team[]>([]);
 const [loading, setLoading] = useState(false);
 const [createOpen, setCreateOpen] = useState(false);
 const [createForm] = Form.useForm();
 const [selectedRows, setSelectedRows] = useState<string[]>([]);
 const [filters, setFilters] = useState<any>({});

 const load = async (customFilters?: any) => {
 setLoading(true);
 try {
 const params = { limit: 200, ...customFilters };
 const [ticketsRes, teamsRes] = await Promise.all([
 api.get('/api/helpdesk/tickets', { params }),
 api.get('/api/helpdesk/teams'),
 ]);
 setTickets(ticketsRes.data.items || []);
 setTeams(teamsRes.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 load();
 }, []);

 const onCreate = async () => {
 const v = await createForm.validateFields();
 try {
 await api.post('/api/helpdesk/tickets', v);
 message.success(t('saved'));
 setCreateOpen(false);
 createForm.resetFields();
 load();
 } catch {
 message.error(t('error'));
 }
 };

 const onBulkClose = async () => {
 try {
 await Promise.all(selectedRows.map((id) => api.post(`/api/helpdesk/tickets/${id}/close`)));
 message.success(t('helpdesk.bulk_closed'));
 setSelectedRows([]);
 load();
 } catch {
 message.error(t('error'));
 }
 };

 const columns: TableProps<Ticket>['columns'] = [
 {
 title: t('helpdesk.subject'),
 dataIndex: 'subject',
 key: 'subject',
 render: (text, rec) => (
 <a onClick={() => navigate(`/helpdesk/tickets/${rec.id}`)}>{text}</a>
 ),
 },
 {
 title: t('helpdesk.status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => {
 const kind: StatusKind =
 status === 'closed' ? 'success' : status === 'resolved' ? 'info' : 'warning';
 return <StatusTag status={kind} label={t(`helpdesk.status_${status}`)} />;
 },
 },
 {
 title: t('helpdesk.priority'),
 dataIndex: 'priority',
 key: 'priority',
 render: (priority: string) => <Tag>{t(`helpdesk.priority_${priority}`)}</Tag>,
 },
 {
 title: t('created_at'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (val: string) => (val ? new Date(val).toLocaleDateString() : '—'),
 },
 ];

 const bulkActions: BulkAction[] = [
 {
 key: 'close',
 label: t('helpdesk.bulk_close'),
 onClick: () => {
 Modal.confirm({
 title: t('helpdesk.confirm_bulk_close'),
 onOk: onBulkClose,
 });
 },
 },
 ];

 const handleFilterLoad = (filter: any) => {
 setFilters(filter.filters || {});
 load(filter.filters);
 };

 return (
 <div style={{ padding: space.lg }}>
 <PageHeader
 title={t('helpdesk.tickets')}
 subtitle={t('helpdesk.tickets_subtitle')}
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={() => load()}>
 {t('refresh')}
 </Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
 {t('helpdesk.new_ticket')}
 </Button>
 </Space>
 }
 />

 <SavedFiltersBar
 pageKey="helpdesk_tickets"
 currentFilters={filters}
 onLoad={handleFilterLoad}
 />

 {selectedRows.length > 0 && (
 <BulkActionBar
 selectedCount={selectedRows.length}
 actions={bulkActions}
 onClear={() => setSelectedRows([])}
 />
 )}

 <ListWithEmptyState
 entity="ticket"
 data={tickets}
 loading={loading}
 onCreate={() => setCreateOpen(true)}
 onRetry={() => load()}
 render={(rows) => (
 <ResponsiveTableAdapter
 dataSource={rows}
 columns={columns}
 rowKey="id"
 loading={loading}
 rowSelection={{
 selectedRowKeys: selectedRows,
 onChange: (keys) => setSelectedRows(keys as string[]),
 }}
 pagination={{ pageSize: 50 }}
 />
 )}
 />

 <FormDialog
 title={t('helpdesk.new_ticket')}
 open={createOpen}
 onOk={onCreate}
 onClose={() => setCreateOpen(false)}
 >
 <Form form={createForm} layout="vertical">
 <Form.Item name="subject" label={t('helpdesk.subject')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="description" label={t('description')}>
 <Input.TextArea rows={4} />
 </Form.Item>
 <Form.Item name="priority" label={t('helpdesk.priority')} initialValue="medium">
 <Select>
 <Select.Option value="low">{t('helpdesk.priority_low')}</Select.Option>
 <Select.Option value="medium">{t('helpdesk.priority_medium')}</Select.Option>
 <Select.Option value="high">{t('helpdesk.priority_high')}</Select.Option>
 <Select.Option value="urgent">{t('helpdesk.priority_urgent')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="team_id" label={t('helpdesk.team')}>
 {/* EP-3 — Class B team selector. Replaces legacy <Select> with
     drawer-with-Steps quick-create on empty/CTA click. */}
 <SelectWithQuickCreate
 entity="team"
 allowClear
 options={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
 />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
