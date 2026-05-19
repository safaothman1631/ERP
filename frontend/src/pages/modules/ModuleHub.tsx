import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Tabs, Button, Form, Input, InputNumber, Select, DatePicker, Empty, Space, Tag, Popconfirm, Alert } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import api from '../../api';
import { message } from '../../utils/message';
import { getModuleBySlug, type ResourceConfig, type ResourceField } from './moduleConfigs';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { TextArea } = Input;

interface ListResponse {
 items?: any[];
 total?: number;
}

function ResourceTab({ basePath, resource }: { basePath: string; resource: ResourceConfig }) {
 const { t } = useTranslation();
 const [items, setItems] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [endpointMissing, setEndpointMissing] = useState(false);
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [submitting, setSubmitting] = useState(false);
 const [search, setSearch] = useState('');
 const [form] = Form.useForm();

 const url = `${basePath}/${resource.key}`;

 const load = async () => {
 setLoading(true);
 setEndpointMissing(false);
 try {
 const r = await api.get<ListResponse>(url, { params: { limit: 100 } });
 const data = r.data;
 setItems(Array.isArray(data) ? data : (data?.items || []));
 } catch (e: any) {
 const status = e?.response?.status;
 if (status === 404 || status === 405) {
 setEndpointMissing(true);
 setItems([]);
 } else {
 message.error(e?.response?.data?.detail || t('hub_load_error'));
 }
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { load(); /* eslint-disable-next-line */ }, [url]);

 const normalizeValues = (raw: Record<string, any>) => {
 const out: Record<string, any> = {};
 for (const k of Object.keys(raw)) {
 let v = raw[k];
 if (v == null || v === '') continue;
 if (v && typeof v === 'object' && typeof v.format === 'function') {
 const fld = resource.fields.find(f => f.name === k);
 v = fld?.type === 'datetime' ? v.toISOString() : v.format('YYYY-MM-DD');
 }
 out[k] = v;
 }
 return out;
 };

 const openCreate = () => {
 setEditingId(null);
 form.resetFields();
 setOpen(true);
 };

 const openEdit = (row: any) => {
 setEditingId(row.id);
 const initial: Record<string, any> = {};
 resource.fields.forEach(f => {
 const v = row[f.name];
 if (v == null || v === '') return;
 if (f.type === 'date' || f.type === 'datetime') {
 initial[f.name] = dayjs(v);
 } else {
 initial[f.name] = v;
 }
 });
 form.setFieldsValue(initial);
 setOpen(true);
 };

 const handleSubmit = async () => {
 try {
 const raw = await form.validateFields();
 const payload = normalizeValues(raw);
 setSubmitting(true);
 if (editingId) {
 await api.patch(`${url}/${editingId}`, payload);
 } else {
 await api.post(url, payload);
 }
 message.success(t('hub_saved'));
 setOpen(false);
 form.resetFields();
 setEditingId(null);
 load();
 } catch (e: any) {
 if (e?.errorFields) return;
 message.error(e?.response?.data?.detail || t('hub_save_error'));
 } finally {
 setSubmitting(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`${url}/${id}`);
 message.success(t('hub_deleted'));
 load();
 } catch (e: any) {
 message.error(e?.response?.data?.detail || t('hub_delete_error'));
 }
 };

 const columns = useMemo(() => {
 const cols: any[] = [];
 resource.fields.slice(0, 6).forEach(f => {
 cols.push({
 title: f.label,
 dataIndex: f.name,
 key: f.name,
 ellipsis: true,
 render: (v: any) => {
 if (v == null || v === '') return <span style={{ color: '#aaa' }}>—</span>;
 if (typeof v === 'boolean') return v ? <Tag color="green">✓</Tag> : <Tag>×</Tag>;
 if (f.type === 'date' && typeof v === 'string') return v.slice(0, 10);
 if (f.type === 'datetime' && typeof v === 'string') return dayjs(v).format('YYYY-MM-DD HH:mm');
 if (typeof v === 'object') return <span style={{ color: '#888' }}>[object]</span>;
 const s = String(v);
 return s.length > 50 ? s.slice(0, 50) + '…' : s;
 },
 });
 });
 cols.push({
 title: 'حاڵەت',
 dataIndex: 'status',
 key: 'status',
 width: 110,
 render: (v: any) => v ? <Tag color="blue">{v}</Tag> : <span style={{ color: '#aaa' }}>—</span>,
 });
 cols.push({
 title: '',
 key: 'actions',
 width: 90,
 fixed: 'right' as const,
 render: (_: any, row: any) => (
 <Space>
 <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
 <Popconfirm title={t('hub_confirm_delete')} onConfirm={() => handleDelete(row.id)}>
 <Button type="text" danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 });
 return cols;
 // eslint-disable-next-line
 }, [resource.key, t]);

 const filtered = useMemo(() => {
 if (!search.trim()) return items;
 const q = search.trim().toLowerCase();
 return items.filter(row =>
 Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q))
 );
 }, [items, search]);

 const renderField = (fld: ResourceField) => {
 const rules = fld.required ? [{ required: true, message: t('hub_required') }] : [];
 let control;
 if (fld.type === 'number') control = <InputNumber style={{ width: '100%' }} />;
 else if (fld.type === 'date') control = <DatePicker style={{ width: '100%' }} />;
 else if (fld.type === 'datetime') control = <DatePicker showTime style={{ width: '100%' }} />;
 else if (fld.type === 'select') control = (
 <Select allowClear options={(fld.options || []).map(o => ({ value: o, label: o }))} />
 );
 else if (fld.type === 'textarea') control = <TextArea rows={3} />;
 else control = <Input />;
 return (
 <Form.Item key={fld.name} name={fld.name} label={fld.label} rules={rules}>
 {control}
 </Form.Item>
 );
 };

 return (
 <>
 <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
 <Space wrap>
 <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={endpointMissing}>
 {t('hub_add_new')}
 </Button>
 <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
 {t('hub_refresh')}
 </Button>
 </Space>
 <Space>
 <Input
 allowClear
 prefix={<SearchOutlined />}
 placeholder={t('hub_search')}
 value={search}
 onChange={e => setSearch(e.target.value)}
 style={{ width: 240 }}
 />
 <Tag color="default">{t('hub_total')}: {filtered.length}</Tag>
 </Space>
 </Space>

 {endpointMissing && (
 <Alert
 type="warning"
 showIcon
 message={t('hub_endpoint_missing')}
 description={url}
 style={{ marginBottom: 12 }}
 />
 )}

 <ResponsiveTableAdapter
 rowKey="id"
 dataSource={filtered}
 columns={columns}
 loading={loading}
 pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (n) => `${t('hub_total')}: ${n}` }}
 locale={{ emptyText: <Empty description={t('hub_empty')} /> }}
 scroll={{ x: 'max-content' }}
 onRow={(row) => ({ onDoubleClick: () => openEdit(row) })}
 />

 <FormDialog
 title={`${editingId ? t('hub_edit') : t('hub_add_new')} — ${resource.label}`}
 open={open}
 onOk={handleSubmit}
 onClose={() => { setOpen(false); form.resetFields(); setEditingId(null); }}
 confirmLoading={submitting}
 >
 <Form form={form} layout="vertical">
 {resource.fields.map(renderField)}
 </Form>
 </FormDialog>
 </>
 );
}

export default function ModuleHub() {
 const { t } = useTranslation();
 const { slug = '' } = useParams();
 const mod = getModuleBySlug(slug);

 if (!mod) {
 return (
 <Card>
 <Empty description={`${t('hub_module_not_found')}: "${slug}"`} />
 </Card>
 );
 }

 // i18n key per module slug — falls back to config.title
 const i18nKey = `mod_${mod.slug.replace(/-/g, '_')}`;
 const translated = t(i18nKey, { defaultValue: mod.title });

 return (
 <div>
 <Card
 title={<span style={{ fontSize: 20, fontWeight: 600 }}>{translated}</span>}
 extra={<Tag color="purple">{mod.basePath}</Tag>}
 styles={{ body: { padding: '12px 16px' } }}
 >
 <Tabs
 items={mod.resources.map(r => ({
 key: r.key,
 label: r.label,
 children: <ResourceTab basePath={mod.basePath} resource={r} />,
 }))}
 />
 </Card>
 </div>
 );
}
