import React, { useEffect, useMemo, useState } from 'react';
import { Button, Tag, Form, Input, Select, Space, Popconfirm, Empty, Typography } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { downloadCsv } from '../utils/exportCsv';
import { space as spaceTk } from '../theme/tokens';
import { useAuthStore } from '../store';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

const { Text } = Typography;

interface Rule {
 id: string;
 name: string;
 rule_type: string; // deposit | withdrawal
 apply_to: string; // description | payee | reference
 condition_type: string; // contains | equals | starts_with
 condition_value: string;
 target_account_id: string;
 target_account_name?: string;
 target_contact_id?: string;
 is_active: boolean;
}

const applyToOptions = [
 { label: 'Description', value: 'description' },
 { label: 'Payee', value: 'payee' },
 { label: 'Reference', value: 'reference' },
];

const conditionTypeOptions = [
 { label: 'Contains', value: 'contains' },
 { label: 'Equals', value: 'equals' },
 { label: 'Starts with', value: 'starts_with' },
];

const ruleTypeOptions = [
 { label: 'Deposit (income)', value: 'deposit' },
 { label: 'Withdrawal (expense)', value: 'withdrawal' },
];

const BankRules: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<Rule[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [accounts, setAccounts] = useState<{ id: string; name: string; code: string }[]>([]);
 const [contacts, setContacts] = useState<{ id: string; display_name: string }[]>([]);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [applying, setApplying] = useState(false);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('bankRules.hiddenCols') || '[]'); } catch { return []; }
 });
 const isDark = useAuthStore((s) => s.theme === 'dark');

 const fetchData = () => {
 setLoading(true);
 api.get('/api/banking/rules')
 .then(r => setData(r.data.items || []))
 .catch(() => message.error(t('error')))
 .finally(() => setLoading(false));
 };

 useEffect(() => { fetchData(); }, []);

 const openNew = async () => {
 const [a, c] = await Promise.all([
 api.get('/api/accounts', { params: { page_size: 200 } }),
 api.get('/api/contacts', { params: { page_size: 200 } }),
 ]);
 setAccounts(a.data.items || a.data);
 setContacts(c.data.items || c.data);
 setEditingId(null);
 form.resetFields();
 setModalOpen(true);
 };

 const openEdit = async (record: Rule) => {
 const [a, c] = await Promise.all([
 api.get('/api/accounts', { params: { page_size: 200 } }),
 api.get('/api/contacts', { params: { page_size: 200 } }),
 ]);
 setAccounts(a.data.items || a.data);
 setContacts(c.data.items || c.data);
 setEditingId(record.id);
 form.setFieldsValue(record);
 setModalOpen(true);
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 if (editingId) {
 await api.put(`/api/banking/rules/${editingId}`, values);
 } else {
 await api.post('/api/banking/rules', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 fetchData();
 } catch {
 message.error(t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/banking/rules/${id}`);
 message.success(t('success'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleApplyAll = async () => {
 setApplying(true);
 try {
 const r = await api.post('/api/banking/rules/apply');
 message.success(`${t('success')} — ${r.data.matched || 0} matched`);
 } catch {
 message.error(t('error'));
 } finally {
 setApplying(false);
 }
 };

 const columns = [
 { title: t('name'), dataIndex: 'name', key: 'name' },
 {
 title: t('condition'), key: 'condition',
 render: (_: unknown, r: Rule) => (
 <span>{r.apply_to} {r.condition_type} &quot;{r.condition_value}&quot;</span>
 ),
 },
 { title: t('account'), dataIndex: 'target_account_name', key: 'target_account_name' },
 {
 title: t('type'), dataIndex: 'rule_type', key: 'rule_type',
 render: (v: string) => <Tag color={v === 'deposit' ? 'green' : 'red'} style={{ borderRadius: 12 }}>{t(v)}</Tag>,
 },
 {
 title: t('status'), dataIndex: 'is_active', key: 'is_active',
 render: (v: boolean) => <Tag color={v ? 'green' : 'default'} style={{ borderRadius: 12 }}>{v ? t('active') : t('inactive')}</Tag>,
 },
 {
 title: t('actions'), key: 'actions',
 render: (_: unknown, r: Rule) => (
 <Space>
 <Button onClick={() => openEdit(r)}>{t('edit')}</Button>
 <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('bankRules.hiddenCols', JSON.stringify(next)); } catch {}
 };

 return (
 <div>
 <PageHeader
 title={t('bankRules')}
 subtitle={t('bank_rules_subtitle', 'Automatic bank rules')}
 sectionId="banking.bank_rules"
 extra={
 <Space>
 <Button icon={<ThunderboltOutlined />} loading={applying} onClick={handleApplyAll}>
 {t('apply_all_rules')}
 </Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
 {t('create')}
 </Button>
 </Space>
 }
 />

 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spaceTk.md }}>
 <ExportMenu
 formats={['csv']}
 onExport={(f: ExportFormat) => {
 if (f === 'csv') {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('bank-rules', data, cols);
 }
 }}
 />
 <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
 </div>
 <ResponsiveTableAdapter
 dataSource={data}
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 locale={{
 emptyText: (
 <Empty
 image={<InboxOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
 description={
 <Space orientation="vertical">
 <Text strong>{t('no_bank_rules_yet')}</Text>
 <Text type="secondary">{t('no_bank_rules_hint')}</Text>
 </Space>
 }
 >
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_rule')}</Button>
 </Empty>
 ),
 }}
 />

 <FormDialog
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 title={editingId ? t('edit') : t('bankRules')} hideFooter
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]}>
 <Input placeholder={t('placeholder_name')} />
 </Form.Item>

 <Space wrap style={{ width: '100%' }}>
 <Form.Item label={t('field')} name="apply_to" rules={[{ required: true, message: t('required_field') }]} style={{ width: 160 }}>
 <Select placeholder={t('placeholder_select')} options={applyToOptions} />
 </Form.Item>
 <Form.Item label={t('operator')} name="condition_type" rules={[{ required: true, message: t('required_field') }]} style={{ width: 160 }}>
 <Select placeholder={t('placeholder_select')} options={conditionTypeOptions} />
 </Form.Item>
 <Form.Item label={t('value')} name="condition_value" rules={[{ required: true, message: t('required_field') }]} style={{ width: 200 }}>
 <Input placeholder={t('placeholder_description')} />
 </Form.Item>
 </Space>

 <Form.Item label={t('account')} name="target_account_id" rules={[{ required: true, message: t('required_account') }]}>
 <SelectWithQuickCreate entity="account" showSearch placeholder={t('placeholder_select')} allowClear />
 </Form.Item>

 <Form.Item label={t('contact')} name="target_contact_id">
 <SelectWithQuickCreate entity="customer" showSearch placeholder={t('placeholder_contact')} allowClear />
 </Form.Item>

 <Form.Item label={t('type')} name="rule_type" rules={[{ required: true, message: t('required_field') }]}>
 <Select placeholder={t('placeholder_select')} options={ruleTypeOptions} />
 </Form.Item>

 <Space>
 <Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button>
 <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
 </Space>
 </Form>
 </FormDialog>
 </div>
 );
};

export default BankRules;
