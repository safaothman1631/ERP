import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, DatePicker, Row, Col, message, Form, Input, Select } from 'antd';
import { EditOutlined, ReloadOutlined, EyeOutlined, EyeInvisibleOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { FormDialog } from '../../components/responsive/FormDialog';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';
import { RelatedDataPanel } from '../../design-system/empty/RelatedDataPanel';
import { useLoadingState } from '../../hooks/useLoadingState';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../../i18n/types';

dayjs.extend(relativeTime);

const { RangePicker } = DatePicker;

interface Device {
 id: string;
 name: string;
 device_type: string;
 serial_number?: string;
 location?: string;
 status: string;
 last_seen_at?: string;
 api_key?: string;
 registered_at: string;
}

interface Reading {
 id: string;
 metric: string;
 value: number;
 unit?: string;
 timestamp: string;
}

const DeviceDetail: React.FC = () => {
 const { id } = useParams<{ id: string }>();
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [form] = Form.useForm();
 const [loading, setLoading] = useState(true);
 const { showSkeleton } = useLoadingState(loading);
 const [device, setDevice] = useState<Device | null>(null);
 const [latestReadings, setLatestReadings] = useState<Reading[]>([]);
 const [telemetryData, setTelemetryData] = useState<Record<string, any[]>>({});
 const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(24, 'hour'), dayjs()]);
 const [showApiKey, setShowApiKey] = useState(false);
 const [editModalVisible, setEditModalVisible] = useState(false);

 useEffect(() => {
 if (id) {
 loadDevice();
 loadLatest();
 loadTelemetry();
 }
 }, [id, timeRange]);

 const loadDevice = async () => {
 try {
 setLoading(true);
 const res = await api.get(`/api/iot/devices/${id}`);
 setDevice(res.data);
 } catch (err) {
 message.error(t('common.load_failed', 'Failed to load'));
 } finally {
 setLoading(false);
 }
 };

 const loadLatest = async () => {
 try {
 const res = await api.get(`/api/iot/devices/${id}/latest`);
 setLatestReadings(res.data.readings);
 } catch (err) {
 console.error('Failed to load latest:', err);
 }
 };

 const loadTelemetry = async () => {
 try {
 const from = timeRange[0].toISOString();
 const to = timeRange[1].toISOString();
 const res = await api.get(`/api/iot/devices/${id}/telemetry`, {
 params: { from, to, limit: 1000 }
 });
 
 // Group by metric
 const grouped: Record<string, any[]> = {};
 res.data.items.forEach((item: Reading) => {
 if (!grouped[item.metric]) grouped[item.metric] = [];
 grouped[item.metric].push({
 timestamp: dayjs(item.timestamp).valueOf(),
 value: item.value,
 displayTime: dayjs(item.timestamp).format('HH:mm:ss')
 });
 });
 
 // Sort by timestamp
 Object.keys(grouped).forEach(metric => {
 grouped[metric].sort((a, b) => a.timestamp - b.timestamp);
 });
 
 setTelemetryData(grouped);
 } catch (err) {
 console.error('Failed to load telemetry:', err);
 }
 };

 const handleEdit = () => {
 if (device) {
 form.setFieldsValue(device);
 setEditModalVisible(true);
 }
 };

 const handleUpdate = async () => {
 try {
 const values = await form.validateFields();
 await api.put(`/api/iot/devices/${id}`, values);
 message.success(t('common.updated', 'Updated'));
 setEditModalVisible(false);
 loadDevice();
 } catch (err) {
 message.error(t('common.save_failed', 'Save failed'));
 }
 };

 const statusColor = (status: string) => {
 const map: Record<string, string> = {
 active: 'success',
 inactive: 'default',
 error: 'error'
 };
 return map[status] || 'default';
 };

 if (showSkeleton || !device) {
 return <LoadingSkeleton variant="card" />;
 }

 return (
 <div style={{ padding: '24px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
 <h1>
 {device.name} 
 <Tag color={statusColor(device.status)} style={{ marginLeft: 8 }}>
 {t(`iot.status_${device.status}`, device.status)}
 </Tag>
 </h1>
 <Space>
 <Button icon={<EditOutlined />} onClick={handleEdit}>
 {t('common.edit', 'Edit')}
 </Button>
 <Button icon={<ReloadOutlined />} onClick={() => {
 loadDevice();
 loadLatest();
 loadTelemetry();
 }}>
 {t('common.refresh', 'Refresh')}
 </Button>
 </Space>
 </div>

 <Card title={t('iot.device_info', 'Device Information')} style={{ marginBottom: 16 }}>
 <Descriptions column={{ xs: 1, sm: 2, md: 3 }}>
 <Descriptions.Item label={t('iot.device_type', 'Type')}>
 {t(`iot.device_type_${device.device_type}`, device.device_type)}
 </Descriptions.Item>
 <Descriptions.Item label={t('iot.location', 'Location')}>
 {device.location || t('common.not_set', 'Not set')}
 </Descriptions.Item>
 <Descriptions.Item label={t('iot.serial_number', 'Serial')}>
 {device.serial_number || t('common.not_set', 'Not set')}
 </Descriptions.Item>
 <Descriptions.Item label={t('iot.api_key', 'API Key')}>
 <Space>
 <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
 {showApiKey ? device.api_key : '••••••••••••••••••••••••••••••••'}
 </span>
 <Button 
 icon={showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
 onClick={() => setShowApiKey(!showApiKey)}
 />
 {showApiKey && (
 <Button
 icon={<CopyOutlined />}
 onClick={() => {
 navigator.clipboard.writeText(device.api_key || '');
 message.success(t('common.copied', 'Copied'));
 }}
 />
 )}
 </Space>
 </Descriptions.Item>
 <Descriptions.Item label={t('iot.last_seen', 'Last Seen')}>
 {device.last_seen_at ? dayjs(device.last_seen_at).fromNow() : t('common.never', 'Never')}
 </Descriptions.Item>
 <Descriptions.Item label={t('iot.registered_at', 'Registered')}>
 {dayjs(device.registered_at).format('YYYY-MM-DD HH:mm')}
 </Descriptions.Item>
 </Descriptions>
 </Card>

 <Card title={t('iot.latest_readings', 'Latest Readings')} style={{ marginBottom: 16 }}>
 <RelatedDataPanel
 entity="device_reading"
 data={latestReadings}
 emptyTitleKey="iot.no_readings_title"
 emptyTitleFallback="No telemetry data yet"
 emptyDescriptionKey="iot.no_readings_description"
 emptyDescriptionFallback="Readings from this device will appear here once it sends data."
 >
 <Row gutter={16}>
 {latestReadings.map(reading => (
 <Col xs={24} sm={12} md={8} key={reading.id} style={{ marginBottom: 8 }}>
 <Card>
 <div style={{ fontSize: 16, fontWeight: 600 }}>
 {reading.value} {reading.unit || ''}
 </div>
 <div style={{ fontSize: 12, color: '#8c8c8c' }}>
 {reading.metric}
 </div>
 <div style={{ fontSize: 11, color: '#bfbfbf' }}>
 {dayjs(reading.timestamp).fromNow()}
 </div>
 </Card>
 </Col>
 ))}
 </Row>
 </RelatedDataPanel>
 </Card>

 <Card 
 title={t('iot.telemetry', 'Telemetry')}
 extra={
 <RangePicker
 showTime
 value={timeRange}
 onChange={(dates) => {
 if (dates && dates[0] && dates[1]) {
 setTimeRange([dates[0], dates[1]]);
 }
 }}
 presets={[
 { label: t('iot.last_hour', 'Last Hour'), value: [dayjs().subtract(1, 'hour'), dayjs()] },
 { label: t('iot.last_24h', 'Last 24h'), value: [dayjs().subtract(24, 'hour'), dayjs()] },
 { label: t('iot.last_7d', 'Last 7 days'), value: [dayjs().subtract(7, 'day'), dayjs()] },
 { label: t('iot.last_30d', 'Last 30 days'), value: [dayjs().subtract(30, 'day'), dayjs()] }
 ]}
 />
 }
 >
 {Object.keys(telemetryData).length > 0 ? (
 Object.entries(telemetryData).map(([metric, data]) => (
 <div key={metric} style={{ marginBottom: 24 }}>
 <h3>{metric}</h3>
 <ResponsiveChart
 legendItems={[
 { id: metric, labelKey: asTranslationKey(`iot.metric_${metric}`), color: '#1890ff' },
 ]}
 >
 <LineChart data={data}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis 
 dataKey="displayTime" 
 tick={{ fontSize: 11 }}
 />
 <YAxis />
 <Tooltip />
 <Line type="monotone" dataKey="value" stroke="#1890ff" strokeWidth={2} dot={false} />
 </LineChart>
 </ResponsiveChart>
 </div>
 ))
 ) : (
 <div style={{ textAlign: 'center', color: '#8c8c8c', padding: '40px 0' }}>
 {t('iot.no_telemetry', 'No telemetry data for selected time range')}
 </div>
 )}
 </Card>

 <FormDialog
 title={t('iot.edit_device', 'Edit Device')}
 open={editModalVisible}
 onOk={handleUpdate}
 onClose={() => setEditModalVisible(false)}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('iot.name', 'Name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="device_type" label={t('iot.device_type', 'Type')} rules={[{ required: true }]}>
 <Select>
 <Select.Option value="sensor">{t('iot.device_type_sensor', 'Sensor')}</Select.Option>
 <Select.Option value="printer">{t('iot.device_type_printer', 'Printer')}</Select.Option>
 <Select.Option value="camera">{t('iot.device_type_camera', 'Camera')}</Select.Option>
 <Select.Option value="scanner">{t('iot.device_type_scanner', 'Scanner')}</Select.Option>
 <Select.Option value="gateway">{t('iot.device_type_gateway', 'Gateway')}</Select.Option>
 <Select.Option value="other">{t('iot.device_type_other', 'Other')}</Select.Option>
 </Select>
 </Form.Item>
 <Form.Item name="serial_number" label={t('iot.serial_number', 'Serial Number')}>
 <Input />
 </Form.Item>
 <Form.Item name="location" label={t('iot.location', 'Location')}>
 <Input />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default DeviceDetail;
