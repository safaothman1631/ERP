import React, { useEffect, useState } from 'react';
import { Calendar, Badge, Card, Button, Form, Input, Select, DatePicker, TimePicker, message, Space, Tag, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { PageHeader, StatusTag } from '../../design-system';
import api from '../../api';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Appointment {
 id: string;
 patient_id: string;
 patient_name?: string;
 scheduled_at: string;
 duration_minutes: number;
 status: string;
 reason?: string;
 doctor_id?: string;
}

interface Patient {
 id: string;
 name: string;
}

const AppointmentsCalendar: React.FC = () => {
 const { t } = useTranslation();
 const [form] = Form.useForm();
 const [loading, setLoading] = useState(false);
 const [appointments, setAppointments] = useState<Appointment[]>([]);
 const [patients, setPatients] = useState<Patient[]>([]);
 const [drawerVisible, setDrawerVisible] = useState(false);
 const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
 const [editingId, setEditingId] = useState<string | null>(null);

 useEffect(() => {
 void fetchAppointments();
 void fetchPatients();
 }, []);

 const fetchAppointments = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/healthcare/appointments', { params: { limit: 500 } });
 setAppointments(res.data.items);
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchPatients = async () => {
 try {
 const res = await api.get('/api/healthcare/patients', { params: { limit: 500 } });
 setPatients(res.data.items);
 } catch (error) {
 console.error(error);
 }
 };

 const handleCreate = (date?: Dayjs) => {
 setEditingId(null);
 form.resetFields();
 if (date) {
 form.setFieldsValue({ date: date });
 }
 setDrawerVisible(true);
 };

 const handleEdit = (appointment: Appointment) => {
 setEditingId(appointment.id);
 const dt = dayjs(appointment.scheduled_at);
 form.setFieldsValue({
 patient_id: appointment.patient_id,
 date: dt,
 time: dt,
 duration_minutes: appointment.duration_minutes,
 reason: appointment.reason,
 status: appointment.status,
 });
 setDrawerVisible(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 const scheduled_at = dayjs(values.date).format('YYYY-MM-DD') + ' ' + dayjs(values.time).format('HH:mm:ss');
 const payload = {
 patient_id: values.patient_id,
 scheduled_at,
 duration_minutes: values.duration_minutes || 30,
 reason: values.reason,
 status: values.status || 'scheduled',
 };

 if (editingId) {
 await api.patch(`/api/healthcare/appointments/${editingId}`, payload);
 void message.success(t('saved'));
 } else {
 await api.post('/api/healthcare/appointments', payload);
 void message.success(t('created'));
 }
 setDrawerVisible(false);
 void fetchAppointments();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/healthcare/appointments/${id}`);
 void message.success(t('deleted'));
 void fetchAppointments();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const handleStatusChange = async (id: string, status: string) => {
 try {
 await api.patch(`/api/healthcare/appointments/${id}`, { status });
 void message.success(t('saved'));
 void fetchAppointments();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const getAppointmentsForDate = (date: Dayjs) => {
 const dateStr = date.format('YYYY-MM-DD');
 return appointments.filter((a) => a.scheduled_at?.startsWith(dateStr));
 };

 const dateCellRender = (value: Dayjs) => {
 const list = getAppointmentsForDate(value);
 return (
 <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
 {list.map((item) => {
 const color =
 item.status === 'completed' ? 'green' :
 item.status === 'cancelled' ? 'red' :
 item.status === 'in_progress' ? 'blue' : 'default';
 return (
 <li key={item.id}>
 <Badge color={color} text={item.scheduled_at?.substring(11, 16)} />
 </li>
 );
 })}
 </ul>
 );
 };

 const selectedDayAppointments = getAppointmentsForDate(selectedDate);

 return (
 <div>
 <PageHeader
 title={t('healthcare.appointments_calendar')}
 subtitle={t('healthcare.calendar_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => handleCreate(selectedDate)}>
 {t('healthcare.new_appointment')}
 </Button>
 }
 />

 <Card>
 <Calendar
 cellRender={dateCellRender}
 onSelect={(date) => setSelectedDate(date)}
 />
 </Card>

 <Card title={`${t('healthcare.appointments_on')} ${selectedDate.format('YYYY-MM-DD')}`} style={{ marginTop: 16 }}>
 <Space direction="vertical" style={{ width: '100%' }}>
 {selectedDayAppointments.length === 0 && <p>{t('healthcare.no_appointments')}</p>}
 {selectedDayAppointments.map((apt) => {
 const patient = patients.find((p) => p.id === apt.patient_id);
 return (
 <Card key={apt.id} style={{ marginBottom: 8 }}>
 <Space direction="vertical" style={{ width: '100%' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <Space>
 <ClockCircleOutlined />
 <strong>{apt.scheduled_at?.substring(11, 16)}</strong>
 <span>— {patient?.name || t('healthcare.unknown_patient')}</span>
 <StatusTag status={apt.status} label={t(`healthcare.status_${apt.status}`)} />
 </Space>
 <Space>
 <Button onClick={() => handleEdit(apt)}>{t('edit')}</Button>
 {apt.status === 'scheduled' && (
 <Button type="primary" onClick={() => void handleStatusChange(apt.id, 'in_progress')}>
 {t('healthcare.check_in')}
 </Button>
 )}
 {apt.status === 'in_progress' && (
 <Button onClick={() => void handleStatusChange(apt.id, 'completed')}>
 {t('healthcare.complete')}
 </Button>
 )}
 <Popconfirm title={t('confirm_delete')} onConfirm={() => void handleDelete(apt.id)}>
 <Button danger>{t('delete')}</Button>
 </Popconfirm>
 </Space>
 </div>
 {apt.reason && <p style={{ margin: 0, color: '#666' }}>{apt.reason}</p>}
 </Space>
 </Card>
 );
 })}
 </Space>
 </Card>

 <FormDialog
 title={editingId ? t('healthcare.edit_appointment') : t('healthcare.new_appointment')}
 open={drawerVisible}
 onClose={() => setDrawerVisible(false)}
 extra={
 <Button type="primary" onClick={() => void handleSave()}>
 {t('save')}
 </Button>
 }
 >
 <Form form={form} layout="vertical">
 <Form.Item name="patient_id" label={t('healthcare.patient')} rules={[{ required: true }]}>
 <Select
 showSearch
 placeholder={t('healthcare.select_patient')}
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
 <Form.Item name="date" label={t('date')} rules={[{ required: true }]}>
 <DatePicker style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="time" label={t('healthcare.time')} rules={[{ required: true }]}>
 <TimePicker format="HH:mm" style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="duration_minutes" label={t('healthcare.duration_minutes')} initialValue={30}>
 <Input type="number" />
 </Form.Item>
 <Form.Item name="reason" label={t('healthcare.reason')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 <Form.Item name="status" label={t('status')} initialValue="scheduled">
 <Select>
 <Select.Option value="scheduled">{t('healthcare.status_scheduled')}</Select.Option>
 <Select.Option value="in_progress">{t('healthcare.status_in_progress')}</Select.Option>
 <Select.Option value="completed">{t('healthcare.status_completed')}</Select.Option>
 <Select.Option value="cancelled">{t('healthcare.status_cancelled')}</Select.Option>
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default AppointmentsCalendar;
