import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Row, Col, Popconfirm } from 'antd';

import { message } from '../../utils/message';
import { PlusOutlined, SendOutlined, EyeOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, KpiCard } from '../../design-system';
import { formatDate } from '../../utils/formatters';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { TextArea } = Input;

const EmailCampaigns: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [createModal, setCreateModal] = useState(false);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [audiences, setAudiences] = useState<any[]>([]);
 const [statsDrawer, setStatsDrawer] = useState<string | null>(null);
 const [stats, setStats] = useState<any>(null);
 const [statsLoading, setStatsLoading] = useState(false);

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/marketing/campaigns');
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchAudiences = async () => {
 try {
 const res = await api.get('/api/marketing/audiences');
 setAudiences(res.data.items || []);
 } catch { /* noop */ }
 };

 useEffect(() => {
 fetchData();
 fetchAudiences();
 }, []);

 const handleCreate = async (values: any) => {
 setSaving(true);
 try {
 await api.post('/api/marketing/campaigns', values);
 message.success(t('success'));
 setCreateModal(false);
 form.resetFields();
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleSend = async (id: string) => {
 try {
 await api.post(`/api/marketing/campaigns/${id}/send`);
 message.success(t('marketing.campaign_sent'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/marketing/campaigns/${id}`);
 message.success(t('deleted'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleClone = async (record: any) => {
 try {
 await api.post('/api/marketing/campaigns', {
 name: `${record.name} (نووسخە)`,
 subject: record.subject,
 body_html: record.body_html,
 audience_id: record.audience_id,
 });
 message.success(t('marketing.campaign_cloned'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleViewStats = async (id: string) => {
 setStatsDrawer(id);
 setStatsLoading(true);
 try {
 const res = await api.get(`/api/marketing/campaigns/${id}/stats`);
 setStats(res.data);
 } catch {
 message.error(t('error'));
 } finally {
 setStatsLoading(false);
 }
 };

 const columns: any[] = [
 { title: t('marketing.name'), dataIndex: 'name', key: 'name' },
 { title: t('marketing.subject'), dataIndex: 'subject', key: 'subject' },
 { title: t('marketing.status'), dataIndex: 'status', key: 'status' },
 {
 title: t('marketing.sent_at'),
 dataIndex: 'sent_at',
 key: 'sent_at',
 render: (val: string) => (val ? formatDate(val) : '—'),
 },
 {
 title: t('marketing.recipients'),
 dataIndex: 'recipient_count',
 key: 'recipient_count',
 render: (val: number) => val || 0,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, rec: any) => (
 <Space>
 {rec.status === 'draft' && (
 <Button type="primary" icon={<SendOutlined />} onClick={() => handleSend(rec.id)}>
 {t('marketing.send_now')}
 </Button>
 )}
 <Button icon={<EyeOutlined />} onClick={() => handleViewStats(rec.id)}>
 {t('marketing.stats')}
 </Button>
 <Button icon={<CopyOutlined />} onClick={() => handleClone(rec)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(rec.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('marketing.email_campaigns')}
 subtitle={t('marketing.email_campaigns_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
 {t('create')}
 </Button>
 }
 />

 <ResponsiveTableAdapter columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />

 <FormDialog
 title={t('marketing.create_campaign')}
 open={createModal}
 onClose={() => setCreateModal(false)} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleCreate}>
 <Form.Item name="name" label={t('marketing.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="subject" label={t('marketing.subject')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="body_html" label={t('marketing.body')}>
 <TextArea rows={6} />
 </Form.Item>
 <Form.Item name="audience_id" label={t('marketing.audience')}>
 <Select
 options={audiences.map((a) => ({ label: a.name, value: a.id }))}
 placeholder={t('select')}
 />
 </Form.Item>
 <Form.Item>
 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>
 {t('create')}
 </Button>
 <Button onClick={() => setCreateModal(false)}>{t('cancel')}</Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('marketing.campaign_stats')}
 open={!!statsDrawer}
 onClose={() => setStatsDrawer(null)}
 >
 {statsLoading ? (
 <div>{t('loading')}</div>
 ) : stats ? (
 <Row gutter={[16, 16]}>
 <Col span={12}>
 <KpiCard title={t('marketing.sent')} value={stats.sent} />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.delivered')} value={stats.delivered} tone="success" />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.opened')} value={stats.opened} tone="info" />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.clicked')} value={stats.clicked} tone="info" />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.bounced')} value={stats.bounced} tone="warning" />
 </Col>
 <Col span={12}>
 <KpiCard title={t('marketing.unsubscribed')} value={stats.unsubscribed} tone="danger" />
 </Col>
 </Row>
 ) : null}
 </FormDialog>
 </div>
 );
};

export default EmailCampaigns;
