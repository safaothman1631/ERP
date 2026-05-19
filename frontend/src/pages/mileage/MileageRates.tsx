import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Button, Form, Input, InputNumber, Space, Popconfirm } from 'antd';

import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface MileageRate {
 id: string;
 vehicle_type: string;
 rate_per_km: number;
 description?: string;
 is_default?: boolean;
}

const MileageRates: FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<MileageRate[]>([]);
 const [loading, setLoading] = useState(false);
 const [modal, setModal] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/mileage/rates');
 setData(res.data.items || res.data || []);
 } catch (err) {
 // Fallback: static rates
 setData([
 { id: '1', vehicle_type: 'Car', rate_per_km: 0.5, description: 'Standard car', is_default: true },
 { id: '2', vehicle_type: 'Motorbike', rate_per_km: 0.3, description: 'Motorbike / scooter' },
 { id: '3', vehicle_type: 'Truck', rate_per_km: 0.8, description: 'Commercial truck' },
 ]);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, []);

 const openModal = (record?: MileageRate) => {
 if (record) {
 setEditingId(record.id);
 form.setFieldsValue(record);
 } else {
 setEditingId(null);
 form.resetFields();
 }
 setModal(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 if (editingId) {
 await api.put(`/api/mileage/rates/${editingId}`, values);
 message.success(t('updated'));
 } else {
 await api.post('/api/mileage/rates', values);
 message.success(t('saved'));
 }
 setModal(false);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/mileage/rates/${id}`);
 message.success(t('deleted'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const columns: any[] = [
 { title: t('mileage.vehicle_type'), dataIndex: 'vehicle_type', key: 'vehicle_type' },
 {
 title: t('mileage.rate_per_km'),
 dataIndex: 'rate_per_km',
 key: 'rate_per_km',
 align: 'right',
 render: (v: number) => v?.toFixed(2),
 },
 { title: t('description'), dataIndex: 'description', key: 'description', ellipsis: true },
 {
 title: t('actions'),
 key: 'actions',
 width: 120,
 render: (_, r) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openModal(r)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div style={{ padding: 24 }}>
 <PageHeader
 title={t('mileage.rates_title')}
 subtitle={t('mileage.rates_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
 {t('mileage.new_rate')}
 </Button>
 }
 />

 <ResponsiveTableAdapter
 dataSource={data}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={false}
 />

 <FormDialog
 open={modal}
 onClose={() => setModal(false)}
 onOk={handleSave}
 title={editingId ? t('mileage.edit_rate') : t('mileage.new_rate')}
 >
 <Form form={form} layout="vertical">
 <Form.Item
 label={t('mileage.vehicle_type')}
 name="vehicle_type"
 rules={[{ required: true, message: t('required') }]}
 >
 <Input placeholder={t('mileage.vehicle_type_placeholder')} />
 </Form.Item>
 <Form.Item
 label={t('mileage.rate_per_km')}
 name="rate_per_km"
 rules={[{ required: true, message: t('required') }]}
 >
 <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('description')} name="description">
 <Input.TextArea rows={2} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default MileageRates;
