import React, { useState, useEffect } from 'react';
import { Button, Form, Input, InputNumber, Select, message, Space, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
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

 const columns = [
 {
 title: t('numbering.branch'),
 dataIndex: 'branch_id',
 key: 'branch_id',
 render: (branchId: string) => getBranchName(branchId),
 },
 {
 title: t('numbering.doc_type'),
 dataIndex: 'doc_type',
 key: 'doc_type',
 render: (docType: string) => t(`numbering.${docType}`),
 },
 {
 title: t('numbering.prefix'),
 dataIndex: 'prefix',
 key: 'prefix',
 render: (prefix: string) => <Tag>{prefix}</Tag>,
 },
 {
 title: t('numbering.format_template'),
 dataIndex: 'format',
 key: 'format',
 render: (format: string) => <code style={{ fontSize: 11, color: 'var(--ink-700)' }}>{format}</code>,
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
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: NumberingSequence) => (
 <Space>
 <Button
 icon={<EditOutlined />}
 onClick={() => handleEdit(record)}
 />
 <Popconfirm
 title={t('confirm.delete')}
 onConfirm={() => handleDelete(record.id)}
 >
 <Button
 icon={<DeleteOutlined />}
 danger
 />
 </Popconfirm>
 </Space>
 ),
 },
 ];

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

 <SectionCard padded={false}>
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={sequences}
 loading={loading}
 rowKey="id"
 pagination={false}
 />
 </SectionCard>

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
