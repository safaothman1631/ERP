import React, { useEffect, useState } from 'react';
import { Button, Space, Input, Form, message, Popconfirm, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader, StatusTag } from '../../design-system';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Patient {
 id: string;
 name: string;
 phone?: string;
 dob?: string;
 gender: string;
 blood_type?: string;
 allergies?: string[];
 last_visit?: string;
 created_at?: string;
}

const PatientsList: React.FC = () => {
 const { t } = useTranslation();
 const [form] = Form.useForm();
 const [loading, setLoading] = useState(false);
 const [patients, setPatients] = useState<Patient[]>([]);
 const [total, setTotal] = useState(0);
 const [searchText, setSearchText] = useState('');
 const [modalVisible, setModalVisible] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);

 useEffect(() => {
 void fetchPatients();
 }, []);

 const fetchPatients = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/healthcare/patients', { params: { limit: 500 } });
 setPatients(res.data.items);
 setTotal(res.data.total);
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleCreate = () => {
 setEditingId(null);
 form.resetFields();
 setModalVisible(true);
 };

 const handleEdit = (record: Patient) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setModalVisible(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 if (editingId) {
 await api.patch(`/api/healthcare/patients/${editingId}`, values);
 void message.success(t('saved'));
 } else {
 await api.post('/api/healthcare/patients', values);
 void message.success(t('created'));
 }
 setModalVisible(false);
 void fetchPatients();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/healthcare/patients/${id}`);
 void message.success(t('deleted'));
 void fetchPatients();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const filteredPatients = patients.filter(
 (p) =>
 p.name?.toLowerCase().includes(searchText.toLowerCase()) ||
 p.phone?.toLowerCase().includes(searchText.toLowerCase())
 );

 const columns: ColumnsType<Patient> = [
 {
 title: t('healthcare.name'),
 dataIndex: 'name',
 key: 'name',
 sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
 },
 {
 title: t('healthcare.phone'),
 dataIndex: 'phone',
 key: 'phone',
 },
 {
 title: t('healthcare.dob'),
 dataIndex: 'dob',
 key: 'dob',
 },
 {
 title: t('healthcare.gender'),
 dataIndex: 'gender',
 key: 'gender',
 render: (gender: string) => t(`healthcare.gender_${gender}`),
 },
 {
 title: t('healthcare.blood_type'),
 dataIndex: 'blood_type',
 key: 'blood_type',
 },
 {
 title: t('healthcare.allergies'),
 dataIndex: 'allergies',
 key: 'allergies',
 render: (allergies?: string[]) =>
 allergies && allergies.length > 0 ? allergies.map((a) => <Tag key={a}>{a}</Tag>) : '—',
 },
 {
 title: t('healthcare.last_visit'),
 dataIndex: 'last_visit',
 key: 'last_visit',
 render: (date?: string) => date?.substring(0, 10) || '—',
 },
 {
 title: '',
 key: 'actions',
 width: 120,
 render: (_: unknown, record: Patient) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => void handleDelete(record.id)}>
 <Button icon={<DeleteOutlined />} danger />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('healthcare.patients')}
 subtitle={t('healthcare.patients_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('healthcare.new_patient')}
 </Button>
 }
 />

 <Space style={{ marginBottom: 16 }}>
 <Input
 placeholder={t('healthcare.search_patient')}
 prefix={<SearchOutlined />}
 value={searchText}
 onChange={(e) => setSearchText(e.target.value)}
 style={{ width: 300 }}
 />
 </Space>

 <ResponsiveTableAdapter
 dataSource={filteredPatients}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ total, pageSize: 50 }}
 />

 <FormDialog
 title={editingId ? t('healthcare.edit_patient') : t('healthcare.new_patient')}
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => void handleSave()}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('healthcare.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="phone" label={t('healthcare.phone')}>
 <Input />
 </Form.Item>
 <Form.Item name="dob" label={t('healthcare.dob')}>
 <Input type="date" />
 </Form.Item>
 <Form.Item name="gender" label={t('healthcare.gender')} initialValue="unknown">
 <Input />
 </Form.Item>
 <Form.Item name="blood_type" label={t('healthcare.blood_type')}>
 <Input placeholder="A+, B-, O+, AB+" />
 </Form.Item>
 <Form.Item name="allergies" label={t('healthcare.allergies')}>
 <Input placeholder={t('healthcare.allergies_hint')} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default PatientsList;
