import { useEffect, useState } from 'react';
import {
 Card, Tabs, Form, Input, Switch, Button, Tag, Space, Row, Col, Statistic,
 message, Popconfirm, Divider } from 'antd';
import { FormDialog } from '../components/responsive/FormDialog';
import { PlusOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

interface Template { id: string; name: string; body: string; description?: string; locale?: string; }
interface MessageRow {
 id: string; to: string; body: string; status?: string;
 queued_at?: string; sent_at?: string; error?: string; related_type?: string;
}

const STATUS_COLORS: Record<string, string> = {
 queued: 'default', sending: 'cyan', sent: 'blue', delivered: 'cyan',
 read: 'geekblue', failed: 'red', skipped: 'orange', previewed: 'purple',
};

export default function WhatsApp() {
 const { t } = useTranslation();
 const [config, setConfig] = useState<Record<string, unknown>>({});
 const [templates, setTemplates] = useState<Template[]>([]);
 const [messages, setMessages] = useState<MessageRow[]>([]);
 const [stats, setStats] = useState<Record<string, number>>({});
 const [loading, setLoading] = useState(false);
 const [tplModal, setTplModal] = useState<Template | null>(null);
 const [sendModal, setSendModal] = useState(false);
 const [configForm] = Form.useForm();
 const [tplForm] = Form.useForm();
 const [sendForm] = Form.useForm();

 const load = async () => {
 setLoading(true);
 try {
 const [cfgRes, tplRes, msgRes, statRes] = await Promise.all([
 api.get('/api/whatsapp/config'),
 api.get('/api/whatsapp/templates'),
 api.get('/api/whatsapp/messages', { params: { page_size: 100 } }),
 api.get('/api/whatsapp/messages/stats'),
 ]);
 setConfig(cfgRes.data);
 configForm.setFieldsValue(cfgRes.data);
 setTemplates(tplRes.data.items || []);
 setMessages(msgRes.data.items || []);
 setStats(statRes.data);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { load();   }, []);

 const saveConfig = async () => {
 const v = await configForm.validateFields();
 try {
 const res = await api.put('/api/whatsapp/config', v);
 setConfig(res.data);
 message.success(t('saved'));
 } catch { message.error(t('error')); }
 };

 const saveTemplate = async () => {
 const v = await tplForm.validateFields();
 try {
 if (tplModal && tplModal.id) {
 await api.put(`/api/whatsapp/templates/${tplModal.id}`, v);
 } else {
 await api.post('/api/whatsapp/templates', v);
 }
 setTplModal(null);
 tplForm.resetFields();
 load();
 message.success(t('saved'));
 } catch { message.error(t('error')); }
 };

 const deleteTemplate = async (id: string) => {
 try { await api.delete(`/api/whatsapp/templates/${id}`); load(); }
 catch { message.error(t('error')); }
 };

 const sendNow = async () => {
 const v = await sendForm.validateFields();
 try {
 await api.post('/api/whatsapp/send', v);
 message.success(t('saved'));
 setSendModal(false);
 sendForm.resetFields();
 load();
 } catch { message.error(t('error')); }
 };

 const tplCols = [
 { title: t('name'), dataIndex: 'name' },
 { title: t('summary'), dataIndex: 'body', render: (b: string) => b?.slice(0, 80) },
 { title: t('locale'), dataIndex: 'locale' },
 {
 title: t('actions'),
 render: (_: unknown, r: Template) => (
 <Space>
 <Button onClick={() => { setTplModal(r); tplForm.setFieldsValue(r); }}>{t('edit')}</Button>
 <Popconfirm title={t('confirm_archive')} onConfirm={() => deleteTemplate(r.id)}>
 <Button danger>{t('delete')}</Button>
 </Popconfirm>
 </Space>
 ),
 },
 ];

 const msgCols = [
 { title: t('to'), dataIndex: 'to' },
 { title: t('summary'), dataIndex: 'body', render: (b: string) => b?.slice(0, 60) },
 {
 title: t('status'),
 dataIndex: 'status',
 render: (s?: string) => <Tag color={STATUS_COLORS[s || 'queued']}>{s || 'queued'}</Tag>,
 },
 { title: t('queued_at'), dataIndex: 'queued_at',
 render: (d?: string) => d ? d.slice(0, 19).replace('T', ' ') : '—' },
 { title: t('error'), dataIndex: 'error' },
 ];

 return (
 <div>
 <PageHeader
 title={t('whatsapp')}
 subtitle={t('whatsapp_subtitle', 'WhatsApp messaging for customers')}
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<SendOutlined />} onClick={() => setSendModal(true)}>
 {t('send_message')}
 </Button>
 </Space>
 }
 />

 <Row gutter={12} style={{ marginBottom: 16 }}>
 <Col span={4}><Card><Statistic title={t('total')} value={stats.total || 0} /></Card></Col>
 <Col span={4}><Card><Statistic title={t('sent')} value={stats.sent || 0} styles={{ content: { color: 'var(--accent-500)' } }} /></Card></Col>
 <Col span={4}><Card><Statistic title={t('delivered')} value={stats.delivered || 0} styles={{ content: { color: '#13c2c2' } }} /></Card></Col>
 <Col span={4}><Card><Statistic title={t('read')} value={stats.read || 0} styles={{ content: { color: 'var(--accent-500)' } }} /></Card></Col>
 <Col span={4}><Card><Statistic title={t('failed')} value={stats.failed || 0} styles={{ content: { color: 'var(--danger-500)' } }} /></Card></Col>
 <Col span={4}><Card><Statistic title={t('previewed')} value={stats.previewed || 0} /></Card></Col>
 </Row>

 <Tabs
 items={[
 {
 key: 'config',
 label: t('configuration'),
 children: (
 <Card loading={loading}>
 <Form form={configForm} layout="vertical" initialValues={config}>
 <Row gutter={12}>
 <Col span={12}><Form.Item name="enabled" label={t('enabled')} valuePropName="checked"><Switch /></Form.Item></Col>
 <Col span={12}><Form.Item name="preview_mode" label={t('preview_mode')} valuePropName="checked"><Switch /></Form.Item></Col>
 <Col span={12}><Form.Item name="api_base" label="API Base"><Input /></Form.Item></Col>
 <Col span={12}><Form.Item name="phone_number_id" label="Phone Number ID"><Input /></Form.Item></Col>
 <Col span={12}><Form.Item name="business_account_id" label="Business Account ID"><Input /></Form.Item></Col>
 <Col span={12}><Form.Item name="default_country_code" label={t('country_code')}><Input maxLength={4} /></Form.Item></Col>
 <Col span={24}><Form.Item name="api_token" label="API Token"><Input.Password placeholder="Bearer token from Meta" /></Form.Item></Col>
 </Row>
 <Divider />
 <Row gutter={12}>
 <Col span={12}><Form.Item name="auto_send_invoice" label={t('auto_send_invoice')} valuePropName="checked"><Switch /></Form.Item></Col>
 <Col span={12}><Form.Item name="auto_send_payment_receipt" label={t('auto_send_payment_receipt')} valuePropName="checked"><Switch /></Form.Item></Col>
 </Row>
 <Button type="primary" onClick={saveConfig}>{t('save')}</Button>
 </Form>
 </Card>
 ),
 },
 {
 key: 'templates',
 label: t('templates'),
 children: (
 <>
 <Button icon={<PlusOutlined />} type="primary" style={{ marginBottom: 12 }}
 onClick={() => { setTplModal({ id: '', name: '', body: '', locale: 'ku' }); tplForm.resetFields(); }}>
 {t('new_template')}
 </Button>
 <ResponsiveTableAdapter rowKey="id" loading={loading} dataSource={templates} columns={tplCols} />
 </>
 ),
 },
 {
 key: 'messages',
 label: t('message_log'),
 children: <ResponsiveTableAdapter rowKey="id" loading={loading} dataSource={messages} columns={msgCols} pagination={{ pageSize: 25 }} />,
 },
 ]}
 />

 <FormDialog
 title={tplModal?.id ? t('edit_template') : t('new_template')}
 open={!!tplModal}
 onClose={() => setTplModal(null)}
 onOk={saveTemplate}
 >
 <Form form={tplForm} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}><Input /></Form.Item>
 <Form.Item name="locale" label={t('locale')} initialValue="ku"><Input /></Form.Item>
 <Form.Item name="body" label={t('body')} rules={[{ required: true }]}>
 <Input.TextArea rows={5} placeholder="Hello {{name}}, your invoice {{number}} for {{amount}} is ready." />
 </Form.Item>
 <Form.Item name="description" label={t('description')}><Input /></Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('send_message')}
 open={sendModal}
 onClose={() => setSendModal(false)}
 onOk={sendNow}
 >
 <Form form={sendForm} layout="vertical">
 <Form.Item name="to" label={t('to')} rules={[{ required: true }]}>
 <Input placeholder="07501234567 or 9647501234567" />
 </Form.Item>
 <Form.Item name="body" label={t('body')} rules={[{ required: true }]}>
 <Input.TextArea rows={4} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
