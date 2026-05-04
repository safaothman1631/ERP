import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm, Badge } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, KeyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Device {
  id: string;
  name: string;
  device_type: string;
  serial_number?: string;
  location?: string;
  status: string;
  last_seen_at?: string;
  api_key?: string;
}

const IoTDevices: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<any>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, [page, pageSize, filters]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize
      };
      if (filters.status) params.status = filters.status;
      if (filters.device_type) params.device_type = filters.device_type;
      if (filters.location) params.location = filters.location;

      const res = await api.get('/api/iot/devices', { params });
      setDevices(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      message.error(t('common.load_failed', 'Failed to load'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Device) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await api.put(`/api/iot/devices/${editingId}`, values);
        message.success(t('common.updated', 'Updated'));
      } else {
        const res = await api.post('/api/iot/devices', values);
        message.success(t('common.created', 'Created'));
        // Show API key
        setNewApiKey(res.data.api_key);
        setKeyModalVisible(true);
      }
      setModalVisible(false);
      loadDevices();
    } catch (err) {
      message.error(t('common.save_failed', 'Save failed'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/iot/devices/${id}`);
      message.success(t('common.deleted', 'Deleted'));
      loadDevices();
    } catch (err) {
      message.error(t('common.delete_failed', 'Delete failed'));
    }
  };

  const handleRegenerateKey = async (id: string) => {
    try {
      const res = await api.post(`/api/iot/devices/${id}/regenerate-key`);
      setNewApiKey(res.data.api_key);
      setKeyModalVisible(true);
      message.success(t('iot.key_regenerated', 'API key regenerated'));
    } catch (err) {
      message.error(t('common.operation_failed', 'Operation failed'));
    }
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      active: 'success',
      inactive: 'default',
      error: 'error'
    };
    return map[status] || 'default';
  };

  const columns = [
    {
      title: t('iot.name', 'Name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Device) => (
        <Space>
          <Badge 
            status={record.status === 'active' ? 'success' : record.status === 'error' ? 'error' : 'default'} 
          />
          {text}
        </Space>
      )
    },
    {
      title: t('iot.device_type', 'Type'),
      dataIndex: 'device_type',
      key: 'device_type',
      render: (val: string) => t(`iot.device_type_${val}`, val)
    },
    {
      title: t('iot.location', 'Location'),
      dataIndex: 'location',
      key: 'location'
    },
    {
      title: t('iot.serial_number', 'Serial'),
      dataIndex: 'serial_number',
      key: 'serial_number'
    },
    {
      title: t('iot.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => (
        <Tag color={statusColor(val)}>{t(`iot.status_${val}`, val)}</Tag>
      )
    },
    {
      title: t('iot.last_seen', 'Last Seen'),
      dataIndex: 'last_seen_at',
      key: 'last_seen_at',
      render: (val: string) => val ? dayjs(val).fromNow() : t('common.never', 'Never')
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      render: (_: any, record: Device) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/iot/devices/${record.id}`)}>
            {t('common.view', 'View')}
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title={t('iot.regenerate_key_confirm', 'Regenerate API key? Old key will be invalidated.')}
            onConfirm={() => handleRegenerateKey(record.id)}
          >
            <Button size="small" icon={<KeyOutlined />} />
          </Popconfirm>
          <Popconfirm title={t('common.delete_confirm', 'Delete?')} onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>{t('iot.devices', 'IoT Devices')}</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadDevices} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('iot.register_device', 'Register Device')}
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder={t('iot.filter_status', 'Filter by status')}
          style={{ width: 150 }}
          allowClear
          onChange={val => setFilters({ ...filters, status: val })}
        >
          <Select.Option value="active">{t('iot.status_active', 'Active')}</Select.Option>
          <Select.Option value="inactive">{t('iot.status_inactive', 'Inactive')}</Select.Option>
          <Select.Option value="error">{t('iot.status_error', 'Error')}</Select.Option>
        </Select>
        <Select
          placeholder={t('iot.filter_type', 'Filter by type')}
          style={{ width: 150 }}
          allowClear
          onChange={val => setFilters({ ...filters, device_type: val })}
        >
          <Select.Option value="sensor">{t('iot.device_type_sensor', 'Sensor')}</Select.Option>
          <Select.Option value="printer">{t('iot.device_type_printer', 'Printer')}</Select.Option>
          <Select.Option value="camera">{t('iot.device_type_camera', 'Camera')}</Select.Option>
          <Select.Option value="scanner">{t('iot.device_type_scanner', 'Scanner')}</Select.Option>
          <Select.Option value="gateway">{t('iot.device_type_gateway', 'Gateway')}</Select.Option>
          <Select.Option value="other">{t('iot.device_type_other', 'Other')}</Select.Option>
        </Select>
      </Space>

      <Table
        dataSource={devices}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (tot) => `${tot} ${t('common.total', 'total')}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps || 20);
          }
        }}
      />

      <Modal
        title={editingId ? t('iot.edit_device', 'Edit Device') : t('iot.register_device', 'Register Device')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('iot.name', 'Name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="device_type" label={t('iot.device_type', 'Type')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="sensor">{t('iot.device_type_sensor', 'Sensor')}</Select.Option>
              <Select.Option value="printer">{t('iot.device_type_printer', 'Printer')}</Select.Option>
              <Select.Option value="camera">{t('iot.device_type_camera', 'Camera')}</Select.Option>
              <Select.Option value="scanner">{t('iot.device_type_scanner', 'Scanner')}</Select.Option>
              <Select.Option value="gateway">{t('iot.device_type_gateway', 'Gateway')}</Select.Option>
              <Select.Option value="other">{t('iot.device_type_other', 'Other')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="serial_number" label={t('iot.serial_number', 'Serial Number')}>
            <Input />
          </Form.Item>
          <Form.Item name="location" label={t('iot.location', 'Location')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('iot.api_key', 'API Key')}
        open={keyModalVisible}
        onOk={() => setKeyModalVisible(false)}
        onCancel={() => setKeyModalVisible(false)}
        footer={[
          <Button key="copy" type="primary" onClick={() => {
            navigator.clipboard.writeText(newApiKey);
            message.success(t('common.copied', 'Copied'));
          }}>
            {t('common.copy', 'Copy')}
          </Button>,
          <Button key="close" onClick={() => setKeyModalVisible(false)}>
            {t('common.close', 'Close')}
          </Button>
        ]}
      >
        <p>{t('iot.api_key_warning', 'Save this API key — it will not be shown again.')}</p>
        <Input.TextArea value={newApiKey} readOnly rows={2} />
      </Modal>
    </div>
  );
};

export default IoTDevices;
