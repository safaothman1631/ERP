import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, message, Card, Upload, Tag, Modal } from 'antd';
import { PlusOutlined, DownloadOutlined, DeleteOutlined, FolderOutlined, FileOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const Documents: React.FC = () => {
 const { t } = useTranslation();
 const [files, setFiles] = useState<any[]>([]);
 const [folders, setFolders] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [uploadModalOpen, setUploadModalOpen] = useState(false);
 const [folderFilter, setFolderFilter] = useState<string>('');
 const [form] = Form.useForm();

 const fetchFiles = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/documents/files', {
 params: { folder_id: folderFilter || undefined, limit: 100 },
 });
 setFiles(res.data.items || []);
 } catch (error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchFolders = async () => {
 try {
 const res = await api.get('/api/documents/folders', { params: { limit: 100 } });
 setFolders(res.data.items || []);
 } catch {}
 };

 useEffect(() => {
 void fetchFiles();
 void fetchFolders();
 }, [folderFilter]);

 const handleUpload = async (values: any) => {
 try {
 // Note: actual file upload would need multipart handling
 // For now, we assume storage_url is provided
 await api.post('/api/documents/files', {
 name: values.name,
 folder_id: values.folder_id || null,
 storage_url: values.storage_url || 'https://example.com/file.pdf',
 mime_type: 'application/pdf',
 size_bytes: 0,
 });
 message.success(t('documents.uploaded'));
 setUploadModalOpen(false);
 form.resetFields();
 void fetchFiles();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDownload = (record: any) => {
 window.open(record.storage_url, '_blank');
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/documents/files/${id}`);
 message.success(t('success'));
 void fetchFiles();
 },
 });
 };

 const columns = [
 { title: t('documents.name'), dataIndex: 'name', key: 'name', render: (v: string, r: any) => <><FileOutlined /> {v}</> },
 { title: t('documents.folder'), dataIndex: 'folder_id', key: 'folder_id', render: (v: string) => v || t('documents.root') },
 { title: t('documents.mime_type'), dataIndex: 'mime_type', key: 'mime_type' },
 { title: t('documents.size'), dataIndex: 'size_bytes', key: 'size_bytes', render: (v: number) => `${Math.round(v / 1024)} KB` },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<DownloadOutlined />} onClick={() => handleDownload(record)} />
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('documents.title')}
 subtitle={t('documents.subtitle')}
 extra={
 <Button type="primary" icon={<UploadOutlined />} onClick={() => { form.resetFields(); setUploadModalOpen(true); }}>
 {t('documents.upload')}
 </Button>
 }
 />
 <Card style={{ marginTop: space.md }}>
 <Space style={{ marginBottom: space.md }}>
 <Select
 placeholder={t('documents.filter_folder')}
 allowClear
 style={{ width: 200 }}
 value={folderFilter || undefined}
 onChange={(v) => setFolderFilter(v || '')}
 >
 {folders.map((f) => (
 <Select.Option key={f.id} value={f.id}><FolderOutlined /> {f.name}</Select.Option>
 ))}
 </Select>
 </Space>
 <ResponsiveTableAdapter dataSource={files} columns={columns} loading={loading} rowKey="id" />
 </Card>

 <FormDialog
 title={t('documents.upload')}
 open={uploadModalOpen}
 onClose={() => { setUploadModalOpen(false); form.resetFields(); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleUpload}>
 <Form.Item name="name" label={t('documents.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="folder_id" label={t('documents.folder')}>
 <Select allowClear placeholder={t('documents.select_folder')}>
 {folders.map((f) => (
 <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="storage_url" label={t('documents.url_placeholder')}>
 <Input placeholder="https://..." />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Documents;
