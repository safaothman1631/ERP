import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Button, Form, Input, InputNumber, DatePicker, Select, Space, Popconfirm, Tag, message as antdMessage } from 'antd';

import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag, BulkActionBar, FilterBar } from '../../design-system';
import type { FilterDef } from '../../design-system';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface MileageLog {
 id: string;
 date: string;
 from_location: string;
 to_location: string;
 distance_km: number;
 rate_per_km: number;
 total_amount: number;
 purpose: string;
 vehicle?: string;
 notes?: string;
 status: 'draft' | 'submitted' | 'approved' | 'rejected';
 employee_name?: string;
 project_name?: string;
 created_at?: string;
}

const MileageLog: FC = () => {
 const { t } = useTranslation();
 const [data, setData] = useState<MileageLog[]>([]);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [pageSize] = useState(20);
 const [modal, setModal] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
 const isDark = useAuthStore((s) => s.theme === 'dark');

 // Filters
 const [statusFilter, setStatusFilter] = useState<string>('');
 const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
 const [dateTo, setDateTo] = useState<Dayjs | null>(null);

 const fetchData = async () => {
 setLoading(true);
 try {
 const params: Record<string, unknown> = { page, page_size: pageSize };
 if (statusFilter) params.status = statusFilter;
 const res = await api.get('/api/mileage', { params });
 setData(res.data.items || []);
 setTotal(res.data.total || 0);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, [page, statusFilter]);

 const openModal = (record?: MileageLog) => {
 if (record) {
 setEditingId(record.id);
 form.setFieldsValue({
 ...record,
 date: dayjs(record.date),
 });
 } else {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ date: dayjs(), status: 'draft', rate_per_km: 0.5 });
 }
 setModal(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 const payload = {
 ...values,
 date: values.date.format('YYYY-MM-DD'),
 };

 if (editingId) {
 await api.put(`/api/mileage/${editingId}`, payload);
 message.success(t('updated'));
 } else {
 await api.post('/api/mileage', payload);
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
 await api.delete(`/api/mileage/${id}`);
 message.success(t('deleted'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleSubmit = async (id: string) => {
 try {
 await api.put(`/api/mileage/${id}`, { status: 'submitted' });
 message.success(t('mileage.submitted'));
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleBulkSubmit = async () => {
 try {
 await Promise.all(
 selectedRowKeys.map((id) => api.put(`/api/mileage/${id}`, { status: 'submitted' }))
 );
 message.success(t('mileage.bulk_submitted'));
 setSelectedRowKeys([]);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const handleBulkDelete = async () => {
 try {
 await Promise.all(selectedRowKeys.map((id) => api.delete(`/api/mileage/${id}`)));
 message.success(t('deleted'));
 setSelectedRowKeys([]);
 fetchData();
 } catch {
 message.error(t('error'));
 }
 };

 const columns: any[] = [
 { title: t('date'), dataIndex: 'date', key: 'date', width: 110, render: (d: string) => d?.substring(0, 10) },
 {
 title: t('mileage.route'),
 key: 'route',
 render: (_, r) => `${r.from_location} → ${r.to_location}`,
 },
 { title: t('mileage.distance_km'), dataIndex: 'distance_km', key: 'distance_km', width: 100, align: 'right' },
 { title: t('mileage.rate_per_km'), dataIndex: 'rate_per_km', key: 'rate_per_km', width: 100, align: 'right' },
 {
 title: t('amount'),
 dataIndex: 'total_amount',
 key: 'total_amount',
 width: 120,
 align: 'right',
 render: (v: number) => v?.toFixed(2),
 },
 { title: t('mileage.purpose'), dataIndex: 'purpose', key: 'purpose', ellipsis: true },
 { title: t('mileage.vehicle'), dataIndex: 'vehicle', key: 'vehicle', width: 100 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 width: 110,
 render: (s: string) => <StatusTag status={s as never} label={t(s)} />,
 },
 {
 title: t('actions'),
 key: 'actions',
 width: 140,
 render: (_, r) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => openModal(r)} />
 {r.status === 'draft' && (
 <Button type="primary" icon={<SendOutlined />} onClick={() => handleSubmit(r.id)}>
 {t('submit')}
 </Button>
 )}
 <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
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
 { value: '', label: t('all') },
 { value: 'draft', label: t('draft') },
 { value: 'submitted', label: t('submitted') },
 { value: 'approved', label: t('approved') },
 { value: 'rejected', label: t('rejected') },
 ],
 },
 ];

 return (
 <div style={{ padding: 24 }}>
 <PageHeader
 title={t('mileage.mileage_log')}
 subtitle={t('mileage.log_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
 {t('mileage.new_log')}
 </Button>
 }
 />

 <FilterBar
 filters={filterDefs}
 values={{ status: statusFilter }}
 onChange={(v) => setStatusFilter((v.status as string) ?? '')}
 />

 <ResponsiveTableAdapter
 dataSource={data}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{
 current: page,
 pageSize,
 total,
 onChange: setPage,
 showSizeChanger: false,
 }}
 rowSelection={{
 selectedRowKeys,
 onChange: (keys) => setSelectedRowKeys(keys as string[]),
 }}
 />

 <BulkActionBar
 selectedCount={selectedRowKeys.length}
 onClear={() => setSelectedRowKeys([])}
 isDark={isDark}
 actions={[
 { key: 'submit', label: t('submit'), icon: <CheckOutlined />, onClick: handleBulkSubmit },
 { key: 'delete', label: t('delete'), icon: <DeleteOutlined />, danger: true, onClick: handleBulkDelete },
 ]}
 />

 <FormDialog
 open={modal}
 onClose={() => setModal(false)}
 onOk={handleSave}
 title={editingId ? t('mileage.edit_log') : t('mileage.new_log')}
 >
 <Form form={form} layout="vertical">
 <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required') }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('mileage.from_location')} name="from_location" rules={[{ required: true, message: t('required') }]}>
 <Input placeholder={t('mileage.from_placeholder')} />
 </Form.Item>
 <Form.Item label={t('mileage.to_location')} name="to_location" rules={[{ required: true, message: t('required') }]}>
 <Input placeholder={t('mileage.to_placeholder')} />
 </Form.Item>
 <Form.Item label={t('mileage.distance_km')} name="distance_km" rules={[{ required: true, message: t('required') }]}>
 <InputNumber min={0} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('mileage.rate_per_km')} name="rate_per_km" rules={[{ required: true, message: t('required') }]}>
 <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('mileage.purpose')} name="purpose" rules={[{ required: true, message: t('required') }]}>
 <Input.TextArea rows={2} placeholder={t('mileage.purpose_placeholder')} />
 </Form.Item>
 <Form.Item label={t('mileage.vehicle')} name="vehicle">
 <Input placeholder={t('mileage.vehicle_placeholder')} />
 </Form.Item>
 <Form.Item label={t('notes')} name="notes">
 <Input.TextArea rows={2} />
 </Form.Item>
 <Form.Item label={t('status')} name="status" initialValue="draft">
 <Select
 options={[
 { value: 'draft', label: t('draft') },
 { value: 'submitted', label: t('submitted') },
 ]}
 />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default MileageLog;
