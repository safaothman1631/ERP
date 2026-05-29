import { useEffect, useState } from 'react';
import { Card, Button, Form, Input, InputNumber, Select, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { HelpIcon } from '../help/HelpIcon';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';

interface Item { id: string; name: string; sku?: string; }
interface Component { item_id: string; item_name?: string; quantity: number; unit?: string; }
interface BOM {
 id: string; product_id: string; product_name?: string; code?: string;
 quantity: number; components: Component[]; routing?: string[]; status?: string;
}
interface WC { id: string; name: string; }

export default function MfgBOMs() {
 const { t } = useTranslation();
 const [list, setList] = useState<BOM[]>([]);
 const [items, setItems] = useState<Item[]>([]);
 const [centers, setCenters] = useState<WC[]>([]);
 const [open, setOpen] = useState(false);
 const [editing, setEditing] = useState<BOM | null>(null);
 const [form] = Form.useForm();

 const load = async () => {
 const [b, i, w] = await Promise.all([
 api.get('/api/manufacturing/boms'),
 api.get('/api/items'),
 api.get('/api/manufacturing/work-centers'),
 ]);
 setList(b.data.items || []);
 setItems(i.data.items || i.data || []);
 setCenters(w.data.items || []);
 };
 useEffect(() => { load(); }, []);

 const save = async () => {
 const v = await form.validateFields();
 const product = items.find(it => it.id === v.product_id);
 v.product_name = product?.name;
 v.components = (v.components || []).map((c: Component) => ({
 ...c,
 item_name: items.find(it => it.id === c.item_id)?.name,
 }));
 try {
 if (editing) await api.put(`/api/manufacturing/boms/${editing.id}`, v);
 else await api.post('/api/manufacturing/boms', v);
 message.success(t('saved'));
 setOpen(false); setEditing(null); form.resetFields();
 load();
 } catch { message.error(t('error')); }
 };

 const remove = async (id: string) => {
 try { await api.delete(`/api/manufacturing/boms/${id}`); load(); }
 catch { message.error(t('error')); }
 };
 const startEdit = (b: BOM) => { setEditing(b); form.setFieldsValue(b); setOpen(true); };

 const cols = [
 { title: t('product'), dataIndex: 'product_name' },
 { title: t('code'), dataIndex: 'code' },
 { title: t('quantity'), dataIndex: 'quantity' },
 { title: t('components'), key: 'comp', render: (_: unknown, r: BOM) => (r.components || []).length },
 { title: t('status'), dataIndex: 'status' },
 {
 title: t('actions'),
 render: (_: unknown, r: BOM) => (
 <Space>
 <Button icon={<EditOutlined />} onClick={() => startEdit(r)} />
 <Popconfirm title={t('confirm_archive')} onConfirm={() => remove(r.id)}>
 <Button danger icon={<DeleteOutlined />} />
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <div style={{ padding: 16 }} data-section-id="manufacturing.boms">
 <Space style={{ marginBottom: 12 }}>
 <h2 style={{ margin: 0 }}>{t('boms')}</h2>
 <HelpIcon sectionId="manufacturing.boms" />
 <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
 <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
 {t('new_bom')}
 </Button>
 </Space>
 <Card><ResponsiveTableAdapter rowKey="id" dataSource={list} columns={cols} pagination={{ pageSize: 20 }} /></Card>

 <FormDialog open={open} onOk={save} onClose={() => setOpen(false)} title={editing ? t('edit_bom') : t('new_bom')}>
 <Form form={form} layout="vertical">
 <Form.Item name="product_id" label={t('product')} rules={[{ required: true }]}>
 <SelectWithQuickCreate entity="item" showSearch allowClear />
 </Form.Item>
 <Form.Item name="code" label={t('code')}><Input /></Form.Item>
 <Form.Item name="quantity" label={t('quantity')} initialValue={1}><InputNumber style={{ width: '100%' }} min={0.001} /></Form.Item>
 <Form.List name="components">
 {(fields, { add, remove }) => (
 <>
 <h4>{t('components')}</h4>
 {fields.map(({ key, name }) => (
 <Space key={key} style={{ display: 'flex' }} align="baseline">
 <Form.Item name={[name, 'item_id']} rules={[{ required: true }]} style={{ minWidth: 220 }}>
 <Select showSearch optionFilterProp="label" placeholder={t('item')}
 options={items.map(i => ({ value: i.id, label: i.name }))} />
 </Form.Item>
 <Form.Item name={[name, 'quantity']} rules={[{ required: true }]}>
 <InputNumber min={0.001} placeholder={t('quantity')} />
 </Form.Item>
 <Form.Item name={[name, 'unit']}>
 <Input placeholder={t('unit')} />
 </Form.Item>
 <Button danger onClick={() => remove(name)} icon={<DeleteOutlined />} />
 </Space>
 ))}
 <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>{t('add_component')}</Button>
 </>
 )}
 </Form.List>
 <Form.Item name="routing" label={t('routing')} style={{ marginTop: 12 }}>
 <Select mode="multiple" allowClear options={centers.map(c => ({ value: c.id, label: c.name }))} />
 </Form.Item>
 <Form.Item name="status" label={t('status')} initialValue="active">
 <Select options={[{ value: 'active', label: t('active') }, { value: 'archived', label: t('archived') }]} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
