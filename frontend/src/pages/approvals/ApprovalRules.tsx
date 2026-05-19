import { useState, useEffect } from 'react';
import { Button, Form, Input, Select, Space, Switch, InputNumber, Card, Tag, Popconfirm } from 'antd';
import { message } from '../../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface ApprovalStep {
 step: number;
 approver_type: string;
 approver_id?: string;
 role_id?: string;
 required_count: number;
 can_delegate: boolean;
}

interface ApprovalRule {
 id: string;
 name: string;
 doc_type: string;
 condition?: {
 field: string;
 operator: string;
 value: number | string;
 };
 steps: ApprovalStep[];
 active: boolean;
 priority: number;
}

export default function ApprovalRules() {
 const { t } = useTranslation();
 const [rules, setRules] = useState<ApprovalRule[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
 const [form] = Form.useForm();
 const [users, setUsers] = useState<any[]>([]);

 useEffect(() => {
 fetchRules();
 fetchUsers();
 }, []);

 const fetchRules = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/approvals/approval-rules');
 setRules(res.data.items || []);
 } catch {
 message.error(t('error'));
 }
 setLoading(false);
 };

 const fetchUsers = async () => {
 try {
 const res = await api.get('/api/users');
 setUsers(res.data.items || []);
 } catch {
 // Silently fail
 }
 };

 const handleCreate = () => {
 setEditingRule(null);
 form.resetFields();
 form.setFieldsValue({
 active: true,
 priority: 0,
 steps: [{ step: 1, approver_type: 'user', required_count: 1, can_delegate: false }]
 });
 setModalVisible(true);
 };

 const handleEdit = (rule: ApprovalRule) => {
 setEditingRule(rule);
 form.setFieldsValue(rule);
 setModalVisible(true);
 };

 const handleSubmit = async (values: any) => {
 try {
 if (editingRule) {
 await api.put(`/api/approvals/approval-rules/${editingRule.id}`, values);
 message.success(t('updated'));
 } else {
 await api.post('/api/approvals/approval-rules', values);
 message.success(t('created'));
 }
 setModalVisible(false);
 form.resetFields();
 fetchRules();
 } catch (err: any) {
 message.error(err.response?.data?.detail || t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/approvals/approval-rules/${id}`);
 message.success(t('deleted'));
 fetchRules();
 } catch {
 message.error(t('error'));
 }
 };

 const handleToggle = async (id: string) => {
 try {
 await api.post(`/api/approvals/approval-rules/${id}/toggle`, {});
 message.success(t('updated'));
 fetchRules();
 } catch {
 message.error(t('error'));
 }
 };

 const columns = [
 {
 title: t('approvals.name'),
 dataIndex: 'name',
 key: 'name',
 },
 {
 title: t('approvals.doc_type'),
 dataIndex: 'doc_type',
 key: 'doc_type',
 render: (type: string) => t(`approvals.doc_type_${type}`),
 },
 {
 title: t('approvals.condition'),
 key: 'condition',
 render: (_: any, record: ApprovalRule) => {
 if (!record.condition) return t('approvals.always');
 const { field, operator, value } = record.condition;
 return `${t(`approvals.field_${field}`)} ${t(`approvals.operator_${operator}`)} ${value}`;
 },
 },
 {
 title: t('approvals.steps'),
 dataIndex: 'steps',
 key: 'steps',
 render: (steps: ApprovalStep[]) => `${steps.length} ${t('approvals.steps')}`,
 },
 {
 title: t('approvals.priority'),
 dataIndex: 'priority',
 key: 'priority',
 sorter: (a: ApprovalRule, b: ApprovalRule) => a.priority - b.priority,
 },
 {
 title: t('approvals.active'),
 dataIndex: 'active',
 key: 'active',
 render: (active: boolean, record: ApprovalRule) => (
 <Switch checked={active} onChange={() => handleToggle(record.id)} />
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: ApprovalRule) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(record.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div>
 <Card
 title={t('approvals.rules')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('approvals.new_rule')}
 </Button>
 }
 >
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={rules}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 />
 </Card>

 <FormDialog
 open={modalVisible}
 title={editingRule ? t('approvals.edit_rule') : t('approvals.new_rule')}
 onClose={() => setModalVisible(false)}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item name="name" label={t('approvals.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>

 <Form.Item name="doc_type" label={t('approvals.doc_type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="purchase_order">{t('approvals.doc_type_purchase_order')}</Select.Option>
 <Select.Option value="expense_claim">{t('approvals.doc_type_expense_claim')}</Select.Option>
 <Select.Option value="sales_order">{t('approvals.doc_type_sales_order')}</Select.Option>
 <Select.Option value="bill">{t('approvals.doc_type_bill')}</Select.Option>
 <Select.Option value="invoice">{t('approvals.doc_type_invoice')}</Select.Option>
 </Select>
 </Form.Item>

 <Card title={t('approvals.condition_label')} style={{ marginBottom: 16 }}>
 <Form.Item name={['condition', 'field']} label={t('approvals.field')}>
 <Select allowClear placeholder={t('approvals.always')}>
 <Select.Option value="total">Total Amount</Select.Option>
 <Select.Option value="currency_code">Currency</Select.Option>
 <Select.Option value="branch_id">Branch</Select.Option>
 </Select>
 </Form.Item>

 <Form.Item noStyle shouldUpdate={(prev, curr) => prev.condition?.field !== curr.condition?.field}>
 {({ getFieldValue }) =>
 getFieldValue(['condition', 'field']) ? (
 <>
 <Form.Item name={['condition', 'operator']} label={t('approvals.operator')}>
 <Select>
 <Select.Option value="gt">&gt;</Select.Option>
 <Select.Option value="gte">&gt;=</Select.Option>
 <Select.Option value="lt">&lt;</Select.Option>
 <Select.Option value="lte">&lt;=</Select.Option>
 <Select.Option value="eq">=</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name={['condition', 'value']} label={t('approvals.value')}>
 <InputNumber style={{ width: '100%' }} />
 </Form.Item>
 </>
 ) : null
 }
 </Form.Item>
 </Card>

 <Form.List name="steps">
 {(fields, { add, remove }) => (
 <>
 {fields.map((field, index) => (
 <Card key={field.key} title={`${t('approvals.step')} ${index + 1}`} style={{ marginBottom: 8 }}>
 <Form.Item name={[field.name, 'step']} initialValue={index + 1} hidden>
 <Input />
 </Form.Item>

 <Form.Item name={[field.name, 'approver_type']} label={t('approvals.approver_type')}>
 <Select>
 <Select.Option value="user">{t('approvals.approver_type_user')}</Select.Option>
 <Select.Option value="role">{t('approvals.approver_type_role')}</Select.Option>
 <Select.Option value="manager_of_creator">{t('approvals.approver_type_manager')}</Select.Option>
 </Select>
 </Form.Item>

 <Form.Item noStyle shouldUpdate={(prev, curr) => prev.steps?.[index]?.approver_type !== curr.steps?.[index]?.approver_type}>
 {({ getFieldValue }) =>
 getFieldValue(['steps', index, 'approver_type']) === 'user' ? (
 <Form.Item name={[field.name, 'approver_id']} label={t('approvals.approver')}>
 <Select showSearch optionFilterProp="children">
 {users.map((u) => (
 <Select.Option key={u.id} value={u.id}>{u.name || u.email}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 ) : null
 }
 </Form.Item>

 <Form.Item name={[field.name, 'can_delegate']} label={t('approvals.can_delegate')} valuePropName="checked">
 <Switch />
 </Form.Item>

 {fields.length > 1 && (
 <Button danger onClick={() => remove(field.name)}>
 {t('remove')}
 </Button>
 )}
 </Card>
 ))}
 <Button type="dashed" onClick={() => add({ step: fields.length + 1, approver_type: 'user', required_count: 1, can_delegate: false })} block>
 {t('approvals.add_step')}
 </Button>
 </>
 )}
 </Form.List>

 <Form.Item name="priority" label={t('approvals.priority')}>
 <InputNumber style={{ width: '100%' }} />
 </Form.Item>

 <Form.Item name="active" label={t('approvals.active')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
