import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, Form, Input, InputNumber, Select, Tabs, App, Switch, DatePicker, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface LoyaltyProgram {
 id: string;
 name: string;
 name_ku?: string;
 program_type: string;
 point_ratio: number;
 min_amount: number;
 date_from?: string;
 date_to?: string;
 is_active: boolean;
}

interface LoyaltyCard {
 id: string;
 program_id: string;
 partner_id: string;
 code: string;
 points_balance: number;
 is_active: boolean;
 created_at: string;
}

const POSLoyalty: React.FC = () => {
 const { t } = useTranslation();
 const { message } = App.useApp();
 const [form] = Form.useForm();
 
 const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
 const [cards, setCards] = useState<LoyaltyCard[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [cardModalOpen, setCardModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState('programs');

 useEffect(() => {
 loadPrograms();
 }, []);

 useEffect(() => {
 if (activeTab === 'cards') {
 loadCards();
 }
 }, [activeTab]);

 const loadPrograms = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/pos/loyalty/programs');
 setPrograms(res.data.items || []);
 } catch (_error) {
 message.error(t('error_loading'));
 } finally {
 setLoading(false);
 }
 };

 const loadCards = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/pos/loyalty/cards');
 setCards(res.data.items || []);
 } catch (_error) {
 message.error(t('error_loading'));
 } finally {
 setLoading(false);
 }
 };

 const handleAdd = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({
 program_type: 'loyalty',
 point_ratio: 1,
 min_amount: 0,
 applies_on: 'current',
 is_active: true,
 });
 setModalOpen(true);
 };

 const handleEdit = (record: LoyaltyProgram) => {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 date_from: record.date_from ? dayjs(record.date_from) : undefined,
 date_to: record.date_to ? dayjs(record.date_to) : undefined,
 });
 setModalOpen(true);
 };

 const handleSubmit = async () => {
 try {
 const values = await form.validateFields();
 const data = {
 ...values,
 date_from: values.date_from ? values.date_from.toISOString() : undefined,
 date_to: values.date_to ? values.date_to.toISOString() : undefined,
 };
 
 if (editingId) {
 await api.put(`/api/pos/loyalty/programs/${editingId}`, data);
 message.success(t('updated_successfully'));
 } else {
 await api.post('/api/pos/loyalty/programs', data);
 message.success(t('created_successfully'));
 }
 setModalOpen(false);
 loadPrograms();
 } catch (_error) {
 message.error(t('error_saving'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('confirm_delete'),
 content: t('confirm_delete_program'),
 onOk: async () => {
 try {
 await api.delete(`/api/pos/loyalty/programs/${id}`);
 message.success(t('deleted_successfully'));
 loadPrograms();
 } catch (_error) {
 message.error(t('error_deleting'));
 }
 },
 });
 };

 const handleIssueCard = () => {
 setCardModalOpen(true);
 };

 const programColumns = [
 {
 title: t('name'),
 dataIndex: 'name',
 key: 'name',
 render: (_: any, record: LoyaltyProgram) => (
 <div>
 <div>{record.name}</div>
 {record.name_ku && <div style={{ fontSize: 12, color: '#999' }}>{record.name_ku}</div>}
 </div>
 ),
 },
 {
 title: t('type'),
 dataIndex: 'program_type',
 key: 'program_type',
 render: (type: string) => {
 const colors: Record<string, string> = {
 loyalty: 'blue',
 coupons: 'green',
 gift_card: 'purple',
 ewallet: 'orange',
 promotion: 'red',
 };
 return <Tag color={colors[type] || 'default'}>{t(`loyalty_type_${type}`)}</Tag>;
 },
 },
 {
 title: t('point_ratio'),
 dataIndex: 'point_ratio',
 key: 'point_ratio',
 render: (val: number) => `${val} pts / 1000 ${t('currency')}`,
 },
 {
 title: t('min_amount'),
 dataIndex: 'min_amount',
 key: 'min_amount',
 render: (val: number) => val.toLocaleString(),
 },
 {
 title: t('valid_period'),
 key: 'period',
 render: (_: any, record: LoyaltyProgram) => {
 if (!record.date_from && !record.date_to) return t('always');
 const from = record.date_from ? dayjs(record.date_from).format('YYYY-MM-DD') : '∞';
 const to = record.date_to ? dayjs(record.date_to).format('YYYY-MM-DD') : '∞';
 return `${from} — ${to}`;
 },
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (val: boolean) => (
 <Tag color={val ? 'green' : 'default'}>{val ? t('active') : t('inactive')}</Tag>
 ),
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: LoyaltyProgram) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>
 {t('edit')}
 </Button>
 <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
 {t('delete')}
 </Button>
 </Space>
 ),
 },
 ];

 const cardColumns = [
 {
 title: t('code'),
 dataIndex: 'code',
 key: 'code',
 render: (code: string) => <code>{code}</code>,
 },
 {
 title: t('program'),
 dataIndex: 'program_id',
 key: 'program_id',
 render: (pid: string) => {
 const prog = programs.find((p) => p.id === pid);
 return prog ? prog.name : pid;
 },
 },
 {
 title: t('partner'),
 dataIndex: 'partner_id',
 key: 'partner_id',
 },
 {
 title: t('points_balance'),
 dataIndex: 'points_balance',
 key: 'points_balance',
 render: (val: number) => <Tag color="blue">{val.toFixed(2)}</Tag>,
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (val: boolean) => (
 <Tag color={val ? 'green' : 'default'}>{val ? t('active') : t('inactive')}</Tag>
 ),
 },
 {
 title: t('created_at'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
 },
 ];

 return (
 <div style={{ padding: 24 }}>
 <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
 <h1>{t('loyalty_programs')}</h1>
 <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
 {t('add_program')}
 </Button>
 </div>

 <Tabs activeKey={activeTab} onChange={setActiveTab}>
 <Tabs.TabPane tab={t('programs')} key="programs">
 <ResponsiveTableAdapter
 columns={programColumns}
 dataSource={programs}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </Tabs.TabPane>
 
 <Tabs.TabPane tab={t('loyalty_cards')} key="cards">
 <div style={{ marginBottom: 16 }}>
 <Button icon={<GiftOutlined />} onClick={handleIssueCard}>
 {t('issue_card')}
 </Button>
 </div>
 <ResponsiveTableAdapter
 columns={cardColumns}
 dataSource={cards}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </Tabs.TabPane>
 </Tabs>

 <FormDialog
 title={editingId ? t('edit_program') : t('add_program')}
 open={modalOpen}
 onOk={handleSubmit}
 onClose={() => setModalOpen(false)}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="name_ku" label={t('name_ku')}>
 <Input />
 </Form.Item>
 <Form.Item name="program_type" label={t('type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="loyalty">{t('loyalty_type_loyalty')}</Select.Option>
 <Select.Option value="coupons">{t('loyalty_type_coupons')}</Select.Option>
 <Select.Option value="gift_card">{t('loyalty_type_gift_card')}</Select.Option>
 <Select.Option value="ewallet">{t('loyalty_type_ewallet')}</Select.Option>
 <Select.Option value="promotion">{t('loyalty_type_promotion')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="point_ratio" label={t('point_ratio')} rules={[{ required: true }]}>
 <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="pts / 1000 IQD" />
 </Form.Item>
 <Form.Item name="min_amount" label={t('min_amount')}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="date_from" label={t('valid_from')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="date_to" label={t('valid_to')}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="applies_on" label={t('applies_on')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="current">{t('current_order')}</Select.Option>
 <Select.Option value="future">{t('future_orders')}</Select.Option>
 <Select.Option value="both">{t('both')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="is_active" label={t('active')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>

 <FormDialog
 title={t('issue_loyalty_card')}
 open={cardModalOpen}
 onOk={async () => {
 // Simple form for issuing a card
 message.info(t('feature_coming_soon'));
 setCardModalOpen(false);
 }}
 onCancel={() => setCardModalOpen(false)}
 >
 <p>{t('issue_card_description')}</p>
 </FormDialog>
 </div>
 );
};

export default POSLoyalty;
