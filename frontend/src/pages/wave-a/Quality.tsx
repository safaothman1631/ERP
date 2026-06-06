import React, { useEffect, useState } from 'react';
import { Button, Space, Form, Input, Select, Tag, message, Card, InputNumber, Modal } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const Quality: React.FC = () => {
 const { t } = useTranslation();
 const [checks, setChecks] = useState<any[]>([]);
 const [points, setPoints] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [form] = Form.useForm();
 const [editing, setEditing] = useState<any>(null);

 const fetchChecks = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/quality/checks', { params: { limit: 100 } });
 setChecks(res.data.items || []);
 } catch (_error) {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const fetchPoints = async () => {
 try {
 const res = await api.get('/api/quality/points', { params: { limit: 100 } });
 setPoints(res.data.items || []);
 } catch { /* noop */ }
 };

 useEffect(() => {
 void fetchChecks();
 void fetchPoints();
 }, []);

 const handleSave = async (values: any) => {
 try {
 if (editing) {
 await api.patch(`/api/quality/checks/${editing.id}`, values);
 } else {
 await api.post('/api/quality/checks', values);
 }
 message.success(t('success'));
 setModalOpen(false);
 form.resetFields();
 setEditing(null);
 void fetchChecks();
 } catch {
 message.error(t('error'));
 }
 };

 const handlePass = async (id: string) => {
 try {
 await api.patch(`/api/quality/checks/${id}`, { result: 'pass' });
 message.success(t('quality.check_passed'));
 void fetchChecks();
 } catch {
 message.error(t('error'));
 }
 };

 const handleFail = async (id: string) => {
 try {
 await api.patch(`/api/quality/checks/${id}`, { result: 'fail' });
 message.success(t('quality.check_failed'));
 void fetchChecks();
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('are_you_sure'),
 onOk: async () => {
 await api.delete(`/api/quality/checks/${id}`);
 message.success(t('success'));
 void fetchChecks();
 },
 });
 };

 const columns = [
 { title: t('quality.check_id'), dataIndex: 'id', key: 'id', width: 120 },
 { title: t('quality.point'), dataIndex: 'point_id', key: 'point_id' },
 { title: t('quality.product'), dataIndex: 'product_id', key: 'product_id' },
 { title: t('quality.result'), dataIndex: 'result', key: 'result', render: (v: string) => v ? <Tag color={v === 'pass' ? 'green' : 'red'}>{t(`quality.result_${v}`)}</Tag> : <Tag color="default">{t('quality.pending')}</Tag> },
 { title: t('quality.measure'), dataIndex: 'measure', key: 'measure' },
 {
 title: t('actions'),
 key: 'actions',
 render: (_: any, record: any) => (
 <Space>
 {!record.result && (
 <>
 <Button icon={<CheckCircleOutlined />} type="primary" onClick={() => handlePass(record.id)} title={t('quality.pass')} />
 <Button icon={<CloseCircleOutlined />} danger onClick={() => handleFail(record.id)} title={t('quality.fail')} />
 </>
 )}
 <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('quality.title')}
 subtitle={t('quality.subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
 {t('quality.new_check')}
 </Button>
 }
 />
 <Card style={{ marginTop: space.md }}>
 <ResponsiveTableAdapter dataSource={checks} columns={columns} loading={loading} rowKey="id" />
 </Card>

 <FormDialog
 title={editing ? t('quality.edit_check') : t('quality.new_check')}
 open={modalOpen}
 onClose={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="point_id" label={t('quality.point')}>
 <Select placeholder={t('quality.select_point')}>
 {points.map((p) => (
 <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
 ))}
 </Select>
 </Form.Item>
 <Form.Item name="product_id" label={t('quality.product')}>
 <Input placeholder={t('quality.product_id_placeholder')} />
 </Form.Item>
 <Form.Item name="measure" label={t('quality.measure')}>
 <InputNumber style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item name="notes" label={t('quality.notes')}>
 <Input.TextArea rows={3} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default Quality;
