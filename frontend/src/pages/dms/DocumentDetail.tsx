import React, { useEffect, useState } from 'react';
import {
 Card, Descriptions, Button, Space, Tabs, Input, message, Form, Select, Tag, List, Avatar, Upload, Tooltip, DatePicker, Modal } from 'antd';
import {
 DownloadOutlined, ShareAltOutlined, DeleteOutlined, UploadOutlined,
 RollbackOutlined, UserOutlined, LinkOutlined, SendOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { TextArea } = Input;

const DocumentDetail: React.FC = () => {
 const { t } = useTranslation();
 const { docId } = useParams<{ docId: string }>();
 const navigate = useNavigate();
 const [doc, setDoc] = useState<any>(null);
 const [versions, setVersions] = useState<any[]>([]);
 const [comments, setComments] = useState<any[]>([]);
 const [shares, setShares] = useState<any[]>([]);
 const [activity, setActivity] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [commentText, setCommentText] = useState('');
 const [shareModalOpen, setShareModalOpen] = useState(false);
 const [versionModalOpen, setVersionModalOpen] = useState(false);
 const [shareForm] = Form.useForm();
 const [versionForm] = Form.useForm();

 const fetchDocument = async () => {
 if (!docId) return;
 setLoading(true);
 try {
 const res = await api.get(`/api/documents/files/${docId}`);
 setDoc(res.data);
 } catch (error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchVersions = async () => {
 if (!docId) return;
 try {
 const res = await api.get(`/api/documents/files/${docId}/versions`);
 setVersions(res.data.items || []);
 } catch {}
 };

 const fetchShares = async () => {
 if (!docId) return;
 try {
 const res = await api.get('/api/documents/shares', { params: { file_id: docId } });
 setShares(res.data.items || []);
 } catch {}
 };

 useEffect(() => {
 void fetchDocument();
 void fetchVersions();
 void fetchShares();
 }, [docId]);

 const handleDownload = () => {
 if (doc) window.open(doc.storage_url, '_blank');
 };

 const handleDelete = () => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/documents/files/${docId}`);
 message.success(t('success'));
 navigate('/dms');
 },
 });
 };

 const handleAddComment = async () => {
 if (!commentText.trim()) return;
 // Note: Comments endpoint doesn't exist in backend, placeholder only
 message.info(t('dms.comments_coming_soon'));
 setCommentText('');
 };

 const handleCreateShare = async (values: any) => {
 try {
 await api.post('/api/documents/shares', {
 file_id: docId,
 user_id: values.user_id || null,
 public_link: values.public_link || false,
 permission: values.permission || 'view',
 expires_at: values.expires_at ? values.expires_at.toISOString() : null,
 });
 message.success(t('dms.share_created'));
 setShareModalOpen(false);
 shareForm.resetFields();
 void fetchShares();
 } catch {
 message.error(t('error'));
 }
 };

 const handleRevokeShare = async (shareId: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/documents/shares/${shareId}`);
 message.success(t('dms.share_revoked'));
 void fetchShares();
 },
 });
 };

 const handleUploadVersion = async (values: any) => {
 if (!docId) return;
 try {
 await api.post(`/api/documents/files/${docId}/versions`, {
 file_id: docId,
 storage_url: values.storage_url || 'https://placeholder/version.pdf',
 size_bytes: 0,
 notes: values.notes,
 });
 message.success(t('dms.version_uploaded'));
 setVersionModalOpen(false);
 versionForm.resetFields();
 void fetchVersions();
 void fetchDocument();
 } catch {
 message.error(t('error'));
 }
 };

 const handleRestoreVersion = async (versionId: string) => {
 message.info(t('dms.restore_coming_soon'));
 };

 const versionColumns = [
 { title: t('dms.version'), dataIndex: 'version_number', key: 'version_number', width: 80 },
 { title: t('dms.uploaded_by'), dataIndex: 'uploaded_by', key: 'uploaded_by' },
 { title: t('dms.uploaded_at'), dataIndex: 'created_at', key: 'created_at', render: (v: string) => new Date(v).toLocaleString() },
 { title: t('dms.notes'), dataIndex: 'notes', key: 'notes' },
 {
 title: t('actions'),
 key: 'actions',
 width: 150,
 render: (_: any, record: any) => (
 <Space>
 <Tooltip title={t('dms.download')}>
 <Button icon={<DownloadOutlined />} onClick={() => window.open(record.storage_url, '_blank')} />
 </Tooltip>
 <Tooltip title={t('dms.restore')}>
 <Button icon={<RollbackOutlined />} onClick={() => handleRestoreVersion(record.id)} />
 </Tooltip>
 </Space>
 ),
 },
 ];

 const shareColumns = [
 {
 title: t('dms.shared_with'),
 dataIndex: 'user_id',
 key: 'user_id',
 render: (v: string, r: any) => r.public_link ? <Tag color="blue">{t('dms.public_link')}</Tag> : (v || t('dms.unknown')),
 },
 { title: t('dms.permission'), dataIndex: 'permission', key: 'permission', render: (v: string) => <Tag>{v}</Tag> },
 { title: t('dms.expires_at'), dataIndex: 'expires_at', key: 'expires_at', render: (v: string) => v ? new Date(v).toLocaleDateString() : '—' },
 {
 title: t('actions'),
 key: 'actions',
 width: 100,
 render: (_: any, record: any) => (
 <Button danger onClick={() => handleRevokeShare(record.id)}>
 {t('dms.revoke')}
 </Button>
 ),
 },
 ];

 if (!doc) {
 return <div style={{ padding: space.xl }}>{t('loading')}</div>;
 }

 return (
 <div>
 <PageHeader
 title={doc.name}
 extra={
 <Space>
 <Button icon={<DownloadOutlined />} onClick={handleDownload}>
 {t('dms.download')}
 </Button>
 <Button icon={<ShareAltOutlined />} onClick={() => { shareForm.resetFields(); setShareModalOpen(true); }}>
 {t('dms.share')}
 </Button>
 <Button icon={<DeleteOutlined />} danger onClick={handleDelete}>
 {t('delete')}
 </Button>
 </Space>
 }
 />

 <div style={{ marginTop: space.md }}>
 <Card>
 <Space direction="vertical" style={{ width: '100%' }}>
 {/* Preview */}
 <div style={{ textAlign: 'center', background: '#fafafa', padding: space.lg, borderRadius: 8 }}>
 {doc.mime_type.includes('pdf') ? (
 <iframe
 src={doc.storage_url}
 style={{ width: '100%', height: 600, border: 'none' }}
 title={doc.name}
 />
 ) : doc.mime_type.includes('image') ? (
 <img src={doc.storage_url} alt={doc.name} loading="lazy" decoding="async" style={{ maxWidth: '100%', maxHeight: 600 }} />
 ) : (
 <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <p>{t('dms.preview_not_available')}</p>
 </div>
 )}
 </div>

 {/* Metadata */}
 <Descriptions bordered column={2}>
 <Descriptions.Item label={t('dms.document_name')}>{doc.name}</Descriptions.Item>
 <Descriptions.Item label={t('dms.type')}>{doc.mime_type}</Descriptions.Item>
 <Descriptions.Item label={t('dms.size')}>{Math.round(doc.size_bytes / 1024)} KB</Descriptions.Item>
 <Descriptions.Item label={t('dms.uploaded_by')}>{doc.uploaded_by || '—'}</Descriptions.Item>
 <Descriptions.Item label={t('dms.uploaded_at')}>{new Date(doc.created_at).toLocaleString()}</Descriptions.Item>
 <Descriptions.Item label={t('dms.version')}>{doc.version || 1}</Descriptions.Item>
 <Descriptions.Item label={t('dms.tags')} span={2}>
 {(doc.tags || []).map((tag: string) => <Tag key={tag}>{tag}</Tag>)}
 </Descriptions.Item>
 </Descriptions>
 </Space>
 </Card>

 {/* Tabs */}
 <Card style={{ marginTop: space.md }}>
 <Tabs
 items={[
 {
 key: 'versions',
 label: t('dms.versions'),
 children: (
 <>
 <Button
 icon={<UploadOutlined />}
 onClick={() => { versionForm.resetFields(); setVersionModalOpen(true); }}
 style={{ marginBottom: space.md }}
 >
 {t('dms.upload_new_version')}
 </Button>
 <ResponsiveTableAdapter dataSource={versions} columns={versionColumns} rowKey="id" pagination={{ pageSize: 10 }} />
 </>
 ),
 },
 {
 key: 'comments',
 label: t('dms.comments'),
 children: (
 <>
 <Space direction="vertical" style={{ width: '100%' }}>
 <div>
 <TextArea
 rows={3}
 placeholder={t('dms.add_comment')}
 value={commentText}
 onChange={(e) => setCommentText(e.target.value)}
 />
 <Button
 type="primary"
 icon={<SendOutlined />}
 onClick={handleAddComment}
 style={{ marginTop: space.sm }}
 >
 {t('dms.post')}
 </Button>
 </div>
 <List
 dataSource={comments}
 locale={{ emptyText: t('dms.no_comments') }}
 renderItem={(item: any) => (
 <List.Item>
 <List.Item.Meta
 avatar={<Avatar icon={<UserOutlined />} />}
 title={item.user}
 description={item.text}
 />
 </List.Item>
 )}
 />
 </Space>
 </>
 ),
 },
 {
 key: 'activity',
 label: t('dms.activity'),
 children: (
 <List
 dataSource={activity}
 locale={{ emptyText: t('dms.no_activity') }}
 renderItem={(item: any) => (
 <List.Item>
 <List.Item.Meta
 title={item.action}
 description={`${item.user} • ${new Date(item.timestamp).toLocaleString()}`}
 />
 </List.Item>
 )}
 />
 ),
 },
 {
 key: 'sharing',
 label: t('dms.sharing'),
 children: (
 <>
 <Button
 icon={<LinkOutlined />}
 onClick={() => { shareForm.resetFields(); setShareModalOpen(true); }}
 style={{ marginBottom: space.md }}
 >
 {t('dms.generate_share_link')}
 </Button>
 <ResponsiveTableAdapter dataSource={shares} columns={shareColumns} rowKey="id" pagination={{ pageSize: 10 }} />
 </>
 ),
 },
 ]}
 />
 </Card>
 </div>

 {/* Share Modal */}
 <FormDialog
 title={t('dms.share_document')}
 open={shareModalOpen}
 onClose={() => { setShareModalOpen(false); shareForm.resetFields(); }}
 onOk={() => shareForm.submit()}
 >
 <Form form={shareForm} layout="vertical" onFinish={handleCreateShare}>
 <Form.Item name="user_id" label={t('dms.user_email')}>
 <Input placeholder={t('dms.email_optional')} />
 </Form.Item>
 <Form.Item name="public_link" valuePropName="checked">
 <span>{t('dms.generate_public_link')}</span>
 </Form.Item>
 <Form.Item name="permission" label={t('dms.permission')} initialValue="view">
 <Select>
 <Select.Option value="view">{t('dms.view')}</Select.Option>
 <Select.Option value="comment">{t('dms.comment')}</Select.Option>
 <Select.Option value="edit">{t('dms.edit')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="expires_at" label={t('dms.expiry')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Form>
 </FormDialog>

 {/* New Version Modal */}
 <FormDialog
 title={t('dms.upload_new_version')}
 open={versionModalOpen}
 onClose={() => { setVersionModalOpen(false); versionForm.resetFields(); }}
 onOk={() => versionForm.submit()}
 >
 <Form form={versionForm} layout="vertical" onFinish={handleUploadVersion}>
 <Form.Item name="storage_url" label={t('dms.file_url')} rules={[{ required: true }]}>
 <Input placeholder="https://..." />
 </Form.Item>
 <Form.Item name="notes" label={t('dms.version_notes')}>
 <TextArea rows={3} placeholder={t('dms.what_changed')} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default DocumentDetail;
