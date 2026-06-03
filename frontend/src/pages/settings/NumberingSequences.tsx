import React, { useMemo, useState, useEffect } from 'react';
import { Button, Form, Input, InputNumber, Select, message, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Option } = Select;

interface Branch {
 id: string;
 name: string;
 code: string;
}

interface NumberingSequence {
 id: string;
 branch_id: string;
 doc_type: string;
 prefix: string;
 padding: number;
 format: string;
 next_value: number;
 created_at: string;
}

const DOC_TYPES = [
 'invoice',
 'sales_order',
 'purchase_order',
 'credit_note',
 'bill',
 'receipt'
];

const NumberingSequences: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [form] = Form.useForm();
 const [loading, setLoading] = useState(false);
 const [sequences, setSequences] = useState<NumberingSequence[]>([]);
 const [branches, setBranches] = useState<Branch[]>([]);
 const [modalVisible, setModalVisible] = useState(false);
 const [editingSequence, setEditingSequence] = useState<NumberingSequence | null>(null);
 // Client-side doc_type segment (no server filter param exists; filters the
 // already-fetched in-memory list — pure presentation, no query/logic change).
 const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
 // Client-side free-text search (purely in-memory; no backend search param exists).
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('numbering_sequences.hiddenCols') || '[]'); } catch { return []; }
 });

 useEffect(() => {
 fetchSequences();
 fetchBranches();
 }, []);

 const fetchSequences = async () => {
 setLoading(true);
 try {
 const response = await api.get('/numbering/sequences');
 setSequences(response.data.items || []);
 } catch (_error) {
 message.error(t('errors.fetch_failed'));
 } finally {
 setLoading(false);
 }
 };

 const fetchBranches = async () => {
 try {
 const response = await api.get('/api/branches');
 // API returns a plain array; guard against unexpected shapes
 const data = response.data;
 setBranches(Array.isArray(data) ? data : (data?.items ?? data?.branches ?? []));
 } catch (error) {
 console.error('Failed to fetch branches', error);
 }
 };

 const handleCreate = () => {
 setEditingSequence(null);
 form.resetFields();
 form.setFieldsValue({
 prefix: 'DOC',
 padding: 6,
 format: '{prefix}-{branch_code}-{year}-{seq}',
 next_value: 1,
 });
 setModalVisible(true);
 };

 const handleEdit = (record: NumberingSequence) => {
 setEditingSequence(record);
 form.setFieldsValue(record);
 setModalVisible(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: NumberingSequence) => {
 setEditingSequence(null);
 const { id: _id, created_at: _createdAt, ...rest } = record;
 form.setFieldsValue(rest);
 setModalVisible(true);
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/numbering/sequences/${id}`);
 message.success(t('success.deleted'));
 fetchSequences();
 } catch (error: any) {
 message.error(error.response?.data?.detail || t('errors.operation_failed'));
 }
 };

 const handleSubmit = async () => {
 try {
 const values = await form.validateFields();
 
 if (editingSequence) {
 // Update
 await api.put(`/numbering/sequences/${editingSequence.id}`, values);
 message.success(t('success.updated'));
 } else {
 // Create
 await api.post('/numbering/sequences', values);
 message.success(t('success.created'));
 }
 
 setModalVisible(false);
 fetchSequences();
 } catch (error: any) {
 if (error.response?.data?.detail) {
 message.error(error.response.data.detail);
 } else if (error.errorFields) {
 message.error(t('errors.validation_failed'));
 } else {
 message.error(t('errors.operation_failed'));
 }
 }
 };

 const getBranchName = (branchId: string) => {
 const branch = branches.find(b => b.id === branchId);
 return branch ? branch.name : branchId;
 };

 const generatePreview = () => {
 const prefix = form.getFieldValue('prefix') || 'DOC';
 const padding = form.getFieldValue('padding') || 6;
 const format = form.getFieldValue('format') || '{prefix}-{seq}';
 const nextValue = form.getFieldValue('next_value') || 1;
 const branchId = form.getFieldValue('branch_id');
 
 const branch = branches.find(b => b.id === branchId);
 const branchCode = branch?.code || 'BR';
 const year = new Date().getFullYear();
 const seq = String(nextValue).padStart(padding, '0');
 
 const preview = format
 .replace('{prefix}', prefix)
 .replace('{branch_code}', branchCode)
 .replace('{year}', String(year))
 .replace('{seq}', seq);
 
 return preview;
 };

 const allColumns = [
 {
 title: t('numbering.branch'),
 dataIndex: 'branch_id',
 key: 'branch_id',
 render: (branchId: string) => {
 const name = getBranchName(branchId);
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{String(name || '?').trim().slice(0, 2).toUpperCase()}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{name}</span>
 </div>
 );
 },
 },
 {
 title: t('numbering.doc_type'),
 dataIndex: 'doc_type',
 key: 'doc_type',
 render: (docType: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(`numbering.${docType}`)}</span>
 ),
 },
 {
 title: t('numbering.prefix'),
 dataIndex: 'prefix',
 key: 'prefix',
 render: (prefix: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{prefix}</span>
 ),
 },
 {
 title: t('numbering.format_template'),
 dataIndex: 'format',
 key: 'format',
 render: (format: string) => (
 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-500)' }}>{format}</span>
 ),
 },
 {
 title: t('numbering.next_value'),
 dataIndex: 'next_value',
 key: 'next_value',
 render: (value: number) => <StatusTag status="info" label={String(value)} />,
 },
 {
 title: t('numbering.example'),
 key: 'preview',
 render: (_: any, record: NumberingSequence) => {
 const branch = branches.find(b => b.id === record.branch_id);
 const branchCode = branch?.code || 'BR';
 const year = new Date().getFullYear();
 const seq = String(record.next_value).padStart(record.padding, '0');

 const preview = record.format
 .replace('{prefix}', record.prefix)
 .replace('{branch_code}', branchCode)
 .replace('{year}', String(year))
 .replace('{seq}', seq);

 return <StatusTag status="success" label={preview} />;
 },
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: NumberingSequence) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];

 // Client-side doc_type segment + free-text search applied to the already-fetched list.
 const filteredSequences = useMemo(() => {
 const byType = docTypeFilter === 'all' ? sequences : sequences.filter((s) => s.doc_type === docTypeFilter);
 if (!search) return byType;
 const q = search.toLowerCase();
 return byType.filter((row: any) =>
 Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
 );
 }, [sequences, docTypeFilter, search]);

 const columns = useMemo(
 () => allColumns.filter((c) => !hiddenCols.includes(c.key)),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [hiddenCols, t, branches],
 );
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: c.key,
 label: typeof c.title === 'string' && c.title ? c.title : c.key,
 pinned: c.key === 'branch_id' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('numbering_sequences.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 // Tabs + Status filter share the same client-side doc_type segment.
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All') },
 ...DOC_TYPES.map((dt) => ({ key: dt, label: t(`numbering.${dt}`) })),
 ];
 const docTypeOptions = DOC_TYPES.map((dt) => ({ value: dt, label: t(`numbering.${dt}`) }));

 return (
 <div>
   {/* Settings breadcrumb / back button */}
   <button
     onClick={() => navigate('/settings?s=numbering')}
     style={{
       display: 'flex',
       alignItems: 'center',
       gap: 8,
       background: 'none',
       border: 'none',
       cursor: 'pointer',
       color: 'var(--accent-500)',
       fontSize: 13,
       fontWeight: 500,
       padding: '0 0 12px',
       marginBottom: 4,
     }}
   >
     <ArrowLeftOutlined style={{ fontSize: 12 }} />
     <SettingOutlined style={{ fontSize: 12 }} />
     <span>{t('settings', 'Settings')} — {t('numbering_sequences', 'Numbering')}</span>
   </button>

 <PageHeader
 title={t('numbering.sequences')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('numbering.create_sequence')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={docTypeFilter}
 onTabChange={(k) => setDocTypeFilter(k)}
 toolbar={
 <>
 <KitSearchInput
 value={search}
 onChange={(v) => setSearch(v)}
 placeholder={t('search')}
 />
 {/* Group Filters + Status in a single flex unit so they ALWAYS wrap
 together to the same line — never one stranded on a row by itself. */}
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={docTypeFilter !== 'all' ? 1 : 0}
 onClear={() => setDocTypeFilter('all')}
 >
 <Radio.Group
 value={docTypeFilter}
 onChange={(e) => setDocTypeFilter(e.target.value)}
 style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
 >
 <Radio value="all">{t('all', 'All')}</Radio>
 {DOC_TYPES.map((dt) => (
 <Radio key={dt} value={dt}>{t(`numbering.${dt}`)}</Radio>
 ))}
 </Radio.Group>
 </KitFiltersButton>
 <KitStatusFilter
 label={t('numbering.doc_type')}
 anyLabel={t('all', 'All')}
 value={docTypeFilter === 'all' ? '' : docTypeFilter}
 onChange={(v) => setDocTypeFilter(v || 'all')}
 options={docTypeOptions}
 />
 </div>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('numbering_sequences', filteredSequences, cols);
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
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={filteredSequences}
 loading={loading}
 rowKey="id"
 pagination={false}
 />
 </KitListCard>

 <FormDialog
 title={editingSequence ? t('numbering.edit_sequence') : t('numbering.create_sequence')}
 open={modalVisible}
 onOk={handleSubmit}
 onClose={() => setModalVisible(false)}
 >
 <Form
 form={form}
 layout="vertical"
 >
 <Form.Item
 name="branch_id"
 label={t('numbering.branch')}
 rules={[{ required: true, message: t('errors.required') }]}
 >
 <Select
 placeholder={t('numbering.branch')}
 disabled={!!editingSequence}
 >
 {branches.map(branch => (
 <Option key={branch.id} value={branch.id}>
 {branch.name} ({branch.code})
 </Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item
 name="doc_type"
 label={t('numbering.doc_type')}
 rules={[{ required: true, message: t('errors.required') }]}
 >
 <Select
 placeholder={t('numbering.doc_type')}
 disabled={!!editingSequence}
 >
 {DOC_TYPES.map(type => (
 <Option key={type} value={type}>
 {t(`numbering.${type}`)}
 </Option>
 ))}
 </Select>
 </Form.Item>

 <Form.Item
 name="prefix"
 label={t('numbering.prefix')}
 rules={[{ required: true, message: t('errors.required') }]}
 >
 <Input placeholder="INV" />
 </Form.Item>

 <Form.Item
 name="padding"
 label={t('numbering.padding')}
 rules={[{ required: true, message: t('errors.required') }]}
 >
 <InputNumber min={1} max={10} style={{ width: '100%' }} />
 </Form.Item>

 <Form.Item
 name="format"
 label={t('numbering.format_template')}
 rules={[{ required: true, message: t('errors.required') }]}
 extra={t('numbering.format_hint')}
 >
 <Input placeholder="{prefix}-{branch_code}-{year}-{seq}" />
 </Form.Item>

 <Form.Item
 name="next_value"
 label={t('numbering.next_value')}
 rules={[{ required: true, message: t('errors.required') }]}
 >
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>

 <div style={{ marginTop: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
 <strong>{t('numbering.sequence_preview')}:</strong>
 <div style={{ marginTop: 8, fontSize: 16, color: 'var(--success-fg)', fontVariantNumeric: 'tabular-nums' }}>
 {generatePreview()}
 </div>
 </div>
 </Form>
 </FormDialog>
 </div>
 );
};

export default NumberingSequences;
