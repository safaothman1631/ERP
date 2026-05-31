import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Space, Typography, Badge, Dropdown, message, Modal } from 'antd';
import {
 PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined,
 ShareAltOutlined, StarOutlined, EllipsisOutlined, DashboardOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Title, Text } = Typography;

const MyDashboards: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [dashboards, setDashboards] = useState<any[]>([]);
 const [_loading, setLoading] = useState(true);
 const [createModalOpen, setCreateModalOpen] = useState(false);
 const [newName, setNewName] = useState('');

 useEffect(() => {
 fetchDashboards();
 }, []);

 const fetchDashboards = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/dashboards');
 setDashboards(res.data.data || []);
 } catch (_err) {
 message.error(t('load_error'));
 } finally {
 setLoading(false);
 }
 };

 const handleCreate = async () => {
 if (!newName.trim()) {
 message.error(t('name_required'));
 return;
 }
 try {
 const res = await api.post('/api/dashboards', { name: newName.trim(), widgets: [] });
 const newDash = res.data.data;
 message.success(t('dashboard_created'));
 setCreateModalOpen(false);
 setNewName('');
 navigate(`/dashboards/${newDash.id}/edit`);
 } catch (_err) {
 message.error(t('create_error'));
 }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('confirm_delete'),
 content: t('delete_dashboard_confirm'),
 okText: t('delete'),
 okType: 'danger',
 cancelText: t('cancel'),
 onOk: async () => {
 try {
 await api.delete(`/api/dashboards/${id}`);
 message.success(t('deleted'));
 fetchDashboards();
 } catch (_err) {
 message.error(t('delete_error'));
 }
 }
 });
 };

 const handleClone = async (id: string) => {
 try {
 await api.post(`/api/dashboards/${id}/clone`);
 message.success(t('dashboard_cloned'));
 fetchDashboards();
 } catch (_err) {
 message.error(t('clone_error'));
 }
 };

 const handleSetDefault = async (id: string) => {
 try {
 await api.post(`/api/dashboards/${id}/set-default`);
 message.success(t('set_as_default_success'));
 } catch (_err) {
 message.error(t('error'));
 }
 };

 const formatDate = (dateStr: string) => {
 if (!dateStr) return '';
 return new Date(dateStr).toLocaleDateString();
 };

 return (
 <div>
 <PageHeader
 title={t('my_dashboards')}
 subtitle={t('dashboards_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
 {t('new_dashboard')}
 </Button>
 }
 />

 <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
 {dashboards.map((dash) => (
 <Col xs={24} sm={12} lg={8} key={dash.id}>
 <Card
 hoverable
 onClick={() => navigate(`/dashboards/${dash.id}`)}
 actions={[
 <EditOutlined key="edit" onClick={(e) => { e.stopPropagation(); navigate(`/dashboards/${dash.id}/edit`); }} />,
 <CopyOutlined key="copy" onClick={(e) => { e.stopPropagation(); handleClone(dash.id); }} />,
 <Dropdown
 key="more"
 menu={{
 items: [
 { key: 'default', label: t('set_as_default'), icon: <StarOutlined />, onClick: () => handleSetDefault(dash.id) },
 { key: 'share', label: t('share'), icon: <ShareAltOutlined />, disabled: !dash.is_owner },
 { key: 'delete', label: t('delete'), icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(dash.id), disabled: !dash.is_owner }
 ]
 }}
 trigger={['click']}
 >
 <EllipsisOutlined onClick={(e) => e.stopPropagation()} />
 </Dropdown>
 ]}
 >
 <Space direction="vertical" style={{ width: '100%' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
 <Title level={5} style={{ margin: 0 }}>
 <DashboardOutlined style={{ marginInlineEnd: 8 }} />
 {dash.name}
 </Title>
 {dash.is_owner ? (
 <Badge color="blue" text={t('mine')} />
 ) : (
 <Badge color="green" text={t('shared_with_me')} />
 )}
 </div>
 <Text type="secondary">
 {t('widgets')}: {dash.widgets?.length || 0}
 </Text>
 <Text type="secondary" style={{ fontSize: 12 }}>
 {t('last_modified')}: {formatDate(dash.updated_at)}
 </Text>
 </Space>
 </Card>
 </Col>
 ))}
 </Row>

 <FormDialog
 title={t('new_dashboard')}
 open={createModalOpen}
 onOk={handleCreate}
 onClose={() => { setCreateModalOpen(false); setNewName(''); }}
 >
 <input
 type="text"
 placeholder={t('dashboard_name')}
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
 onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
 />
 </FormDialog>
 </div>
 );
};

export default MyDashboards;
