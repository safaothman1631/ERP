import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Tag, message, Card, Tabs, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserAddOutlined, TrophyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { TextArea } = Input;

const HRExtended: React.FC = () => {
 const { t } = useTranslation();
 const [activeTab, setActiveTab] = useState('recruitment');
 const [applications, setApplications] = useState<any[]>([]);
 const [appraisals, setAppraisals] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [editing, setEditing] = useState<any>(null);

 const fetchApplications = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/hr-extended/applications', { params: { limit: 100 } });
 setApplications(res.data.items || []);
 } catch (error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchAppraisals = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/hr-extended/appraisals', { params: { limit: 100 } });
 setAppraisals(res.data.items || []);
 } catch (error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (activeTab === 'recruitment') {
 void fetchApplications();
 } else {
 void fetchAppraisals();
 }
 }, [activeTab]);

 const handleSaveApplication = async (values: any) => {
 try {
 if (editing) {
 await api.patch(`/api/hr-extended/applications/${editing.id}`, values);
 } else {
 await api.post('/api/hr-extended/applications', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditing(null);
 void fetchApplications();
 } catch {
 message.error(t('error'));
 }
 };

 const handleSaveAppraisal = async (values: any) => {
 try {
 if (editing) {
 await api.patch(`/api/hr-extended/appraisals/${editing.id}`, values);
 } else {
 await api.post('/api/hr-extended/appraisals', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditing(null);
 void fetchAppraisals();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = (id: string, type: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/hr-extended/${type}/${id}`);
 message.success(t('success'));
 if (type === 'applications') void fetchApplications();
 else void fetchAppraisals();
 },
 });
 };

 const statusColors: Record<string, string> = {
 applied: 'blue',
 screening: 'orange',
 interview: 'purple',
 offer: 'cyan',
 hired: 'green',
 rejected: 'red',
 };

 const applicationsColumns = [
 { title: t('hr_extended.application_id'), dataIndex: 'id', key: 'id', width: 120 },
 { title: t('hr_extended.candidate'), dataIndex: 'candidate_id', key: 'candidate_id' },
 { title: t('hr_extended.position'), dataIndex: 'position_id', key: 'position_id' },
 { title: t('hr_extended.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v] || 'default'}>{t(`hr_extended.status_${v}`)}</Tag> },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id, 'applications')} />
 </Space>
 ),
 },
 ];

 const appraisalsColumns = [
 { title: t('hr_extended.appraisal_id'), dataIndex: 'id', key: 'id', width: 120 },
 { title: t('hr_extended.employee'), dataIndex: 'employee_id', key: 'employee_id' },
 { title: t('hr_extended.cycle'), dataIndex: 'cycle_id', key: 'cycle_id' },
 { title: t('hr_extended.rating'), dataIndex: 'overall_rating', key: 'overall_rating', render: (v: number) => v ? <Tag color="blue">{v}/5</Tag> : '-' },
 { title: t('hr_extended.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'completed' ? 'green' : 'orange'}>{t(`hr_extended.appraisal_status_${v}`)}</Tag> },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id, 'appraisals')} />
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('hr_extended.title')}
 subtitle={t('hr_extended.subtitle')}
 extra={
 <Button
 type="primary"
 icon={activeTab === 'recruitment' ? <UserAddOutlined /> : <TrophyOutlined />}
 onClick={() => {
 setEditing(null);
 form.resetFields();
 setModalOpen(true);
 }}
 >
 {activeTab === 'recruitment' ? t('hr_extended.new_application') : t('hr_extended.new_appraisal')}
 </Button>
 }
 />
 <Card style={{ marginTop: space.md }}>
 <Tabs activeKey={activeTab} onChange={setActiveTab}>
 <Tabs.TabPane tab={t('hr_extended.recruitment')} key="recruitment">
 <ResponsiveTableAdapter dataSource={applications} columns={applicationsColumns} loading={loading} rowKey="id" />
 </Tabs.TabPane>
 <Tabs.TabPane tab={t('hr_extended.appraisals')} key="appraisals">
 <ResponsiveTableAdapter dataSource={appraisals} columns={appraisalsColumns} loading={loading} rowKey="id" />
 </Tabs.TabPane>
 </Tabs>
 </Card>

 <FormDialog
 title={
 activeTab === 'recruitment'
 ? (editing ? t('hr_extended.edit_application') : t('hr_extended.new_application'))
 : (editing ? t('hr_extended.edit_appraisal') : t('hr_extended.new_appraisal'))
 }
 open={modalOpen}
 onClose={() => {
 setModalOpen(false);
 form.resetFields();
 setEditing(null);
 }}
 onOk={() => form.submit()}
 >
 {activeTab === 'recruitment' ? (
 <Form form={form} layout="vertical" onFinish={handleSaveApplication}>
 <Form.Item name="candidate_id" label={t('hr_extended.candidate')} rules={[{ required: true }]}>
 <Input placeholder={t('hr_extended.candidate_id_placeholder')} />
 </Form.Item>
 <Form.Item name="position_id" label={t('hr_extended.position')} rules={[{ required: true }]}>
 <Input placeholder={t('hr_extended.position_id_placeholder')} />
 </Form.Item>
 <Form.Item name="notes" label={t('hr_extended.notes')}>
 <TextArea rows={3} />
 </Form.Item>
 </Form>
 ) : (
 <Form form={form} layout="vertical" onFinish={handleSaveAppraisal}>
 <Form.Item name="employee_id" label={t('hr_extended.employee')} rules={[{ required: true }]}>
 <Input placeholder={t('hr_extended.employee_id_placeholder')} />
 </Form.Item>
 <Form.Item name="cycle_id" label={t('hr_extended.cycle')} rules={[{ required: true }]}>
 <Input placeholder={t('hr_extended.cycle_id_placeholder')} />
 </Form.Item>
 <Form.Item name="notes" label={t('hr_extended.notes')}>
 <TextArea rows={3} />
 </Form.Item>
 </Form>
 )}
 </FormDialog>
 </div>
 );
};

export default HRExtended;
