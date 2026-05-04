import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber, Switch, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';

interface AlertRule {
  id: string;
  device_id: string;
  metric: string;
  operator: string;
  threshold: number;
  duration_sec: number;
  severity: string;
  action: string;
  recipient?: string;
  active: boolean;
}

interface Device {
  id: string;
  name: string;
}

const AlertRules: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
    loadDevices();
  }, [page, pageSize]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/iot/alert-rules', {
        params: { limit: pageSize, offset: (page - 1) * pageSize }
      });
      setRules(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      message.error(t('common.load_failed', 'Failed to load'));
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await api.get('/api/iot/devices', { params: { limit: 100 } });
      setDevices(res.data.items);
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ operator: 'gt', severity: 'warn', action: 'log', duration_sec: 0, active: true });
    setModalVisible(true);
  };

  const handleEdit = (record: AlertRule) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await api.put(`/api/iot/alert-rules/${editingId}`, values);
        message.success(t('common.updated', 'Updated'));
      } else {
        await api.post('/api/iot/alert-rules', values);
        message.success(t('common.created', 'Created'));
      }
      setModalVisible(false);
      loadRules();
    } catch (err) {
      message.error(t('common.save_failed', 'Save failed'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/iot/alert-rules/${id}`);
      message.success(t('common.deleted', 'Deleted'));
      loadRules();
    } catch (err) {
      message.error(t('common.delete_failed', 'Delete failed'));
    }
  };

  const severityColor = (severity: string) => {
    const map: Record<string, string> = {
      info: 'blue',
      warn: 'orange',
      critical: 'red'
    };
    return map[severity] || 'default';
  };

  const operatorLabel = (op: string) => {
    const map: Record<string, string> = {
      gt: '>',
      lt: '<',
      gte: '≥',
      lte: '≤',
      eq: '='
    };
    return map[op] || op;
  };

  const columns = [
    {
      title: t('iot.device', 'Device'),
      dataIndex: 'device_id',
      key: 'device_id',
      render: (id: string) => {
        const device = devices.find(d => d.id === id);
        return device?.name || id.substring(0, 8);
      }
    },
    {
      title: t('iot.metric', 'Metric'),
      dataIndex: 'metric',
      key: 'metric'
    },
    {
      title: t('iot.condition', 'Condition'),
      key: 'condition',
      render: (_: any, record: AlertRule) => (
        <span>
          {operatorLabel(record.operator)} {record.threshold}
        </span>
      )
    },
    {
      title: t('iot.duration', 'Duration (s)'),
      dataIndex: 'duration_sec',
      key: 'duration_sec'
    },
    {
      title: t('iot.severity', 'Severity'),
      dataIndex: 'severity',
      key: 'severity',
      render: (val: string) => <Tag color={severityColor(val)}>{t(`iot.${val}`, val)}</Tag>
    },
    {
      title: t('iot.action', 'Action'),
      dataIndex: 'action',
      key: 'action',
      render: (val: string) => t(`iot.action_${val}`, val)
    },
    {
      title: t('iot.active', 'Active'),
      dataIndex: 'active',
      key: 'active',
      render: (val: boolean) => <Switch checked={val} disabled />
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      render: (_: any, record: AlertRule) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
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
        <h1>{t('iot.alert_rules', 'Alert Rules')}</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRules} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('iot.new_rule', 'New Rule')}
          </Button>
        </Space>
      </div>

      <Table
        dataSource={rules}
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
        title={editingId ? t('iot.edit_rule', 'Edit Rule') : t('iot.new_rule', 'New Rule')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="device_id" label={t('iot.device', 'Device')} rules={[{ required: true }]}>
            <Select 
              showSearch 
              filterOption={(input, option) => 
                String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {devices.map(d => (
                <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="metric" label={t('iot.metric', 'Metric')} rules={[{ required: true }]}>
            <Input placeholder={t('iot.metric_placeholder', 'e.g. temperature, humidity, voltage')} />
          </Form.Item>
          <Form.Item name="operator" label={t('iot.operator', 'Operator')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="gt">&gt;</Select.Option>
              <Select.Option value="lt">&lt;</Select.Option>
              <Select.Option value="gte">≥</Select.Option>
              <Select.Option value="lte">≤</Select.Option>
              <Select.Option value="eq">=</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="threshold" label={t('iot.threshold', 'Threshold')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item 
            name="duration_sec" 
            label={t('iot.duration_sec', 'Duration (seconds)')} 
            tooltip={t('iot.duration_tooltip', 'Delay before triggering alert')}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="severity" label={t('iot.severity', 'Severity')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="info">{t('iot.info', 'Info')}</Select.Option>
              <Select.Option value="warn">{t('iot.warn', 'Warning')}</Select.Option>
              <Select.Option value="critical">{t('iot.critical', 'Critical')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="action" label={t('iot.action', 'Action')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="log">{t('iot.action_log', 'Log')}</Select.Option>
              <Select.Option value="email">{t('iot.action_email', 'Email')}</Select.Option>
              <Select.Option value="webhook">{t('iot.action_webhook', 'Webhook')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item 
            noStyle 
            shouldUpdate={(prev, curr) => prev.action !== curr.action}
          >
            {() => {
              const action = form.getFieldValue('action');
              if (action === 'email' || action === 'webhook') {
                return (
                  <Form.Item 
                    name="recipient" 
                    label={action === 'email' ? t('iot.email', 'Email') : t('iot.webhook_url', 'Webhook URL')}
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
          <Form.Item name="active" label={t('iot.active', 'Active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AlertRules;
