import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tabs, Button, Space, Typography, Statistic, Row, Col, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReloadOutlined, FullscreenOutlined } from '@ant-design/icons';
import { usePOSFloorStore } from '../../stores/posFloor';
import api from '../../api';
import { message } from '../../utils/message';
import { StatusTag } from '../../design-system';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Text } = Typography;

interface TableShapeProps {
 table: any;
 onClick: () => void;
}

const TableShape: React.FC<TableShapeProps> = ({ table, onClick }) => {
 const { t: _t } = useTranslation();
 
 const stateColors: Record<string, string> = {
 available: 'var(--success-500)',
 occupied: 'var(--danger-500)',
 reserved: 'var(--warning-500)',
 paying: 'var(--info-500)',
 };

 const bgColor = stateColors[table.state] || 'var(--ink-300)';
 const isRound = table.shape === 'round';

 return (
 <div
 onClick={onClick}
 style={{
 position: 'absolute',
 // Floor-plan coordinates are physical canvas positions, not
 // directional — tables must not flip when the locale is RTL.
 left: table.position_x, // rtl-ignore
 top: table.position_y,
 width: table.width,
 height: table.height,
 backgroundColor: bgColor,
 borderRadius: isRound ? '50%' : table.shape === 'rectangle' ? 8 : 4,
 border: '2px solid #fff',
 cursor: 'pointer',
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 justifyContent: 'center',
 color: '#fff',
 fontWeight: 'bold',
 fontSize: 14,
 boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
 transition: 'transform 0.2s',
 }}
 onMouseEnter={(e) => {
 e.currentTarget.style.transform = 'scale(1.05)';
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.transform = 'scale(1)';
 }}
 >
 <div>{table.name}</div>
 <div style={{ fontSize: 11 }}>
 {table.state === 'occupied' && table.current_guests > 0 && `👥 ${table.current_guests}`}
 </div>
 </div>
 );
};

const POSFloorPlan: React.FC = () => {
 const { configId } = useParams<{ configId: string }>();
 const { t } = useTranslation();
 const navigate = useNavigate();
 const { floors, tables, activeFloorId, loadFloors, setActiveFloor, refresh } = usePOSFloorStore();
 
 const [selectedTable, setSelectedTable] = useState<any | null>(null);
 const [drawerVisible, setDrawerVisible] = useState(false);
 const [guestsModalVisible, setGuestsModalVisible] = useState(false);
 const [guestCount, setGuestCount] = useState(1);
 const [tempTableId, setTempTableId] = useState<string | null>(null);

 useEffect(() => {
 if (configId) {
 loadFloors(configId);
 }
 }, [configId]);

 useEffect(() => {
 // Auto-refresh every 5 seconds
 const interval = setInterval(() => {
 refresh();
 }, 5000);

 return () => clearInterval(interval);
 }, []);

 const handleTableClick = async (table: any) => {
 if (table.state === 'available') {
 // Prompt for guests
 setTempTableId(table.id);
 setGuestCount(1);
 setGuestsModalVisible(true);
 } else if (table.state === 'occupied') {
 // Show order details
 setSelectedTable(table);
 setDrawerVisible(true);
 }
 };

 const handleStartOrder = async () => {
 if (!tempTableId) return;
 
 try {
 // First, we need to get an active session for this config
 const sessionRes = await api.get('/api/pos/sessions', {
 params: { config_id: configId, state: 'opened', page_size: 1 },
 });
 
 if (!sessionRes.data.items || sessionRes.data.items.length === 0) {
 message.error(t('pos.no_open_session'));
 return;
 }
 
 const sessionId = sessionRes.data.items[0].id;
 
 // Navigate to terminal with table and guests info
 navigate(`/pos/terminal/${sessionId}?table_id=${tempTableId}&guests=${guestCount}`);
 setGuestsModalVisible(false);
 } catch {
 message.error(t('error'));
 }
 };

 const handleFreeTable = async (tableId: string) => {
 try {
 await api.post(`/api/pos/tables/${tableId}/free`);
 message.success(t('pos.table_freed'));
 setDrawerVisible(false);
 refresh();
 } catch {
 message.error(t('error'));
 }
 };

 const activeTables = tables.filter((t) => t.floor_id === activeFloorId);

 return (
 <div style={{ padding: 24 }}>
 <Card
 title={t('pos.floor_plan')}
 extra={
 <Space>
 <Button icon={<ReloadOutlined />} onClick={refresh}>
 {t('refresh')}
 </Button>
 <Button icon={<FullscreenOutlined />} onClick={() => document.documentElement.requestFullscreen()}>
 {t('pos.fullscreen')}
 </Button>
 </Space>
 }
 >
 <Tabs
 activeKey={activeFloorId || undefined}
 onChange={setActiveFloor}
 items={floors.map((floor) => ({
 key: floor.id,
 label: floor.name,
 children: (
 <div
 style={{
 position: 'relative',
 width: 1200,
 height: 800,
 backgroundColor: 'var(--surface-2)',
 backgroundImage: floor.background_image_url ? `url(${floor.background_image_url})` : undefined,
 backgroundSize: 'cover',
 border: '1px solid var(--border)',
 margin: '0 auto',
 }}
 >
 {activeTables.map((table) => (
 <TableShape key={table.id} table={table} onClick={() => handleTableClick(table)} />
 ))}
 </div>
 ),
 }))}
 />
 </Card>

 <FormDialog
 title={t('pos.table_details')}
 onClose={() => setDrawerVisible(false)}
 open={drawerVisible}
 >
 {selectedTable && (
 <Space orientation="vertical" style={{ width: '100%' }}>
 <Row gutter={16}>
 <Col span={12}>
 <Statistic title={t('pos.table')} value={selectedTable.name} />
 </Col>
 <Col span={12}>
 <Statistic title={t('pos.guests')} value={selectedTable.current_guests || 0} />
 </Col>
 </Row>
 <div>
 <Text strong>{t('pos.state')}:</Text>{' '}
 <StatusTag status={selectedTable.state === 'occupied' ? 'error' : 'active'} label={t(`pos.table_state_${selectedTable.state}`)} />
 </div>
 {selectedTable.current_order_id && (
 <div>
 <Text strong>{t('pos.order_id')}:</Text> {selectedTable.current_order_id}
 </div>
 )}
 <Space>
 {selectedTable.current_order_id && (
 <Button type="primary" onClick={() => navigate(`/pos/orders`)}>
 {t('pos.view_order')}
 </Button>
 )}
 <Button onClick={() => handleFreeTable(selectedTable.id)}>
 {t('pos.free_table')}
 </Button>
 </Space>
 </Space>
 )}
 </FormDialog>

 <FormDialog
 title={t('pos.enter_guests')}
 open={guestsModalVisible}
 onClose={() => setGuestsModalVisible(false)}
 onOk={handleStartOrder}
 >
 <Space orientation="vertical" style={{ width: '100%' }}>
 <Text>{t('pos.how_many_guests')}</Text>
 <InputNumber
 min={1}
 max={20}
 value={guestCount}
 onChange={(val) => setGuestCount(val || 1)}
 style={{ width: '100%' }}
 />
 </Space>
 </FormDialog>
 </div>
 );
};

export default POSFloorPlan;
