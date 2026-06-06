import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Switch, Modal } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

/**
 * Minimal HTML sanitizer for trusted-but-untrusted preview content.
 * Strips <script>, <iframe>, <object>, <embed>, on* event handlers, javascript: URLs.
 * Uses DOMParser (browser-native, safe — does not execute scripts).
 */
function sanitizeHtml(input: string): string {
 if (!input) return '';
 const doc = new DOMParser().parseFromString(input, 'text/html');
 const banned = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form'];
 banned.forEach((tag) => doc.querySelectorAll(tag).forEach((el) => el.remove()));
 doc.querySelectorAll('*').forEach((el) => {
 [...el.attributes].forEach((attr) => {
 const n = attr.name.toLowerCase();
 const v = (attr.value || '').trim().toLowerCase();
 if (n.startsWith('on') || ((n === 'href' || n === 'src') && v.startsWith('javascript:'))) {
 el.removeAttribute(attr.name);
 }
 });
 });
 return doc.body.innerHTML;
}

const { TextArea } = Input;
const { Option } = Select;

const EmailTemplates: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modal, setModal] = useState(false);
 const [previewModal, setPreviewModal] = useState(false);
 const [preview, setPreview] = useState<any>(null);
 const [editing, setEditing] = useState<any>(null);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/email-templates');
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchData();
 }, []);

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.put(`/api/email-templates/${editing.id}`, values);
 } else {
 await api.post('/api/email-templates', values);
 }
 message.success(t('success'));
 setModal(false);
 form.resetFields();
 setEditing(null);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/email-templates/${id}`);
 message.success(t('success'));
 fetchData();
 },
 });
 };

 const openEdit = (record: any) => {
 setEditing(record);
 form.setFieldsValue(record);
 setModal(true);
 };

 const handlePreview = async (record: any) => {
 try {
 const res = await api.post(`/api/email-templates/${record.id}/preview`, {
 contact_name: 'کڕیار نموونە',
 document_number: 'INV-001',
 amount: '1,000,000',
 due_date: '2026-06-01',
 org_name: 'کۆمپانیا نموونە',
 });
 setPreview(res.data);
 setPreviewModal(true);
 } catch {
 message.error(t('error'));
 }
 };

 const columns = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('doc_type'), dataIndex: 'doc_type', key: 'doc_type' },
 { title: t('subject'), dataIndex: 'subject', key: 'subject', ellipsis: true },
 { title: t('is_default'), dataIndex: 'is_default', key: 'is_default', render: (v: boolean) => (v ? t('yes') : t('no')) },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<EyeOutlined />} onClick={() => handlePreview(record)} />
 <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('email_templates')}
 subtitle={t('email_templates_subtitle', 'Email templates for documents')}
 helpKey="email-templates"
 sectionId="automation.email_templates"
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
 {t('new')}
 </Button>
 }
 />
 <ResponsiveTableAdapter dataSource={data} columns={columns} rowKey="id" loading={loading} />

 <FormDialog
 title={editing ? t('edit') : t('new')}
 open={modal}
 onClose={() => { setModal(false); form.resetFields(); setEditing(null); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="doc_type" label={t('doc_type')} rules={[{ required: true }]}>
 <Select>
 <Option value="invoice">{t('invoice')}</Option>
 <Option value="quote">{t('quote')}</Option>
 <Option value="bill">{t('bill')}</Option>
 <Option value="po">{t('purchase_order')}</Option>
 <Option value="so">{t('sales_order')}</Option>
 <Option value="statement">{t('statement')}</Option>
 </Select>
 </Form.Item>
 <Form.Item name="subject" label={t('subject')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="body_html" label={t('body')} rules={[{ required: true }]}>
 <TextArea rows={10} />
 </Form.Item>
 <Form.Item name="is_default" label={t('set_as_default')} valuePropName="checked" initialValue={false}>
 <Switch />
 </Form.Item>
 <Form.Item>
 <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
 <strong>{t('available_variables')}:</strong>{' '}
 {'{{contact_name}}, {{document_number}}, {{amount}}, {{due_date}}, {{org_name}}'}
 </div>
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('preview')}
 open={previewModal}
 onClose={() => setPreviewModal(false)} hideFooter
 >
 {preview && (
 <div>
 <h3>{preview.subject}</h3>
 <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(preview.body_html || '') }} />
 </div>
 )}
 </FormDialog>
 </div>
 );
};

export default EmailTemplates;
