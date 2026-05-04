import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Tag, message, Card, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ToolOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';

const { TextArea } = Input;

const Repairs: React.FC = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<any>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/repairs/orders', { params: { limit: 100 } });
      setOrders(res.data.items || []);
    } catch (error) {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, []);

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await api.patch(`/api/repairs/orders/${editing.id}`, values);
      } else {
        await api.post('/api/repairs/orders', values);
      }
      message.success(t('success'));
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      void fetchOrders();
    } catch {
      message.error(t('error'));
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.patch(`/api/repairs/orders/${id}`, { status });
      message.success(t('success'));
      void fetchOrders();
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t('are_you_sure'),
      onOk: async () => {
        await api.delete(`/api/repairs/orders/${id}`);
        message.success(t('success'));
        void fetchOrders();
      },
    });
  };

  const openEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const statusColors: Record<string, string> = {
    received: 'blue',
    diagnosing: 'orange',
    repairing: 'purple',
    ready: 'green',
    delivered: 'cyan',
    cancelled: 'red',
  };

  const columns = [
    { title: t('repairs.order_id'), dataIndex: 'id', key: 'id', width: 120 },
    { title: t('repairs.customer'), dataIndex: 'customer_name', key: 'customer_name' },
    { title: t('repairs.product'), dataIndex: 'product_name', key: 'product_name' },
    { title: t('repairs.serial'), dataIndex: 'serial_no', key: 'serial_no' },
    { title: t('repairs.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v] || 'default'}>{t(`repairs.status_${v}`)}</Tag> },
    { title: t('repairs.warranty'), dataIndex: 'is_under_warranty', key: 'is_under_warranty', render: (v: boolean) => v ? <Tag color="green">{t('repairs.warranty_yes')}</Tag> : <Tag>{t('repairs.warranty_no')}</Tag> },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          {record.status === 'diagnosing' && (
            <Button icon={<ToolOutlined />} size="small" type="primary" onClick={() => handleStatusChange(record.id, 'repairing')} title={t('repairs.start_repair')} />
          )}
          {record.status === 'repairing' && (
            <Button size="small" type="primary" onClick={() => handleStatusChange(record.id, 'ready')} title={t('repairs.mark_ready')}>{t('repairs.ready')}</Button>
          )}
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('repairs.title')}
        subtitle={t('repairs.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            {t('repairs.new_order')}
          </Button>
        }
      />
      <Card style={{ marginTop: space.md }}>
        <Table dataSource={orders} columns={columns} loading={loading} rowKey="id" />
      </Card>

      <Modal
        title={editing ? t('repairs.edit_order') : t('repairs.new_order')}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="customer_name" label={t('repairs.customer')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="product_name" label={t('repairs.product')}>
            <Input />
          </Form.Item>
          <Form.Item name="serial_no" label={t('repairs.serial')}>
            <Input />
          </Form.Item>
          <Form.Item name="issue_description" label={t('repairs.issue')} rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="estimated_cost" label={t('repairs.estimated_cost')} initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="is_under_warranty" label={t('repairs.warranty')} valuePropName="checked" initialValue={false}>
            <Select>
              <Select.Option value={false}>{t('repairs.warranty_no')}</Select.Option>
              <Select.Option value={true}>{t('repairs.warranty_yes')}</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Repairs;
