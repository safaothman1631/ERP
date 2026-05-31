import React, { useEffect, useState } from 'react';
import { Tabs, Timeline, Avatar, Button, Space, Form, Input, Select, DatePicker, Tag, Popconfirm, Empty, message } from 'antd';
import type { TabsProps } from 'antd';
import { PlusOutlined, CheckOutlined, DeleteOutlined, UserAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../api';
import { useAuthStore } from '../store';
import { UserSelect, type UserOption } from '../design-system';
import { FormDialog } from './responsive/FormDialog';

const { TextArea } = Input;

interface ChatterPanelProps {
 entityType: string;
 entityId: string;
}

interface Activity {
 id: string;
 activity_type: string;
 summary: string;
 notes?: string;
 due_date?: string;
 assignee_id?: string;
 assignee_name?: string;
 status: string;
 created_by_name?: string;
 created_at?: string;
}

interface Follower {
 id: string;
 user_id: string;
 user_name?: string;
 notify_on?: string[];
}

const activityTypeColor: Record<string, string> = {
 todo: 'blue',
 call: 'green',
 meeting: 'purple',
 email: 'orange',
 upload: 'cyan',
};

const activityTypeLabel: Record<string, string> = {
 todo: 'مەرام',
 call: 'پەیوەندی',
 meeting: 'کۆبوونەوە',
 email: 'ئیمەیڵ',
 upload: 'بارکردن',
};

export default function ChatterPanel({ entityType, entityId }: ChatterPanelProps) {
 const { t } = useTranslation();
 const _currentUserId = useAuthStore((s) => s.userId);
 const [activities, setActivities] = useState<Activity[]>([]);
 const [followers, setFollowers] = useState<Follower[]>([]);
 const [users, setUsers] = useState<UserOption[]>([]);
 const [_loadingActivities, setLoadingActivities] = useState(false);
 const [_loadingFollowers, setLoadingFollowers] = useState(false);
 const [activityDrawer, setActivityDrawer] = useState(false);
 const [followerDrawer, setFollowerDrawer] = useState(false);
 const [noteText, setNoteText] = useState('');
 const [postingNote, setPostingNote] = useState(false);

 const [activityForm] = Form.useForm();

 useEffect(() => {
 api.get('/api/users').then(r => {
 const items = r.data.items || r.data || [];
 setUsers(items.map((u: any) => ({ id: u.id, name: u.name || u.email, email: u.email })));
 }).catch(() => setUsers([]));
 }, []);

 const loadActivities = async () => {
 setLoadingActivities(true);
 try {
 const res = await api.get(`/api/chatter/${entityType}/${entityId}/activities`);
 setActivities(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoadingActivities(false);
 }
 };

 const loadFollowers = async () => {
 setLoadingFollowers(true);
 try {
 const res = await api.get(`/api/chatter/${entityType}/${entityId}/followers`);
 setFollowers(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoadingFollowers(false);
 }
 };

 useEffect(() => {
 loadActivities();
 loadFollowers();
 }, [entityType, entityId]);

 const handleAddActivity = async () => {
 try {
 const values = await activityForm.validateFields();
 const payload = {
 ...values,
 due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : undefined,
 };
 await api.post(`/api/chatter/${entityType}/${entityId}/activities`, payload);
 message.success(t('saved'));
 activityForm.resetFields();
 setActivityDrawer(false);
 loadActivities();
 } catch (err: any) {
 if (!err.errorFields) {
 message.error(t('error'));
 }
 }
 };

 const handleMarkDone = async (activityId: string) => {
 try {
 await api.post(`/api/chatter/activities/${activityId}/done`);
 message.success(t('chatter.activity_done'));
 loadActivities();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDeleteActivity = async (activityId: string) => {
 try {
 await api.delete(`/api/chatter/activities/${activityId}`);
 message.success(t('deleted'));
 loadActivities();
 } catch {
 message.error(t('error'));
 }
 };

 const handleAddFollower = async () => {
 try {
 const values = await activityForm.validateFields();
 await api.post(`/api/chatter/${entityType}/${entityId}/followers`, {
 user_id: values.user_id,
 user_name: values.user_name || '',
 notify_on: ['update', 'comment'],
 });
 message.success(t('chatter.follower_added'));
 activityForm.resetFields();
 setFollowerDrawer(false);
 loadFollowers();
 } catch (err: any) {
 if (!err.errorFields) {
 message.error(t('error'));
 }
 }
 };

 const handleRemoveFollower = async (userId: string) => {
 try {
 await api.delete(`/api/chatter/${entityType}/${entityId}/followers/${userId}`);
 message.success(t('chatter.follower_removed'));
 loadFollowers();
 } catch {
 message.error(t('error'));
 }
 };

 const handlePostNote = async () => {
 if (!noteText.trim()) return;
 setPostingNote(true);
 try {
 await api.post(`/api/chatter/${entityType}/${entityId}/activities`, {
 activity_type: 'upload',
 summary: t('chatter.note_logged'),
 notes: noteText,
 });
 message.success(t('chatter.note_posted'));
 setNoteText('');
 loadActivities();
 } catch {
 message.error(t('error'));
 } finally {
 setPostingNote(false);
 }
 };

 const activitiesTab = (
 <div>
 <div style={{ marginBottom: 16 }}>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 activityForm.resetFields();
 setActivityDrawer(true);
 }}
 >
 {t('chatter.add_activity')}
 </Button>
 </div>

 {activities.length === 0 ? (
 <Empty description={t('chatter.no_activities')} />
 ) : (
 <Timeline>
 {activities.map((act) => (
 <Timeline.Item key={act.id}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
 <div style={{ flex: 1 }}>
 <Space>
 <Tag color={activityTypeColor[act.activity_type] || 'default'}>
 {activityTypeLabel[act.activity_type] || act.activity_type}
 </Tag>
 {act.status === 'done' && <Tag color="green">{t('done')}</Tag>}
 </Space>
 <div style={{ fontWeight: 600, marginTop: 4 }}>{act.summary}</div>
 {act.notes && <div style={{ color: '#888', marginTop: 4 }}>{act.notes}</div>}
 {act.due_date && (
 <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
 {t('chatter.due')}: {act.due_date}
 </div>
 )}
 {act.assignee_name && (
 <div style={{ fontSize: 12, marginTop: 4 }}>
 {t('chatter.assigned_to')}: {act.assignee_name}
 </div>
 )}
 <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
 {act.created_by_name} • {act.created_at ? dayjs(act.created_at).format('MMM D, YYYY h:mm A') : ''}
 </div>
 </div>
 <Space>
 {act.status !== 'done' && (
 <Button
 icon={<CheckOutlined />}
 onClick={() => handleMarkDone(act.id)}
 >
 {t('done')}
 </Button>
 )}
 <Popconfirm
 title={t('confirm_delete')}
 onConfirm={() => handleDeleteActivity(act.id)}
 >
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 </div>
 </Timeline.Item>
 ))}
 </Timeline>
 )}
 </div>
 );

 const followersTab = (
 <div>
 <div style={{ marginBottom: 16 }}>
 <Button
 type="primary"
 icon={<UserAddOutlined />}
 onClick={() => {
 activityForm.resetFields();
 setFollowerDrawer(true);
 }}
 >
 {t('chatter.add_follower')}
 </Button>
 </div>

 {followers.length === 0 ? (
 <Empty description={t('chatter.no_followers')} />
 ) : (
 <Space direction="vertical" style={{ width: '100%' }}>
 {followers.map((fol) => (
 <div
 key={fol.id}
 style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 padding: 8,
 border: '1px solid #e8e8e8',
 borderRadius: 4,
 }}
 >
 <Space>
 <Avatar>{(fol.user_name || 'U')[0].toUpperCase()}</Avatar>
 <span>{fol.user_name || fol.user_id}</span>
 </Space>
 <Popconfirm
 title={t('confirm_delete')}
 onConfirm={() => handleRemoveFollower(fol.user_id)}
 >
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </div>
 ))}
 </Space>
 )}
 </div>
 );

 const noteTab = (
 <div>
 <TextArea
 rows={4}
 value={noteText}
 onChange={(e) => setNoteText(e.target.value)}
 placeholder={t('chatter.note_placeholder')}
 style={{ marginBottom: 16 }}
 />
 <Button
 type="primary"
 onClick={handlePostNote}
 loading={postingNote}
 disabled={!noteText.trim()}
 >
 {t('chatter.post_note')}
 </Button>
 </div>
 );

 const items: TabsProps['items'] = [
 { key: 'activities', label: t('chatter.activities'), children: activitiesTab },
 { key: 'followers', label: t('chatter.followers'), children: followersTab },
 { key: 'note', label: t('chatter.log_note'), children: noteTab },
 ];

 return (
 <>
 <Tabs items={items} />

 <FormDialog
 title={t('chatter.add_activity')}
 open={activityDrawer}
 onClose={() => setActivityDrawer(false)}
 footer={
 <Space>
 <Button onClick={() => setActivityDrawer(false)}>{t('cancel')}</Button>
 <Button type="primary" onClick={handleAddActivity}>
 {t('save')}
 </Button>
 </Space>
 }
 >
 <Form form={activityForm} layout="vertical">
 <Form.Item
 name="activity_type"
 label={t('chatter.activity_type')}
 rules={[{ required: true, message: t('required') }]}
 initialValue="todo"
 >
 <Select>
 <Select.Option value="todo">{activityTypeLabel.todo}</Select.Option>
 <Select.Option value="call">{activityTypeLabel.call}</Select.Option>
 <Select.Option value="meeting">{activityTypeLabel.meeting}</Select.Option>
 <Select.Option value="email">{activityTypeLabel.email}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item
 name="summary"
 label={t('chatter.summary')}
 rules={[{ required: true, message: t('required') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item name="notes" label={t('chatter.notes')}>
 <TextArea rows={3} />
 </Form.Item>
 <Form.Item name="due_date" label={t('chatter.due_date')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="assignee_id" label={t('chatter.assignee')}>
 <UserSelect users={users as UserOption[]} />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('chatter.add_follower')}
 open={followerDrawer}
 onClose={() => setFollowerDrawer(false)}
 footer={
 <Space>
 <Button onClick={() => setFollowerDrawer(false)}>{t('cancel')}</Button>
 <Button type="primary" onClick={handleAddFollower}>
 {t('add')}
 </Button>
 </Space>
 }
 >
 <Form form={activityForm} layout="vertical">
 <Form.Item
 name="user_id"
 label={t('chatter.user')}
 rules={[{ required: true, message: t('required') }]}
 >
 <UserSelect users={users as UserOption[]} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
}
