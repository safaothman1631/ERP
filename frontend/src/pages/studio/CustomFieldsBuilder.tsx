import type React from 'react';
import { useState, useEffect } from 'react';
import { Button, Space, Form, Input, Select, Switch, Tag, Popconfirm } from 'antd';
import { message } from '../../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, EmptyState } from '../../design-system';
import { space } from '../../theme/tokens';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface CustomField {
 id: string;
 entity_type: string;
 field_name: string;
 field_label: string;
 field_label_ku?: string;
 field_type: string;
 options?: string[];
 is_required: boolean;
 is_active: boolean;
 sort_order: number;
}

const fieldTypeOptions = [
 { value: 'text', label: 'Text' },
 { value: 'number', label: 'Number' },
 { value: 'date', label: 'Date' },
 { value: 'select', label: 'Select (Dropdown)' },
 { value: 'multi_select', label: 'Multi-Select' },
 { value: 'boolean', label: 'Boolean (Yes/No)' },
 { value: 'currency', label: 'Currency' },
 { value: 'reference', label: 'Reference (Linked Entity)' },
];

const CustomFieldsBuilder: React.FC = () => {
 const { t } = useTranslation();
 const { entity } = useParams<{ entity: string }>();
 const navigate = useNavigate();
 const [fields, setFields] = useState<CustomField[]>([]);
 const [loading, setLoading] = useState(false);
 const [drawerVisible, setDrawerVisible] = useState(false);
 const [form] = Form.useForm();
 const [editId, setEditId] = useState<string | null>(null);
 const [fieldType, setFieldType] = useState<string>('text');

 useEffect(() => {
 if (entity) {
 void fetchFields();
 }
 }, [entity]);

 const fetchFields = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/custom-fields', { params: { entity_type: entity } });
 const sorted = (res.data || []).sort((a: CustomField, b: CustomField) => a.sort_order - b.sort_order);
 setFields(sorted);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleSubmit = async (values: any) => {
 try {
 const payload = {
 entity_type: entity,
 field_name: values.field_name,
 field_label: values.field_label,
 field_label_ku: values.field_label_ku || '',
 field_type: values.field_type,
 options: values.options ? values.options.split(',').map((o: string) => o.trim()) : [],
 is_required: values.is_required || false,
 sort_order: editId ? undefined : fields.length,
 };

 if (editId) {
 await api.put(`/api/custom-fields/${editId}`, payload);
 message.success(t('updated'));
 } else {
 await api.post('/api/custom-fields', payload);
 message.success(t('created'));
 }

 setDrawerVisible(false);
 form.resetFields();
 setEditId(null);
 void fetchFields();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/custom-fields/${id}`);
 message.success(t('deleted'));
 void fetchFields();
 } catch {
 message.error(t('error'));
 }
 };

 const handleEdit = (record: CustomField) => {
 setEditId(record.id);
 setFieldType(record.field_type);
 form.setFieldsValue({
 field_name: record.field_name,
 field_label: record.field_label,
 field_label_ku: record.field_label_ku || '',
 field_type: record.field_type,
 options: record.options?.join(', ') || '',
 is_required: record.is_required,
 });
 setDrawerVisible(true);
 };

 const handleReorder = async (index: number, direction: 'up' | 'down') => {
 const newIndex = direction === 'up' ? index - 1 : index + 1;
 if (newIndex < 0 || newIndex >= fields.length) return;

 const reordered = [...fields];
 const [moved] = reordered.splice(index, 1);
 reordered.splice(newIndex, 0, moved);

 const updates = reordered.map((f, i) => ({ id: f.id, sort_order: i }));
 setFields(reordered);

 try {
 await Promise.all(updates.map((u) => api.put(`/api/custom-fields/${u.id}`, { sort_order: u.sort_order })));
 } catch {
 message.error(t('error'));
 void fetchFields();
 }
 };

 const columns = [
 {
 title: t('studio.field_name', 'Field Name'),
 dataIndex: 'field_name',
 key: 'field_name',
 render: (v: string) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>,
 },
 {
 title: t('studio.field_label', 'Label (EN)'),
 dataIndex: 'field_label',
 key: 'field_label',
 },
 {
 title: t('studio.field_label_ku', 'Label (KU)'),
 dataIndex: 'field_label_ku',
 key: 'field_label_ku',
 render: (v: string) => v || <Tag>—</Tag>,
 },
 {
 title: t('studio.field_type', 'Type'),
 dataIndex: 'field_type',
 key: 'field_type',
 render: (v: string) => <Tag color="blue">{v}</Tag>,
 },
 {
 title: t('required'),
 dataIndex: 'is_required',
 key: 'is_required',
 render: (v: boolean) => (v ? <Tag color="red">{t('yes')}</Tag> : <Tag>{t('no')}</Tag>),
 },
 {
 title: t('studio.order', 'Order'),
 key: 'order',
 width: 120,
 render: (_: any, __: any, index: number) => (
 <Space>
 <Button
 icon={<ArrowUpOutlined />}
 disabled={index === 0}
 onClick={() => handleReorder(index, 'up')}
 />
 <Button
 icon={<ArrowDownOutlined />}
 disabled={index === fields.length - 1}
 onClick={() => handleReorder(index, 'down')}
 />
 </Space>
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 120,
 render: (_: any, record: CustomField) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(record.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('studio.custom_fields_builder', 'Custom Fields Builder')}
 subtitle={t('studio.entity_fields', { entity: t(entity || '') })}
 breadcrumb={[
 { label: t('home'), to: '/' },
 { label: t('studio.title'), to: '/studio' },
 { label: t(entity || '') },
 ]}
 extra={
 <Space>
 <Button onClick={() => navigate(`/studio/${entity}/layout`)}>
 {t('studio.view_layout', 'View Layout')}
 </Button>
 <Button onClick={() => navigate(`/studio/${entity}/automation`)}>
 {t('studio.automation', 'Automation')}
 </Button>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 setEditId(null);
 setFieldType('text');
 form.resetFields();
 setDrawerVisible(true);
 }}
 >
 {t('studio.add_field', 'Add Field')}
 </Button>
 </Space>
 }
 />

 {fields.length === 0 && !loading ? (
 <EmptyState
 title={t('studio.no_custom_fields', 'No custom fields yet')}
 description={t('studio.no_custom_fields_desc', 'No custom fields have been added to this entity')}
 actionLabel={t('studio.add_first_field', 'Add your first custom field')}
 onAction={() => {
 setEditId(null);
 setFieldType('text');
 form.resetFields();
 setDrawerVisible(true);
 }}
 />
 ) : (
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={fields}
 rowKey="id"
 loading={loading}
 pagination={false}
 />
 )}

 <FormDialog
 title={editId ? t('studio.edit_field', 'Edit Field') : t('studio.add_field', 'Add Field')}
 open={drawerVisible}
 onClose={() => {
 setDrawerVisible(false);
 form.resetFields();
 setEditId(null);
 }}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item
 name="field_name"
 label={t('studio.field_name', 'Field Name')}
 rules={[{ required: true, message: t('required_field') }]}
 extra={t('studio.field_name_hint', 'lowercase_with_underscores (e.g., delivery_date)')}
 >
 <Input placeholder="delivery_date" disabled={!!editId} />
 </Form.Item>

 <Form.Item
 name="field_label"
 label={t('studio.field_label', 'Label (English)')}
 rules={[{ required: true, message: t('required_field') }]}
 >
 <Input placeholder="Delivery Date" />
 </Form.Item>

 <Form.Item name="field_label_ku" label={t('studio.field_label_ku', 'Label (Kurdish)')}>
 <Input placeholder="بەرواری گەیاندن" />
 </Form.Item>

 <Form.Item
 name="field_type"
 label={t('studio.field_type', 'Field Type')}
 rules={[{ required: true, message: t('required_field') }]}
 >
 <Select
 options={fieldTypeOptions}
 onChange={(v) => setFieldType(v)}
 filterOption={(input, option) =>
 String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
 }
 />
 </Form.Item>

 {(fieldType === 'select' || fieldType === 'multi_select') && (
 <Form.Item
 name="options"
 label={t('studio.options', 'Options')}
 extra={t('studio.options_hint', 'Comma-separated: Small, Medium, Large')}
 >
 <Input.TextArea rows={3} placeholder="Small, Medium, Large" />
 </Form.Item>
 )}

 <Form.Item name="is_required" label={t('required')} valuePropName="checked">
 <Switch />
 </Form.Item>

 <Form.Item>
 <Space>
 <Button type="primary" htmlType="submit">
 {editId ? t('update') : t('create')}
 </Button>
 <Button onClick={() => setDrawerVisible(false)}>{t('cancel')}</Button>
 </Space>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default CustomFieldsBuilder;
