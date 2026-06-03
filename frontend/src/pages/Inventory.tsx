import React, { useEffect, useState } from 'react';
import { Tabs, Button, Tag, Row, Col, Form, Input, InputNumber, Space } from 'antd';
import { message } from '../utils/message';
import { WarningOutlined, PlusOutlined, InboxOutlined, WalletOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import ExportButton from '../components/ExportButton';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
import { KpiCard } from '../design-system/KpiCard';

const Inventory: React.FC = () => {
 const { t } = useTranslation();

 return (
 <Tabs defaultActiveKey="overview" items={[
 { key: 'overview', label: t('inventory_overview'), children: <InventoryOverview /> },
 { key: 'low-stock', label: t('low_stock_alerts'), children: <LowStock /> },
 { key: 'adjustments', label: t('adjustments'), children: <Adjustments /> },
 { key: 'groups', label: t('item_groups'), children: <ItemGroups /> },
 ]} />
 );
};

const InventoryOverview: React.FC = () => {
 const { t } = useTranslation();
 const [valuation, setValuation] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 setLoading(true);
 api.get('/api/inventory/valuation').then(r => setValuation(r.data.items || [])).catch(() => message.error(t('error'))).finally(() => setLoading(false));
 }, []);

 const totalValue = valuation.reduce((s: number, v: any) => s + (v.total_value || 0), 0);

 return (
 <div>
 <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
 <Col xs={12} sm={8}>
 <KpiCard title={t('total_items')} value={valuation.length} icon={<InboxOutlined />} tone="primary" loading={loading} />
 </Col>
 <Col xs={12} sm={8}>
 <KpiCard title={t('total_stock_value')} value={totalValue} currency="IQD" icon={<WalletOutlined />} tone="success" loading={loading} />
 </Col>
 <Col xs={12} sm={8}>
 <KpiCard title={t('low_stock_count')} value={valuation.filter((v: any) => v.stock_on_hand <= (v.reorder_point || 0)).length} icon={<WarningOutlined />} tone="danger" loading={loading} />
 </Col>
 </Row>
 <ResponsiveTableAdapter dataSource={valuation} columns={[
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('stock'), dataIndex: 'stock_on_hand', key: 'stock_on_hand' },
 { title: t('cost_price'), dataIndex: 'cost_price', key: 'cost_price', render: (v: number) => v?.toLocaleString() },
 { title: t('total'), dataIndex: 'value', key: 'value', render: (v: number) => v?.toLocaleString() },
 ]} rowKey="item_id" loading={loading} pagination={false} />
 </div>
 );
};

const LowStock: React.FC = () => {
 const { t } = useTranslation();
 const [items, setItems] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 setLoading(true);
 api.get('/api/inventory/low-stock').then(r => setItems(r.data.items || [] || [])).catch(() => message.error(t('error'))).finally(() => setLoading(false));
 }, []);

 return (
 <ResponsiveTableAdapter dataSource={items} columns={[
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('sku'), dataIndex: 'sku', key: 'sku' },
 { title: t('stock'), dataIndex: 'stock_on_hand', key: 'stock_on_hand', render: (v: number) => <Tag color="red" icon={<WarningOutlined />}>{v}</Tag> },
 { title: t('reorder_point'), dataIndex: 'reorder_point', key: 'reorder_point' },
 ]} rowKey="id" loading={loading} pagination={false} />
 );
};

const Adjustments: React.FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [_items, setItems] = useState<any[]>([]);
 const [_accounts, setAccounts] = useState<any[]>([]);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);

 const fetchData = () => {
 setLoading(true);
 api.get('/api/inventory/adjustments').then(r => setData(r.data.items || [])).catch(() => message.error(t('error'))).finally(() => setLoading(false));
 };

 useEffect(() => { fetchData(); }, []);

 const openNew = async () => {
 const [i, a] = await Promise.all([
 api.get('/api/items', { params: { page_size: 100 } }),
 api.get('/api/accounts', { params: { page_size: 100 } }),
 ]);
 setItems(i.data.items); setAccounts(a.data.items || a.data);
 form.resetFields(); setModalOpen(true);
 };

 const handleSave = async (values: any) => {
 setSaving(true);
 try {
 await api.post('/api/inventory/adjustments', {
 item_id: values.item_id, adjustment_account_id: values.adjustment_account_id,
 quantity_adjusted: values.quantity_adjusted, reason: values.reason || '',
 date: new Date().toISOString().substring(0, 10),
 });
 message.success(t('success')); setModalOpen(false); fetchData();
 } catch { message.error(t('error')); } finally { setSaving(false); }
 };

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
 <ExportButton endpoint="/api/export/inventory" filename="inventory" />
 <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_adjustment')}</Button>
 </div>
 <ResponsiveTableAdapter dataSource={data} columns={[
 { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
 { title: t('quantity'), dataIndex: 'quantity_adjusted', key: 'quantity_adjusted', render: (v: number) => <Tag color={v > 0 ? 'green' : 'red'}>{v > 0 ? '+' : ''}{v}</Tag> },
 { title: t('description'), dataIndex: 'reason', key: 'reason' },
 { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <Tag>{t(s || 'posted')}</Tag> },
 ]} rowKey="id" loading={loading} />
 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('new_adjustment')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item label={t('items')} name="item_id" rules={[{ required: true, message: t('required_item') }]}>
 <SelectWithQuickCreate entity="item" showSearch placeholder={t('placeholder_select')} allowClear />
 </Form.Item>
 <Form.Item label={t('account')} name="adjustment_account_id" rules={[{ required: true, message: t('required_account') }]}>
 <SelectWithQuickCreate entity="account" showSearch placeholder={t('placeholder_select')} allowClear />
 </Form.Item>
 <Form.Item label={t('quantity')} name="quantity_adjusted" rules={[{ required: true, message: t('required_quantity') }]}>
 <InputNumber style={{ width: '100%' }} placeholder={t('placeholder_quantity')} />
 </Form.Item>
 <Form.Item label={t('description')} name="reason"><Input.TextArea rows={2} placeholder={t('placeholder_description')} /></Form.Item>
 <Space><Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button><Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button></Space>
 </Form>
 </FormDialog>
 </div>
 );
};

const ItemGroups: React.FC = () => {
 const { t } = useTranslation();
 const [groups, setGroups] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [saving, setSaving] = useState(false);

 const fetchGroups = () => {
 setLoading(true);
 api.get('/api/inventory/groups').then(r => setGroups(r.data.items || [] || [])).catch(() => message.error(t('error'))).finally(() => setLoading(false));
 };

 useEffect(() => { fetchGroups(); }, []);

 const handleSave = async (values: any) => {
 setSaving(true);
 try { await api.post('/api/inventory/groups', values); message.success(t('success')); setModalOpen(false); fetchGroups(); }
 catch { message.error(t('error')); } finally { setSaving(false); }
 };

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>{t('new_group')}</Button>
 </div>
 <ResponsiveTableAdapter dataSource={groups} columns={[
 { title: t('name'), dataIndex: 'name', key: 'name' },
 { title: t('description'), dataIndex: 'description', key: 'description' },
 ]} rowKey="id" loading={loading} />
 <FormDialog open={modalOpen} onClose={() => setModalOpen(false)} title={t('new_group')} hideFooter>
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]}><Input placeholder={t('placeholder_name')} /></Form.Item>
 <Form.Item label={t('description')} name="description"><Input.TextArea rows={2} placeholder={t('placeholder_description')} /></Form.Item>
 <Space><Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button><Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button></Space>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Inventory;
