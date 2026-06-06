import React, { useEffect, useState, useMemo } from 'react';
import { Button, Space, Input, Form, Select, Tree, Card, Row, Col, DatePicker, message, Modal, Radio } from 'antd';
import { UploadOutlined, FolderOutlined, DownloadOutlined, ShareAltOutlined, DeleteOutlined, HistoryOutlined, AppstoreOutlined, UnorderedListOutlined, FolderAddOutlined, FileTextOutlined, FilePdfOutlined, FileImageOutlined, FileExcelOutlined, FileWordOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { DataNode } from 'antd/es/tree';
import api from '../../api';
import { PageHeader, SectionCard, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
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
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('dms.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchFiles = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/documents/files', {
 params: { folder_id: selectedFolder || undefined, limit: 200 },
 });
 setFiles(res.data.items || []);
 } catch (_error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchFolders = async () => {
 try {
 const res = await api.get('/api/documents/folders', { params: { limit: 500 }});
 setFolders(res.data.items || []);
 } catch { /* noop */ }
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

 const handleShare = (_record: any) => {
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
 await api.delete(`/api/documents/files/${key}`).catch((e) => console.error(e));
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
 await api.patch(`/api/documents/files/${key}`, { tags: newTags }).catch((e) => console.error(e));
 }
 message.success(t('dms.bulk_tagged'));
 setSelectedRowKeys([]);
 setBulkDrawerOpen(false);
 void fetchFiles();
 };

 const treeData: DataNode[] = useMemo(() => {
 const _roots = folders.filter((f) => !f.parent_id);
 const _children = folders.filter((f) => f.parent_id);
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

 // Count of active client-side filters (drives the Filters button badge).
 const activeFilterCount = (filterType ? 1 : 0) + (filterTag ? 1 : 0) + (dateRange && dateRange.length === 2 ? 1 : 0);

 // Document-type segments (the entity's natural segments) wired to the existing
 // client-side `filterType` param — same param the Type status-filter controls.
 const typeOptions = [
 { value: 'pdf', label: t('dms.type_pdf', 'PDF') },
 { value: 'image', label: t('dms.type_image', 'Image') },
 { value: 'document', label: t('dms.type_document', 'Document') },
 { value: 'spreadsheet', label: t('dms.type_spreadsheet', 'Spreadsheet') },
 ];
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...typeOptions.map((o) => ({ key: o.value, label: o.label })),
 ];

 const getFileIcon = (mime: string) => {
 if (mime.includes('pdf')) return <FilePdfOutlined style={{ color: 'var(--danger-500)', fontSize: 20 }} />;
 if (mime.includes('image')) return <FileImageOutlined style={{ color: 'var(--success-500)', fontSize: 20 }} />;
 if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileExcelOutlined style={{ color: 'var(--info-500)', fontSize: 20 }} />;
 if (mime.includes('word') || mime.includes('document')) return <FileWordOutlined style={{ color: 'var(--accent-500)', fontSize: 20 }} />;
 return <FileTextOutlined style={{ color: 'var(--ink-400)', fontSize: 20 }} />;
 };

 const allColumns = [
 {
 title: t('dms.document'),
 dataIndex: 'name',
 key: 'name',
 render: (v: string, r: any) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 {getFileIcon(r.mime_type)}
 <span style={{ color: 'var(--ink-900)', fontWeight: 500, cursor: 'pointer' }} onClick={() => navigate(`/dms/${r.id}`)}>{v}</span>
 </div>
 ),
 },
 {
 title: t('dms.type'), dataIndex: 'mime_type', key: 'mime_type', width: 180,
 render: (v: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', fontFamily: 'var(--font-mono)',
 }}>{v}</span>
 ),
 },
 {
 title: t('dms.size'), dataIndex: 'size_bytes', key: 'size_bytes', width: 100,
 render: (v: number) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{`${Math.round(v / 1024)} KB`}</span>,
 },
 {
 title: t('dms.tags'),
 dataIndex: 'tags',
 key: 'tags',
 width: 200,
 render: (tags: string[]) => (
 <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
 {(tags || []).slice(0, 3).map((tag) => (
 <span key={tag} style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{tag}</span>
 ))}
 {(tags || []).length > 3 && (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>+{(tags || []).length - 3}</span>
 )}
 </div>
 ),
 },
 {
 title: t('dms.uploaded_by'), dataIndex: 'uploaded_by', key: 'uploaded_by', width: 150,
 render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
 },
 {
 title: t('dms.modified'), dataIndex: 'updated_at', key: 'updated_at', width: 150,
 render: (v: string) => <span style={{ color: 'var(--ink-500)' }}>{v ? new Date(v).toLocaleDateString() : '—'}</span>,
 },
 {
 title: '', key: 'actions', width: 56, align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('dms.preview', 'Preview'), onClick: () => navigate(`/dms/${record.id}`) },
 { key: 'download', icon: <DownloadOutlined />, label: t('dms.download', 'Download'), onClick: () => handleDownload(record) },
 { key: 'share', icon: <ShareAltOutlined />, label: t('dms.share', 'Share'), onClick: () => handleShare(record) },
 { key: 'versions', icon: <HistoryOutlined />, label: t('dms.versions', 'Versions'), onClick: () => handleVersions(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];
 const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t, navigate]);
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' && c.title ? c.title : c.key,
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('dms.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

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
 <SectionCard title={t('dms.folders')}>
 <Tree
 treeData={treeData}
 defaultExpandAll
 onSelect={(keys) => setSelectedFolder(keys[0] as string || null)}
 selectedKeys={selectedFolder ? [selectedFolder] : []}
 />
 </SectionCard>
 </Col>

 <Col span={19}>
 <KitListCard
 tabs={tabs}
 activeTab={filterType || 'all'}
 onTabChange={(k) => { setFilterType(k === 'all' ? '' : k); setSelectedRowKeys([]); }}
 toolbar={
 <>
 <KitSearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); }} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={activeFilterCount}
 onClear={() => { setFilterType(''); setFilterTag(''); setDateRange([]); }}
 >
 <Space direction="vertical" style={{ width: '100%' }} size={12}>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-600)' }}>{t('dms.type')}</div>
 <Radio.Group
 value={filterType || 'all'}
 onChange={(e) => setFilterType(e.target.value === 'all' ? '' : e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 {typeOptions.map((o) => (
 <Radio key={o.value} value={o.value}>{o.label}</Radio>
 ))}
 </Radio.Group>
 </div>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-600)' }}>{t('dms.tag')}</div>
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
 </div>
 <div>
 <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-600)' }}>{t('dms.modified')}</div>
 <RangePicker style={{ width: '100%' }} value={dateRange as any} onChange={(dates) => setDateRange(dates || [])} />
 </div>
 </Space>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('dms.type')}
 anyLabel={t('all', 'All')}
 value={filterType}
 onChange={(v) => setFilterType(v)}
 options={typeOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
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
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('documents', filteredFiles, cols);
 }}
 onPrint={() => window.print()}
 onImport={() => message.info(t('coming_soon', 'Coming soon'))}
 onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
 onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
 />
 </div>
 </>
 }
 >
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
 <div style={{ padding: 16 }}>
 <Row gutter={[16, 16]}>
 {filteredFiles.map((file) => (
 <Col key={file.id} span={6}>
 <Card
 hoverable
 cover={
 <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' }}>
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
 </div>
 )}
 </KitListCard>
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
