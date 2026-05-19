import React, { useEffect, useState, useMemo } from 'react';
import {
 Button, Space, Upload, Input, Form, Select, Tag, Tree, Card,
 Tooltip, Row, Col, DatePicker, Checkbox, message, List, Avatar, Modal } from 'antd';
import {
 PlusOutlined, UploadOutlined, FolderOutlined, FileOutlined, DownloadOutlined,
 ShareAltOutlined, DeleteOutlined, HistoryOutlined, AppstoreOutlined,
 UnorderedListOutlined, SearchOutlined, FolderAddOutlined, FileTextOutlined,
 FilePdfOutlined, FileImageOutlined, FileExcelOutlined, FileWordOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { DataNode } from 'antd/es/tree';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { RangePicker } = DatePicker;

const DocumentVault: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [files, setFiles] = useState<any[]>([]);
 const [folders, setFolders] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
 const [uploadModalOpen, setUploadModalOpen] = useState(false);
 const [folderModalOpen, setFolderModalOpen] = useState(false);
 const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
 const [filterType, setFilterType] = useState<string>('');
 const [filterTag, setFilterTag] = useState<string>('');
 const [dateRange, setDateRange] = useState<any[]>([]);
 const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
 const [form] = Form.useForm();
 const [folderForm] = Form.useForm();

 const fetchFiles = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/documents/files', {
 params: { folder_id: selectedFolder || undefined, limit: 200 },
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
 const res = await api.get('/api/documents/folders', { params: { limit: 500 }});
 setFolders(res.data.items || []);
 } catch {}
 };

 useEffect(() => {
 void fetchFiles();
 void fetchFolders();
 }, [selectedFolder]);

 const handleUpload = async (values: any) => {
 try {
 // Note: Actual multipart upload needs more work - this is placeholder
 await api.post('/api/documents/files', {
 name: values.name,
 folder_id: selectedFolder || values.folder_id || null,
 storage_url: values.storage_url || `https://placeholder/${values.name}`,
 mime_type: values.mime_type || 'application/octet-stream',
 size_bytes: 0,
 tags: values.tags || [],
 });
 message.success(t('dms.uploaded'));
 setUploadModalOpen(false);
 form.resetFields();
 void fetchFiles();
 } catch {
 message.error(t('error'));
 }
 };

 const handleCreateFolder = async (values: any) => {
 try {
 await api.post('/api/documents/folders', {
 name: values.name,
 parent_id: selectedFolder || values.parent_id || null,
 description: values.description,
 });
 message.success(t('dms.folder_created'));
 setFolderModalOpen(false);
 folderForm.resetFields();
 void fetchFolders();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDownload = (record: any) => {
 window.open(record.storage_url, '_blank');
 };

 const handleShare = (record: any) => {
 message.info(t('dms.share_coming_soon'));
 };

 const handleVersions = (record: any) => {
 navigate(`/dms/${record.id}`);
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

 const handleBulkDelete = async () => {
 if (selectedRowKeys.length === 0) return;
 Modal.confirm({
 title: t('dms.bulk_delete_confirm', { count: selectedRowKeys.length }),
 onOk: async () => {
 for (const key of selectedRowKeys) {
 await api.delete(`/api/documents/files/${key}`).catch(() => {});
 }
 message.success(t('dms.bulk_deleted'));
 setSelectedRowKeys([]);
 setBulkDrawerOpen(false);
 void fetchFiles();
 },
 });
 };

 const handleBulkTag = async (tag: string) => {
 if (selectedRowKeys.length === 0) return;
 for (const key of selectedRowKeys) {
 const file = files.find((f) => f.id === key);
 if (!file) continue;
 const newTags = [...(file.tags || []), tag];
 await api.patch(`/api/documents/files/${key}`, { tags: newTags }).catch(() => {});
 }
 message.success(t('dms.bulk_tagged'));
 setSelectedRowKeys([]);
 setBulkDrawerOpen(false);
 void fetchFiles();
 };

 const treeData: DataNode[] = useMemo(() => {
 const roots = folders.filter((f) => !f.parent_id);
 const children = folders.filter((f) => f.parent_id);
 const buildTree = (parentId: string | null): DataNode[] => {
 return folders
 .filter((f) => f.parent_id === parentId)
 .map((f) => ({
 title: f.name,
 key: f.id,
 icon: <FolderOutlined />,
 children: buildTree(f.id),
 }));
 };
 return [
 { title: t('dms.root'), key: null as any, icon: <FolderOutlined />, children: buildTree(null) },
 ];
 }, [folders, t]);

 const filteredFiles = useMemo(() => {
 let result = files;
 if (searchQuery) {
 const q = searchQuery.toLowerCase();
 result = result.filter((f) => f.name.toLowerCase().includes(q) || (f.tags || []).some((tag: string) => tag.toLowerCase().includes(q)));
 }
 if (filterType) {
 result = result.filter((f) => f.mime_type.includes(filterType));
 }
 if (filterTag) {
 result = result.filter((f) => (f.tags || []).includes(filterTag));
 }
 if (dateRange && dateRange.length === 2) {
 const [start, end] = dateRange;
 result = result.filter((f) => {
 const created = new Date(f.created_at);
 return created >= start && created <= end;
 });
 }
 return result;
 }, [files, searchQuery, filterType, filterTag, dateRange]);

 const allTags = useMemo(() => {
 const tagSet = new Set<string>();
 files.forEach((f) => (f.tags || []).forEach((tag: string) => tagSet.add(tag)));
 return Array.from(tagSet);
 }, [files]);

 const getFileIcon = (mime: string) => {
 if (mime.includes('pdf')) return <FilePdfOutlined style={{ color: '#f5222d', fontSize: 20 }} />;
 if (mime.includes('image')) return <FileImageOutlined style={{ color: '#52c41a', fontSize: 20 }} />;
 if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileExcelOutlined style={{ color: '#13c2c2', fontSize: 20 }} />;
 if (mime.includes('word') || mime.includes('document')) return <FileWordOutlined style={{ color: '#1890ff', fontSize: 20 }} />;
 return <FileTextOutlined style={{ fontSize: 20 }} />;
 };

 const columns = [
 {
 title: t('dms.document'),
 dataIndex: 'name',
 key: 'name',
 render: (v: string, r: any) => (
 <Space>
 {getFileIcon(r.mime_type)}
 <a onClick={() => navigate(`/dms/${r.id}`)}>{v}</a>
 </Space>
 ),
 },
 { title: t('dms.type'), dataIndex: 'mime_type', key: 'mime_type', width: 180 },
 { title: t('dms.size'), dataIndex: 'size_bytes', key: 'size_bytes', width: 100, render: (v: number) => `${Math.round(v / 1024)} KB` },
 {
 title: t('dms.tags'),
 dataIndex: 'tags',
 key: 'tags',
 width: 200,
 render: (tags: string[]) => (
 <>
 {(tags || []).slice(0, 3).map((tag) => (
 <Tag key={tag}>{tag}</Tag>
 ))}
 {(tags || []).length > 3 && <Tag>+{(tags || []).length - 3}</Tag>}
 </>
 ),
 },
 { title: t('dms.uploaded_by'), dataIndex: 'uploaded_by', key: 'uploaded_by', width: 150 },
 { title: t('dms.modified'), dataIndex: 'updated_at', key: 'updated_at', width: 150, render: (v: string) => v ? new Date(v).toLocaleDateString() : '—' },
 {
 title: t('actions'),
 key: 'actions',
 width: 200,
 render: (_: any, record: any) => (
 <Space>
 <Tooltip title={t('dms.preview')}>
 <Button icon={<FileOutlined />} onClick={() => navigate(`/dms/${record.id}`)} />
 </Tooltip>
 <Tooltip title={t('dms.download')}>
 <Button icon={<DownloadOutlined />} onClick={() => handleDownload(record)} />
 </Tooltip>
 <Tooltip title={t('dms.share')}>
 <Button icon={<ShareAltOutlined />} onClick={() => handleShare(record)} />
 </Tooltip>
 <Tooltip title={t('dms.versions')}>
 <Button icon={<HistoryOutlined />} onClick={() => handleVersions(record)} />
 </Tooltip>
 <Tooltip title={t('delete')}>
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Tooltip>
 </Space>
 ),
 },
 ];

 const rowSelection = {
 selectedRowKeys,
 onChange: setSelectedRowKeys,
 };

 return (
 <div>
 <PageHeader
 title={t('dms.vault')}
 subtitle={t('dms.vault_subtitle')}
 extra={
 <Space>
 <Button icon={<UploadOutlined />} onClick={() => { form.resetFields(); setUploadModalOpen(true); }}>
 {t('dms.upload')}
 </Button>
 <Button icon={<FolderAddOutlined />} onClick={() => { folderForm.resetFields(); setFolderModalOpen(true); }}>
 {t('dms.new_folder')}
 </Button>
 {selectedRowKeys.length > 0 && (
 <Button type="primary" onClick={() => setBulkDrawerOpen(true)}>
 {t('dms.bulk_actions', { count: selectedRowKeys.length })}
 </Button>
 )}
 </Space>
 }
 />

 <Row gutter={16} style={{ marginTop: space.md }}>
 <Col span={5}>
 <Card title={t('dms.folders')}>
 <Tree
 treeData={treeData}
 defaultExpandAll
 onSelect={(keys) => setSelectedFolder(keys[0] as string || null)}
 selectedKeys={selectedFolder ? [selectedFolder] : []}
 />
 </Card>
 </Col>

 <Col span={19}>
 <Card>
 <Space direction="vertical" style={{ width: '100%' }}>
 <Row gutter={16}>
 <Col span={10}>
 <Input
 placeholder={t('dms.search')}
 prefix={<SearchOutlined />}
 allowClear
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </Col>
 <Col span={4}>
 <Select
 placeholder={t('dms.type')}
 allowClear
 style={{ width: '100%' }}
 value={filterType || undefined}
 onChange={(v) => setFilterType(v || '')}
 >
 <Select.Option value="pdf">PDF</Select.Option>
 <Select.Option value="image">Image</Select.Option>
 <Select.Option value="document">Document</Select.Option>
 <Select.Option value="spreadsheet">Spreadsheet</Select.Option>
 </Select>
 </Col>
 <Col span={4}>
 <Select
 placeholder={t('dms.tag')}
 allowClear
 style={{ width: '100%' }}
 value={filterTag || undefined}
 onChange={(v) => setFilterTag(v || '')}
 >
 {allTags.map((tag) => (
 <Select.Option key={tag} value={tag}>{tag}</Select.Option>
 ))}
 </Select>
 </Col>
 <Col span={4}>
 <RangePicker style={{ width: '100%' }} onChange={(dates) => setDateRange(dates || [])} />
 </Col>
 <Col span={2} style={{ textAlign: 'right' }}>
 <Button.Group>
 <Button
 icon={<UnorderedListOutlined />}
 type={viewMode === 'list' ? 'primary' : 'default'}
 onClick={() => setViewMode('list')}
 />
 <Button
 icon={<AppstoreOutlined />}
 type={viewMode === 'grid' ? 'primary' : 'default'}
 onClick={() => setViewMode('grid')}
 />
 </Button.Group>
 </Col>
 </Row>

 {viewMode === 'list' ? (
 <ResponsiveTableAdapter
 dataSource={filteredFiles}
 columns={columns}
 loading={loading}
 rowKey="id"
 rowSelection={rowSelection}
 pagination={{ pageSize: 50, showSizeChanger: true }}
 />
 ) : (
 <Row gutter={[16, 16]}>
 {filteredFiles.map((file) => (
 <Col key={file.id} span={6}>
 <Card
 hoverable
 cover={
 <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
 {getFileIcon(file.mime_type)}
 </div>
 }
 actions={[
 <DownloadOutlined key="download" onClick={() => handleDownload(file)} />,
 <ShareAltOutlined key="share" onClick={() => handleShare(file)} />,
 <DeleteOutlined key="delete" onClick={() => handleDelete(file.id)} />,
 ]}
 >
 <Card.Meta
 title={<a onClick={() => navigate(`/dms/${file.id}`)}>{file.name}</a>}
 description={`${Math.round(file.size_bytes / 1024)} KB`}
 />
 </Card>
 </Col>
 ))}
 </Row>
 )}
 </Space>
 </Card>
 </Col>
 </Row>

 {/* Upload Modal */}
 <FormDialog
 title={t('dms.upload')}
 open={uploadModalOpen}
 onClose={() => { setUploadModalOpen(false); form.resetFields(); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleUpload}>
 <Form.Item name="name" label={t('dms.document_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="folder_id" label={t('dms.folder')}>
 <Select allowClear placeholder={t('dms.select_folder')}>
 {folders.map((f) => (
 <Select.Option key={f.id} value={f.id}><FolderOutlined /> {f.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="tags" label={t('dms.tags')}>
 <Select mode="tags" placeholder={t('dms.add_tags')} />
 </Form.Item>
 <Form.Item name="storage_url" label={t('dms.url_or_file')}>
 <Input placeholder="https://..." />
 </Form.Item>
 </Form>
 </FormDialog>

 {/* New Folder Modal */}
 <FormDialog
 title={t('dms.new_folder')}
 open={folderModalOpen}
 onClose={() => { setFolderModalOpen(false); folderForm.resetFields(); }}
 onOk={() => folderForm.submit()}
 >
 <Form form={folderForm} layout="vertical" onFinish={handleCreateFolder}>
 <Form.Item name="name" label={t('dms.folder_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="parent_id" label={t('dms.parent_folder')}>
 <Select allowClear placeholder={t('dms.root')}>
 {folders.map((f) => (
 <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="description" label={t('description')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 </Form>
 </FormDialog>

 {/* Bulk Actions Drawer */}
 <FormDialog
 title={t('dms.bulk_actions', { count: selectedRowKeys.length })}
 open={bulkDrawerOpen}
 onClose={() => setBulkDrawerOpen(false)}
 >
 <Space direction="vertical" style={{ width: '100%' }}>
 <Button block icon={<DeleteOutlined />} danger onClick={handleBulkDelete}>
 {t('dms.bulk_delete')}
 </Button>
 <div>
 <p>{t('dms.add_tag_to_selected')}</p>
 <Select
 style={{ width: '100%' }}
 placeholder={t('dms.select_tag')}
 onChange={handleBulkTag}
 >
 {allTags.map((tag) => (
 <Select.Option key={tag} value={tag}>{tag}</Select.Option>
 ))}
 </Select>
 </div>
 </Space>
 </FormDialog>
 </div>
 );
};

export default DocumentVault;
