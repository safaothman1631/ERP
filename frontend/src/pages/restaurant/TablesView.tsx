import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Space, message, Typography, Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined } from '@ant-design/icons';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space, radius } from '../../theme/tokens';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Text } = Typography;

interface RestTable {
 id: string;
 number: string;
 seats: number;
 section?: string;
 status: 'free' | 'occupied' | 'reserved' | 'cleaning';
 current_order_id?: string;
}

interface Order {
 id: string;
 table_id?: string;
 order_type: string;
 items: Array<{ name: string; qty: number; price: number }>;
 customer_name?: string;
 status?: string;
}

const TablesView: React.FC = () => {
 const { t } = useTranslation();
 const [tables, setTables] = useState<RestTable[]>([]);
 const [_loading, setLoading] = useState(false);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [selectedTable, setSelectedTable] = useState<RestTable | null>(null);
 const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

 useEffect(() => {
 void fetchTables();
 }, []);

 const fetchTables = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/restaurant/tables');
 setTables(res.data.items || []);
 } catch {
 void message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleTableClick = async (table: RestTable) => {
 setSelectedTable(table);
 setDrawerOpen(true);
 if (table.current_order_id) {
 try {
 const res = await api.get(`/api/restaurant/orders/${table.current_order_id}`);
 setCurrentOrder(res.data);
 } catch {
 setCurrentOrder(null);
 }
 } else {
 setCurrentOrder(null);
 }
 };

 const handleOpenOrder = async () => {
 if (!selectedTable) return;
 try {
 const res = await api.post('/api/restaurant/orders', {
 table_id: selectedTable.id,
 order_type: 'dine_in',
 items: [],
 });
 void message.success(t('restaurant.order_opened'));
 setCurrentOrder(res.data);
 void fetchTables();
 } catch {
 void message.error(t('error'));
 }
 };

 const statusColor = (status: string) => {
 switch (status) {
 case 'free':
 return 'var(--success-500)';
 case 'occupied':
 return 'var(--info-500)';
 case 'reserved':
 return 'var(--warning-500)';
 case 'cleaning':
 return 'var(--border-strong)';
 default:
 return 'var(--border-strong)';
 }
 };

 return (
 <div>
 <PageHeader
 title={t('restaurant.tables')}
 subtitle={t('restaurant.tables_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => void message.info(t('restaurant.add_table_hint'))}>
 {t('restaurant.add_table')}
 </Button>
 }
 />

 <Row gutter={[space.md, space.md]}>
 {tables.map(table => (
 <Col key={table.id} xs={12} sm={8} md={6} lg={4}>
 <Badge
 count={table.status === 'occupied' ? t('restaurant.status_occupied') : undefined}
 style={{ backgroundColor: statusColor(table.status) }}
 >
 <Card
 hoverable
 onClick={() => void handleTableClick(table)}
 style={{
 textAlign: 'center',
 borderRadius: radius.md,
 backgroundColor: statusColor(table.status),
 opacity: table.status === 'cleaning' ? 0.6 : 1,
 cursor: 'pointer',
 minHeight: 100,
 display: 'flex',
 flexDirection: 'column',
 justifyContent: 'center',
 }}
 >
 <Text strong style={{ fontSize: 18, color: 'var(--on-accent)' }}>
 {table.number}
 </Text>
 <br />
 <Text style={{ fontSize: 12, color: 'var(--on-accent)' }}>
 {table.seats} {t('restaurant.seats')}
 </Text>
 </Card>
 </Badge>
 </Col>
 ))}
 </Row>

 <FormDialog
 title={selectedTable ? `${t('restaurant.table')} ${selectedTable.number}` : ''}
 open={drawerOpen}
 onClose={() => setDrawerOpen(false)}
 >
 {selectedTable && (
 <Space direction="vertical" style={{ width: '100%' }}>
 <Text>
 {t('status')}: <strong>{t(`restaurant.status_${selectedTable.status}`)}</strong>
 </Text>
 <Text>
 {t('restaurant.seats')}: <strong>{selectedTable.seats}</strong>
 </Text>
 {selectedTable.section && (
 <Text>
 {t('restaurant.section')}: <strong>{selectedTable.section}</strong>
 </Text>
 )}

 {currentOrder ? (
 <Card title={t('restaurant.current_order')} style={{ marginTop: 16 }}>
 <Text>{t('restaurant.order_id')}: {currentOrder.id}</Text>
 <br />
 <Text>
 {t('restaurant.items')}: {currentOrder.items?.length || 0}
 </Text>
 </Card>
 ) : (
 <Button
 type="primary"
 icon={<PlusOutlined />}
 block
 style={{ marginTop: 16 }}
 onClick={() => void handleOpenOrder()}
 >
 {t('restaurant.open_order')}
 </Button>
 )}
 </Space>
 )}
 </FormDialog>
 </div>
 );
};

export default TablesView;
