import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Select, InputNumber, DatePicker, Input, Space, Tag, message, Drawer, Descriptions } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';

interface MO {
  id: string; number: string; product_name?: string; quantity: number;
  status?: string; scheduled_date?: string; produced_qty?: number;
  components?: { item_name?: string; required_qty: number }[];
  work_orders?: WO[];
}
interface WO {
  id: string; sequence?: number; work_center_name?: string; status?: string;
  duration_minutes?: number;
}
interface BOM { id: string; product_name?: string; quantity: number; }

export default function MfgOrders() {
  const { t } = useTranslation();
  const [list, setList] = useState<MO[]>([]);
  const [boms, setBOMs] = useState<BOM[]>([]);
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState<MO | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    const [m, b] = await Promise.all([api.get('/api/manufacturing/orders'), api.get('/api/manufacturing/boms')]);
    setList(m.data.items || []);
    setBOMs(b.data.items || []);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const v = await form.validateFields();
    if (v.scheduled_date) v.scheduled_date = v.scheduled_date.format('YYYY-MM-DD');
    try {
      await api.post('/api/manufacturing/orders', v);
      message.success(t('saved'));
      setOpen(false); form.resetFields();
      load();
    } catch { message.error(t('error')); }
  };

  const showMO = async (id: string) => {
    const r = await api.get(`/api/manufacturing/orders/${id}`);
    setDrawer(r.data);
  };

  const confirmMO = async (id: string) => {
    try { await api.post(`/api/manufacturing/orders/${id}/confirm`); load(); if (drawer) showMO(id); }
    catch { message.error(t('error')); }
  };
  const doneMO = async (id: string) => {
    try { await api.post(`/api/manufacturing/orders/${id}/done`); load(); setDrawer(null); }
    catch { message.error(t('error')); }
  };
  const removeMO = async (id: string) => {
    try { await api.delete(`/api/manufacturing/orders/${id}`); load(); }
    catch { message.error(t('error')); }
  };
  const startWO = async (id: string) => {
    try { await api.post(`/api/manufacturing/work-orders/${id}/start`); if (drawer) showMO(drawer.id); }
    catch { message.error(t('error')); }
  };
  const finishWO = async (id: string) => {
    try { await api.post(`/api/manufacturing/work-orders/${id}/finish`); if (drawer) showMO(drawer.id); }
    catch { message.error(t('error')); }
  };

  const cols = [
    { title: '#', dataIndex: 'number' },
    { title: t('product'), dataIndex: 'product_name' },
    { title: t('quantity'), dataIndex: 'quantity' },
    { title: t('produced'), dataIndex: 'produced_qty' },
    { title: t('scheduled_date'), dataIndex: 'scheduled_date' },
    { title: t('status'), dataIndex: 'status',
      render: (s?: string) => {
        const c = s === 'done' ? 'green' : s === 'confirmed' ? 'blue' : 'orange';
        return <Tag color={c}>{s}</Tag>;
      } },
    {
      title: t('actions'),
      render: (_: unknown, r: MO) => (
        <Space>
          <Button size="small" onClick={() => showMO(r.id)}>{t('view')}</Button>
          {r.status === 'draft' && <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => confirmMO(r.id)} />}
          {r.status === 'confirmed' && <Button size="small" type="primary" onClick={() => doneMO(r.id)}>{t('done')}</Button>}
          {r.status !== 'done' && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeMO(r.id)} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{t('manufacturing_orders')}</h2>
        <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('new_mo')}</Button>
      </Space>
      <Card><Table rowKey="id" dataSource={list} columns={cols} pagination={{ pageSize: 20 }} /></Card>

      <Modal open={open} onOk={submit} onCancel={() => setOpen(false)} title={t('new_mo')} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="bom_id" label={t('bom')} rules={[{ required: true }]}>
            <Select options={boms.map(b => ({ value: b.id, label: b.product_name }))} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="quantity" label={t('quantity')} initialValue={1}><InputNumber style={{ width: '100%' }} min={0.001} /></Form.Item>
          <Form.Item name="scheduled_date" label={t('scheduled_date')}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label={t('notes')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Drawer open={!!drawer} onClose={() => setDrawer(null)} size={760} title={drawer?.number}>
        {drawer && (
          <>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label={t('product')}>{drawer.product_name}</Descriptions.Item>
              <Descriptions.Item label={t('quantity')}>{drawer.quantity}</Descriptions.Item>
              <Descriptions.Item label={t('status')}>{drawer.status}</Descriptions.Item>
              <Descriptions.Item label={t('produced')}>{drawer.produced_qty}</Descriptions.Item>
            </Descriptions>
            <h4>{t('components')}</h4>
            <Table
              size="small"
              rowKey={(r, i) => `${i}`}
              pagination={false}
              dataSource={drawer.components || []}
              columns={[
                { title: t('item'), dataIndex: 'item_name' },
                { title: t('required_qty'), dataIndex: 'required_qty', align: 'right' as const },
              ]}
            />
            <h4 style={{ marginTop: 16 }}>{t('work_orders')}</h4>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={drawer.work_orders || []}
              columns={[
                { title: '#', dataIndex: 'sequence' },
                { title: t('work_center'), dataIndex: 'work_center_name' },
                { title: t('status'), dataIndex: 'status', render: (s: string) => <Tag>{s}</Tag> },
                { title: t('duration_min'), dataIndex: 'duration_minutes', align: 'right' as const },
                {
                  title: t('actions'),
                  render: (_: unknown, r: WO) => (
                    <Space>
                      {r.status === 'pending' && <Button size="small" icon={<PlayCircleOutlined />} onClick={() => startWO(r.id)}>{t('start')}</Button>}
                      {r.status === 'in_progress' && <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => finishWO(r.id)}>{t('finish')}</Button>}
                    </Space>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
