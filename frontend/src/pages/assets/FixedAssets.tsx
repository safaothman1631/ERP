import React, { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, DatePicker, Popconfirm, Row, Col, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined, FallOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import { PageHeader, StatusTag, FilterBar } from '../../design-system';
import type { FilterDef } from '../../design-system';
import { message } from '../../utils/message';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Asset {
 id: string;
 asset_code: string;
 name: string;
 category_id?: string;
 acquisition_date: string;
 acquisition_cost: number;
 salvage_value: number;
 useful_life_months: number;
 depreciation_method: string;
 status: string;
 book_value: number;
 accumulated_depreciation: number;
 branch_id?: string;
 location?: string;
}

interface AssetCategory {
 id: string;
 name: string;
 default_useful_life_months: number;
 default_method: string;
 default_salvage_pct: number;
 asset_account_id: string;
 accumulated_depreciation_account_id: string;
 depreciation_expense_account_id: string;
}

const FixedAssets: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<Asset[]>([]);
 const [loading, setLoading] = useState(false);
 const [statusFilter, setStatusFilter] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);
 const [accounts, setAccounts] = useState<{ id: string; name: string; code: string }[]>([]);
 const [categories, setCategories] = useState<AssetCategory[]>([]);
 const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

 const fetchData = async () => {
 setLoading(true);
 try {
 const params: Record<string, string> = {};
 if (statusFilter) params.status = statusFilter;
 if (categoryFilter) params.category_id = categoryFilter;
 const r = await api.get('/api/fixed-assets/assets', { params });
 setData(r.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchAccounts = async () => {
 try {
 const r = await api.get('/api/accounts', { params: { page_size: 500 } });
 setAccounts(r.data.items || r.data || []);
 } catch {
 // Ignore
 }
 };

 const fetchCategories = async () => {
 try {
 const r = await api.get('/api/fixed-assets/asset-categories');
 setCategories(r.data.items || []);
 } catch {
 // Ignore
 }
 };

 const fetchBranches = async () => {
 try {
 const r = await api.get('/api/branches');
 setBranches(r.data.items || r.data || []);
 } catch {
 // Ignore
 }
 };

 useEffect(() => {
 fetchData();
 }, [statusFilter, categoryFilter]);

 useEffect(() => {
 fetchAccounts();
 fetchCategories();
 fetchBranches();
 }, []);

 const openNew = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({
 status: 'active',
 depreciation_method: 'straight_line',
 salvage_value: 0,
 useful_life_months: 60,
 });
 setModalOpen(true);
 };

 const _openEdit = async (record: Asset) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 acquisition_date: record.acquisition_date ? dayjs(record.acquisition_date) : undefined,
 });
 setModalOpen(true);
 };

 const handleCategoryChange = (categoryId: string) => {
 const cat = categories.find((c) => c.id === categoryId);
 if (cat) {
 form.setFieldsValue({
 useful_life_months: cat.default_useful_life_months,
 depreciation_method: cat.default_method,
 salvage_value: form.getFieldValue('acquisition_cost') * (cat.default_salvage_pct / 100) || 0,
 asset_account_id: cat.asset_account_id,
 accumulated_depreciation_account_id: cat.accumulated_depreciation_account_id,
 depreciation_expense_account_id: cat.depreciation_expense_account_id,
 });
 }
 };

 const handleSave = async (values: Record<string, unknown>) => {
 setSaving(true);
 try {
 const payload = {
 ...values,
 acquisition_date: (values.acquisition_date as Dayjs).format('YYYY-MM-DD'),
 };
 if (editingId) {
 await api.put(`/api/fixed-assets/assets/${editingId}`, payload);
 } else {
 await api.post('/api/fixed-assets/assets', payload);
 }
 message.success(t('success'));
 setModalOpen(false);
 fetchData();
 } catch (err: unknown) {
 const errorDetail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
 message.error(errorDetail || t('error'));
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/fixed-assets/assets/${id}`);
 message.success(t('success'));
 fetchData();
 } catch (err: unknown) {
 const errorDetail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
 message.error(errorDetail || t('error'));
 }
 };

 const columns = [
 { title: t('assets.asset_code'), dataIndex: 'asset_code', key: 'code', width: 120 },
 { title: t('name'), dataIndex: 'name', key: 'name' },
 {
 title: t('assets.category'),
 dataIndex: 'category_id',
 key: 'category',
 render: (catId: string) => {
 const cat = categories.find((c) => c.id === catId);
 return cat?.name || '—';
 },
 },
 { title: t('assets.acquisition_cost'), dataIndex: 'acquisition_cost', key: 'cost', render: (v: number) => v.toLocaleString() },
 { title: t('assets.book_value'), dataIndex: 'book_value', key: 'book', render: (v: number) => v.toLocaleString() },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (s: string) => <StatusTag status={s} label={t(`assets.status_${s}`)} />,
 },
 {
 title: t('action'),
 key: 'action',
 render: (_: unknown, record: Asset) => (
 <Space>
 <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/assets/${record.id}`)} />
 <Button type="link" icon={<FallOutlined />} onClick={() => navigate(`/assets/${record.id}`)} disabled={record.status !== 'active'} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(record.id)}>
 <Button type="link" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 const filterDefs: FilterDef[] = [
 {
 key: 'status',
 label: t('status'),
 options: [
 { value: 'active', label: t('assets.status_active') },
 { value: 'fully_depreciated', label: t('assets.status_fully_depreciated') },
 { value: 'disposed', label: t('assets.status_disposed') },
 ],
 },
 {
 key: 'category_id',
 label: t('assets.category'),
 options: categories.map((c) => ({ value: c.id, label: c.name })),
 },
 ];

 return (
 <>
 <PageHeader
 title={t('assets.fixed_assets')}
 extra={
 <Space>
 <Button onClick={() => navigate('/assets/categories')}>{t('assets.categories')}</Button>
 <Button onClick={() => navigate('/assets/depreciation-run')}>{t('assets.run_depreciation')}</Button>
 <Button onClick={() => navigate('/assets/reports')}>{t('reports')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new')}</Button>
 </Space>
 }
 />
 <FilterBar
 filters={filterDefs}
 values={{ status: statusFilter || undefined, category_id: categoryFilter || undefined }}
 onChange={(v) => { setStatusFilter((v.status as string) ?? ''); setCategoryFilter((v.category_id as string) ?? ''); }}
 />
 <ResponsiveTableAdapter columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description={t('empty_assets')} /> }} />
 <FormDialog
 title={editingId ? t('edit') : t('new')}
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 onOk={() => form.submit()}
 confirmLoading={saving}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="asset_code" label={t('assets.asset_code')}>
 <Input placeholder={t('assets.auto_generated')} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="category_id" label={t('assets.category')}>
 <Select onChange={handleCategoryChange} allowClear>
 {categories.map((c) => (
 <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="acquisition_date" label={t('assets.acquisition_date')} rules={[{ required: true }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="acquisition_cost" label={t('assets.acquisition_cost')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="salvage_value" label={t('assets.salvage_value')} rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="useful_life_months" label={t('assets.useful_life_months')} rules={[{ required: true }]}>
 <InputNumber min={1} style={{ width: '100%' }} />
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="depreciation_method" label={t('assets.depreciation_method')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="straight_line">{t('assets.straight_line')}</Select.Option>
 <Select.Option value="declining_balance">{t('assets.declining_balance')}</Select.Option>
 </Select>
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={8}>
 <Form.Item name="asset_account_id" label={t('assets.asset_account')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children" filterOption={(input: string, option?: { children?: string }) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
 {accounts.map((a) => (
 <Select.Option key={a.id} value={a.id}>{`${a.code} - ${a.name}`}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 <Col span={8}>
 <Form.Item name="accumulated_depreciation_account_id" label={t('assets.accum_depreciation_account')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children" filterOption={(input: string, option?: { children?: string }) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
 {accounts.map((a) => (
 <Select.Option key={a.id} value={a.id}>{`${a.code} - ${a.name}`}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 <Col span={8}>
 <Form.Item name="depreciation_expense_account_id" label={t('assets.depreciation_expense_account')} rules={[{ required: true }]}>
 <Select showSearch optionFilterProp="children" filterOption={(input: string, option?: { children?: string }) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
 {accounts.map((a) => (
 <Select.Option key={a.id} value={a.id}>{`${a.code} - ${a.name}`}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 </Row>
 <Row gutter={16}>
 <Col span={12}>
 <Form.Item name="branch_id" label={t('branch')}>
 <Select allowClear>
 {branches.map((b) => (
 <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 </Col>
 <Col span={12}>
 <Form.Item name="location" label={t('assets.location')}>
 <Input />
 </Form.Item>
 </Col>
 </Row>
 <Form.Item name="notes" label={t('notes')}>
 <Input.TextArea rows={2} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default FixedAssets;
