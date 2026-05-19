import React, { useEffect, useState } from 'react';
import { Tabs, Button, Space, Form, Input, Select, message, Popconfirm, Card, Row, Col, Statistic } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, HomeOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader, StatusTag, KpiCard } from '../../design-system';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Ward {
 id: string;
 name: string;
 floor?: string;
 capacity: number;
 occupied_beds?: number;
}

interface Bed {
 id: string;
 ward_id: string;
 bed_number: string;
 is_occupied: boolean;
 type: string;
}

interface Admission {
 id: string;
 patient_id: string;
 patient_name?: string;
 bed_id?: string;
 bed_number?: string;
 ward_name?: string;
 admitted_at: string;
 status: string;
 reason?: string;
}

const WardsAdmissions: React.FC = () => {
 const { t } = useTranslation();
 const [form] = Form.useForm();
 const [loading, setLoading] = useState(false);
 const [wards, setWards] = useState<Ward[]>([]);
 const [beds, setBeds] = useState<Bed[]>([]);
 const [admissions, setAdmissions] = useState<Admission[]>([]);
 const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
 const [modalVisible, setModalVisible] = useState(false);
 const [modalType, setModalType] = useState<'ward' | 'admission'>('ward');
 const [editingId, setEditingId] = useState<string | null>(null);

 useEffect(() => {
 void fetchData();
 }, []);

 const fetchData = async () => {
 setLoading(true);
 try {
 const [wardsRes, bedsRes, admissionsRes, patientsRes] = await Promise.all([
 api.get('/api/hospital/wards', { params: { limit: 500 } }),
 api.get('/api/hospital/beds', { params: { limit: 500 } }),
 api.get('/api/hospital/admissions', { params: { limit: 500 } }),
 api.get('/api/healthcare/patients', { params: { limit: 500 } }),
 ]);

 const wardsData = wardsRes.data.items as Ward[];
 const bedsData = bedsRes.data.items as Bed[];
 const admissionsData = admissionsRes.data.items as Admission[];
 const patientsData = patientsRes.data.items as Array<{ id: string; name: string }>;

 // Enrich wards with occupied bed count
 const enrichedWards = wardsData.map((w) => ({
 ...w,
 occupied_beds: bedsData.filter((b) => b.ward_id === w.id && b.is_occupied).length,
 }));

 // Enrich admissions with patient and bed info
 const patientMap = new Map(patientsData.map((p) => [p.id, p.name]));
 const bedMap = new Map(bedsData.map((b) => [b.id, b]));
 const wardMap = new Map(wardsData.map((w) => [w.id, w.name]));

 const enrichedAdmissions = admissionsData.map((a) => {
 const bed = a.bed_id ? bedMap.get(a.bed_id) : null;
 return {
 ...a,
 patient_name: patientMap.get(a.patient_id) || t('hospital.unknown_patient'),
 bed_number: bed?.bed_number,
 ward_name: bed ? wardMap.get(bed.ward_id) : undefined,
 };
 });

 setWards(enrichedWards);
 setBeds(bedsData);
 setAdmissions(enrichedAdmissions);
 setPatients(patientsData);
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleCreateWard = () => {
 setModalType('ward');
 setEditingId(null);
 form.resetFields();
 setModalVisible(true);
 };

 const handleCreateAdmission = () => {
 setModalType('admission');
 setEditingId(null);
 form.resetFields();
 setModalVisible(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 if (modalType === 'ward') {
 if (editingId) {
 await api.patch(`/api/hospital/wards/${editingId}`, values);
 } else {
 await api.post('/api/hospital/wards', values);
 }
 } else {
 if (editingId) {
 await api.patch(`/api/hospital/admissions/${editingId}`, values);
 } else {
 await api.post('/api/hospital/admissions', {
 ...values,
 admitted_at: new Date().toISOString(),
 status: 'active',
 });
 }
 }
 void message.success(t('saved'));
 setModalVisible(false);
 void fetchData();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const handleDischarge = async (admissionId: string) => {
 try {
 await api.post(`/api/hospital/admissions/${admissionId}/discharge`, {
 summary: t('hospital.discharged_summary_default'),
 });
 void message.success(t('hospital.patient_discharged'));
 void fetchData();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const handleDeleteWard = async (id: string) => {
 try {
 await api.delete(`/api/hospital/wards/${id}`);
 void message.success(t('deleted'));
 void fetchData();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const wardColumns: ColumnsType<Ward> = [
 { title: t('hospital.ward_name'), dataIndex: 'name', key: 'name' },
 { title: t('hospital.floor'), dataIndex: 'floor', key: 'floor' },
 {
 title: t('hospital.beds'),
 key: 'beds',
 render: (_: unknown, record: Ward) => `${record.occupied_beds || 0} / ${record.capacity}`,
 },
 {
 title: '',
 key: 'actions',
 width: 100,
 render: (_: unknown, record: Ward) => (
 <Popconfirm title={t('confirm_delete')} onConfirm={() => void handleDeleteWard(record.id)}>
 <Button danger>
 {t('delete')}
 </Button>
 </Popconfirm>
 ),
 },
 ];

 const admissionColumns: ColumnsType<Admission> = [
 { title: t('hospital.patient'), dataIndex: 'patient_name', key: 'patient_name' },
 { title: t('hospital.ward'), dataIndex: 'ward_name', key: 'ward_name' },
 { title: t('hospital.bed'), dataIndex: 'bed_number', key: 'bed_number' },
 {
 title: t('hospital.admitted_at'),
 dataIndex: 'admitted_at',
 key: 'admitted_at',
 render: (date: string) => date?.substring(0, 10),
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => <StatusTag status={status} label={t(`hospital.status_${status}`)} />,
 },
 {
 title: '',
 key: 'actions',
 width: 120,
 render: (_: unknown, record: Admission) =>
 record.status === 'active' ? (
 <Popconfirm title={t('hospital.confirm_discharge')} onConfirm={() => void handleDischarge(record.id)}>
 <Button type="primary">
 {t('hospital.discharge')}
 </Button>
 </Popconfirm>
 ) : null,
 },
 ];

 const totalBeds = wards.reduce((sum, w) => sum + w.capacity, 0);
 const occupiedBeds = wards.reduce((sum, w) => sum + (w.occupied_beds || 0), 0);
 const activeAdmissions = admissions.filter((a) => a.status === 'active').length;

 return (
 <div>
 <PageHeader
 title={t('hospital.wards_admissions')}
 subtitle={t('hospital.wards_subtitle')}
 />

 <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
 <Col xs={24} sm={8}>
 <KpiCard title={t('hospital.total_beds')} value={totalBeds} icon={<HomeOutlined />} tone="primary" />
 </Col>
 <Col xs={24} sm={8}>
 <KpiCard title={t('hospital.occupied_beds')} value={occupiedBeds} icon={<HomeOutlined />} tone="warning" />
 </Col>
 <Col xs={24} sm={8}>
 <KpiCard title={t('hospital.active_admissions')} value={activeAdmissions} icon={<UserOutlined />} tone="success" />
 </Col>
 </Row>

 <Tabs
 defaultActiveKey="wards"
 items={[
 {
 key: 'wards',
 label: t('hospital.wards'),
 children: (
 <>
 <Space style={{ marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateWard}>
 {t('hospital.new_ward')}
 </Button>
 </Space>
 <ResponsiveTableAdapter dataSource={wards} columns={wardColumns} rowKey="id" loading={loading} />
 </>
 ),
 },
 {
 key: 'admissions',
 label: t('hospital.admissions'),
 children: (
 <>
 <Space style={{ marginBottom: 16 }}>
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateAdmission}>
 {t('hospital.new_admission')}
 </Button>
 </Space>
 <ResponsiveTableAdapter dataSource={admissions} columns={admissionColumns} rowKey="id" loading={loading} />
 </>
 ),
 },
 ]}
 />

 <FormDialog
 title={
 modalType === 'ward'
 ? editingId ? t('hospital.edit_ward') : t('hospital.new_ward')
 : editingId ? t('hospital.edit_admission') : t('hospital.new_admission')
 }
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => void handleSave()}
 >
 <Form form={form} layout="vertical">
 {modalType === 'ward' ? (
 <>
 <Form.Item name="name" label={t('hospital.ward_name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="floor" label={t('hospital.floor')}>
 <Input />
 </Form.Item>
 <Form.Item name="capacity" label={t('hospital.capacity')} initialValue={10}>
 <Input type="number" />
 </Form.Item>
 </>
 ) : (
 <>
 <Form.Item name="patient_id" label={t('hospital.patient')} rules={[{ required: true }]}>
 <Select
 showSearch
 placeholder={t('hospital.select_patient')}
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {patients.map((p) => (
 <Select.Option key={p.id} value={p.id}>
 {p.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="bed_id" label={t('hospital.bed')}>
 <Select
 showSearch
 placeholder={t('hospital.select_bed')}
 filterOption={(input, option) =>
 String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
 }
 >
 {beds
 .filter((b) => !b.is_occupied)
 .map((b) => (
 <Select.Option key={b.id} value={b.id}>
 {b.bed_number} ({wards.find((w) => w.id === b.ward_id)?.name})
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="reason" label={t('hospital.reason')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 </>
 )}
 </Form>
 </FormDialog>
 </div>
 );
};

export default WardsAdmissions;
