import React, { useEffect, useState } from 'react';
import { Tabs, Button, Form, Input, Select, Space, message, Popconfirm, Tag } from 'antd';
import type { TabsProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import api from '../../api';
import { PageHeader, StatusTag } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface RoomType {
 id: string;
 name: string;
 base_price: number;
 max_occupancy: number;
 amenities: string[];
}

interface Room {
 id: string;
 room_type_id: string;
 number: string;
 floor?: string;
 status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'out_of_order';
}

interface Guest {
 id: string;
 name: string;
 email?: string;
 phone?: string;
}

interface Reservation {
 id: string;
 guest_id: string;
 room_id?: string;
 room_type_id?: string;
 check_in_date: string;
 check_out_date: string;
 adults: number;
 children: number;
 rate: number;
 status: string;
 source: string;
 guest_name?: string;
 room_number?: string;
}

const RoomsBookings: React.FC = () => {
 const { t } = useTranslation();
 const [activeTab, setActiveTab] = useState('rooms');
 const [rooms, setRooms] = useState<Room[]>([]);
 const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
 const [reservations, setReservations] = useState<Reservation[]>([]);
 const [_guests, setGuests] = useState<Guest[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();

 useEffect(() => {
 void fetchData();
 }, []);

 const fetchData = async () => {
 setLoading(true);
 try {
 const [roomsRes, typesRes, resRes, guestsRes] = await Promise.all([
 api.get('/api/hotel/rooms'),
 api.get('/api/hotel/room-types'),
 api.get('/api/hotel/reservations'),
 api.get('/api/hotel/guests'),
 ]);
 setRooms(roomsRes.data.items || []);
 setRoomTypes(typesRes.data.items || []);
 const reservationsData = resRes.data.items || [];
 const guestsData = guestsRes.data.items || [];
 setGuests(guestsData);
 const enriched = reservationsData.map((r: Reservation) => ({
 ...r,
 guest_name: guestsData.find((g: Guest) => g.id === r.guest_id)?.name || '',
 room_number: roomsRes.data.items.find((rm: Room) => rm.id === r.room_id)?.number || '',
 }));
 setReservations(enriched);
 } catch {
 void message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleOpenModal = (record?: Room) => {
 if (record) {
 setEditingId(record.id);
 form.setFieldsValue(record);
 } else {
 setEditingId(null);
 form.resetFields();
 }
 setModalOpen(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 if (editingId) {
 await api.patch(`/api/hotel/rooms/${editingId}`, values);
 void message.success(t('updated'));
 } else {
 await api.post('/api/hotel/rooms', values);
 void message.success(t('created'));
 }
 setModalOpen(false);
 void fetchData();
 } catch {
 void message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/hotel/rooms/${id}`);
 void message.success(t('deleted'));
 void fetchData();
 } catch {
 void message.error(t('error'));
 }
 };

 const handleCheckin = async (id: string, roomId?: string) => {
 if (!roomId) {
 void message.error(t('hotel.room_required'));
 return;
 }
 try {
 await api.post(`/api/hotel/reservations/${id}/checkin`, { room_id: roomId });
 void message.success(t('hotel.checked_in'));
 void fetchData();
 } catch {
 void message.error(t('error'));
 }
 };

 const handleCheckout = async (id: string) => {
 try {
 await api.post(`/api/hotel/reservations/${id}/checkout`);
 void message.success(t('hotel.checked_out'));
 void fetchData();
 } catch {
 void message.error(t('error'));
 }
 };

 const roomColumns: ColumnsType<Room> = [
 { title: t('hotel.room_number'), dataIndex: 'number', key: 'number' },
 { title: t('hotel.floor'), dataIndex: 'floor', key: 'floor' },
 {
 title: t('hotel.room_type'),
 dataIndex: 'room_type_id',
 key: 'room_type_id',
 render: (id: string) => roomTypes.find(rt => rt.id === id)?.name || id,
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => <StatusTag status={status} label={t(`hotel.status_${status}`)} />,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: unknown, record: Room) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
 <Popconfirm title={t('confirm_delete')} onConfirm={() => void handleDelete(record.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 const reservationColumns: ColumnsType<Reservation> = [
 { title: t('hotel.guest'), dataIndex: 'guest_name', key: 'guest_name' },
 { title: t('hotel.room'), dataIndex: 'room_number', key: 'room_number' },
 { title: t('hotel.check_in'), dataIndex: 'check_in_date', key: 'check_in_date' },
 { title: t('hotel.check_out'), dataIndex: 'check_out_date', key: 'check_out_date' },
 { title: t('hotel.adults'), dataIndex: 'adults', key: 'adults' },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => <Tag color={status === 'confirmed' ? 'blue' : status === 'checked_in' ? 'green' : 'default'}>{t(`hotel.status_${status}`)}</Tag>,
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: unknown, record: Reservation) => (
 <Space>
 {record.status === 'confirmed' && (
 <Button
 icon={<LoginOutlined />}
 type="primary"
 onClick={() => void handleCheckin(record.id, record.room_id)}
 >
 {t('hotel.checkin')}
 </Button>
 )}
 {record.status === 'checked_in' && (
 <Button
 icon={<LogoutOutlined />}
 onClick={() => void handleCheckout(record.id)}
 >
 {t('hotel.checkout')}
 </Button>
 )}
 </Space>
 ),
 },
 ];

 const items: TabsProps['items'] = [
 {
 key: 'rooms',
 label: t('hotel.rooms'),
 children: (
 <>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => handleOpenModal()}
 style={{ marginBottom: 16 }}
 >
 {t('hotel.add_room')}
 </Button>
 <ResponsiveTableAdapter
 columns={roomColumns}
 dataSource={rooms}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 </>
 ),
 },
 {
 key: 'bookings',
 label: t('hotel.bookings'),
 children: (
 <ResponsiveTableAdapter
 columns={reservationColumns}
 dataSource={reservations}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20 }}
 />
 ),
 },
 ];

 return (
 <div>
 <PageHeader title={t('hotel.rooms_bookings')} subtitle={t('hotel.manage_rooms_bookings')} />
 <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />

 <FormDialog
 title={editingId ? t('hotel.edit_room') : t('hotel.add_room')}
 open={modalOpen}
 onOk={() => void handleSave()}
 onCancel={() => setModalOpen(false)}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="room_type_id" label={t('hotel.room_type')} rules={[{ required: true }]}>
 <Select>
 {roomTypes.map(rt => (
 <Select.Option key={rt.id} value={rt.id}>
 {rt.name}
 </Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="number" label={t('hotel.room_number')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="floor" label={t('hotel.floor')}>
 <Input />
 </Form.Item>
 <Form.Item name="status" label={t('status')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="available">{t('hotel.status_available')}</Select.Option>
 <Select.Option value="occupied">{t('hotel.status_occupied')}</Select.Option>
 <Select.Option value="cleaning">{t('hotel.status_cleaning')}</Select.Option>
 <Select.Option value="maintenance">{t('hotel.status_maintenance')}</Select.Option>
 <Select.Option value="out_of_order">{t('hotel.status_out_of_order')}</Select.Option>
 </Select>
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default RoomsBookings;
