import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Select, DatePicker, Modal, Form, Input, InputNumber, Card } from 'antd';
import { PlusOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface ServiceOrder {
  id: string;
  order_number?: string;
  customer_name: string;
  address?: string;
  scheduled_at?: string;
  assigned_worker_id?: string;
  assigned_worker_name?: string;
  status: string;
  priority: string;
  description?: string;
}

interface Worker {
  id: string;
  name: string;
  is_active: boolean;
}

const ServiceOrders: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterTechnician, setFilterTechnician] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form] = Form.useForm();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [ordersRes, workersRes] = await Promise.all([
        api.get('/api/field-service/orders', { params: { limit: 500 } }),
        api.get('/api/field-service/workers', { params: { limit: 100 } }),
      ]);
      
      const ordersData = ordersRes.data.items || [];
      const workersData = workersRes.data.items || [];
      
      // Enrich orders with worker names
      const enriched = ordersData.map((o: Record<string, unknown>) => ({
        ...o,
        assigned_worker_name: workersData.find(
          (w: Record<string, unknown>) => w.id === o.assigned_worker_id
        )?.name,
      }));
      
      setOrders(enriched);
      setWorkers(workersData);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, []);

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await api.post('/api/field-service/orders', values);
      message.success(t('field_service.order_created'));
      setShowCreateModal(false);
      form.resetFields();
      void fetchOrders();
    } catch {
      message.error(t('error'));
    }
  };

  const handleBulkDispatch = () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('select_items'));
      return;
    }
    Modal.confirm({
      title: t('field_service.bulk_dispatch'),
      content: t('confirm'),
      onOk: async () => {
        try {
          // For simplicity, set status to 'scheduled' for selected orders
          await Promise.all(
            selectedRowKeys.map((id) =>
              api.patch(`/api/field-service/orders/${id}`, { status: 'scheduled' })
            )
          );
          message.success(t('success'));
          setSelectedRowKeys([]);
          void fetchOrders();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterTechnician && o.assigned_worker_id !== filterTechnician) return false;
    if (dateRange && o.scheduled_at) {
      const orderDate = dayjs(o.scheduled_at);
      if (orderDate.isBefore(dateRange[0]) || orderDate.isAfter(dateRange[1])) return false;
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    draft: 'default',
    scheduled: 'blue',
    in_progress: 'orange',
    done: 'green',
    cancelled: 'red',
  };

  const priorityColors: Record<string, string> = {
    low: 'default',
    normal: 'blue',
    high: 'orange',
    urgent: 'red',
  };

  const columns: ColumnsType<ServiceOrder> = [
    {
      title: t('field_service.order_number'),
      dataIndex: 'order_number',
      key: 'order_number',
      render: (num: string, record: ServiceOrder) => (
        <a onClick={() => navigate(`/field-service/orders/${record.id}`)}>{num || record.id.slice(0, 8)}</a>
      ),
    },
    {
      title: t('field_service.customer_name'),
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: t('field_service.address'),
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: t('field_service.scheduled_at'),
      dataIndex: 'scheduled_at',
      key: 'scheduled_at',
      render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: t('field_service.technician'),
      dataIndex: 'assigned_worker_name',
      key: 'assigned_worker_name',
      render: (name: string) => name || '-',
    },
    {
      title: t('field_service.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status]}>{t(`field_service.status_${status}`)}</Tag>
      ),
    },
    {
      title: t('field_service.priority'),
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={priorityColors[priority]}>{t(`field_service.priority_${priority}`)}</Tag>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('field_service.service_orders')}
        subtitle={t('field_service.title')}
        breadcrumb={[
          { label: t('dashboard'), to: '/' },
          { label: t('field_service.title') },
          { label: t('field_service.service_orders') },
        ]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreateModal(true)}>
            {t('field_service.new_order')}
          </Button>
        }
      />

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            placeholder={t('field_service.filter_status')}
            style={{ width: 160 }}
            allowClear
            value={filterStatus}
            onChange={setFilterStatus}
            options={['draft', 'scheduled', 'in_progress', 'done', 'cancelled'].map((s) => ({
              label: t(`field_service.status_${s}`),
              value: s,
            }))}
          />
          <Select
            placeholder={t('field_service.filter_technician')}
            style={{ width: 200 }}
            allowClear
            value={filterTechnician}
            onChange={setFilterTechnician}
            showSearch
            filterOption={(input, option) =>
              String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {workers.map((w) => (
              <Select.Option key={w.id} value={w.id}>
                {w.name}
              </Select.Option>
            ))}
          </Select>
          <RangePicker value={dateRange} onChange={(d) => setDateRange(d as [Dayjs, Dayjs] | null)} />
          <Button
            icon={<SendOutlined />}
            onClick={handleBulkDispatch}
            disabled={selectedRowKeys.length === 0}
          >
            {t('field_service.bulk_dispatch')}
          </Button>
        </Space>

        <Table
          dataSource={filteredOrders}
          columns={columns}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={t('field_service.new_order')}
        open={showCreateModal}
        onCancel={() => {
          setShowCreateModal(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="customer_name" label={t('field_service.customer_name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t('field_service.address')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="description" label={t('field_service.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="scheduled_at" label={t('field_service.scheduled_at')}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="assigned_worker_id" label={t('field_service.technician')}>
            <Select
              placeholder={t('field_service.select_technician')}
              showSearch
              filterOption={(input, option) =>
                String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {workers.filter((w) => w.is_active).map((w) => (
                <Select.Option key={w.id} value={w.id}>
                  {w.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority" label={t('field_service.priority')} initialValue="normal">
            <Select>
              {['low', 'normal', 'high', 'urgent'].map((p) => (
                <Select.Option key={p} value={p}>
                  {t(`field_service.priority_${p}`)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="latitude" label={t('field_service.latitude')}>
            <InputNumber style={{ width: '100%' }} step={0.000001} />
          </Form.Item>
          <Form.Item name="longitude" label={t('field_service.longitude')}>
            <InputNumber style={{ width: '100%' }} step={0.000001} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ServiceOrders;
