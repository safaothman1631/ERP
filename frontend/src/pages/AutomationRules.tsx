import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Switch, Tag, message, Card, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { PageHeader } from '../design-system';
import { space } from '../theme/tokens';

const { TextArea } = Input;

const AutomationRules: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<any>(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/automation/automated-actions', { params: { limit: 100 } });
      setRules(res.data.items || []);
    } catch (error) {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRules();
  }, []);

  const handleSave = async (values: any) => {
    try {
      const payload = {
        ...values,
        action_config: values.action_config ? JSON.parse(values.action_config) : {},
      };
      if (editing) {
        await api.patch(`/api/automation/automated-actions/${editing.id}`, payload);
      } else {
        await api.post('/api/automation/automated-actions', payload);
      }
      message.success(t('success'));
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      void fetchRules();
    } catch {
      message.error(t('error'));
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await api.patch(`/api/automation/automated-actions/${id}`, { active: !active });
      message.success(t('success'));
      void fetchRules();
    } catch {
      message.error(t('error'));
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await api.post(`/api/automation/automated-actions/${id}/run`, {});
      message.success(t('automation.rule_executed'));
      void fetchRules();
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t('are_you_sure'),
      onOk: async () => {
        await api.delete(`/api/automation/automated-actions/${id}`);
        message.success(t('success'));
        void fetchRules();
      },
    });
  };

  const openEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      action_config: JSON.stringify(record.action_config || {}, null, 2),
    });
    setModalOpen(true);
  };

  const columns = [
    { title: t('automation.rule_name'), dataIndex: 'name', key: 'name' },
    { title: t('automation.entity_type'), dataIndex: 'entity_type', key: 'entity_type', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('automation.trigger'), dataIndex: 'trigger', key: 'trigger', render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: t('automation.action_type'), dataIndex: 'action_type', key: 'action_type', render: (v: string) => <Tag color="green">{v}</Tag> },
    { title: t('automation.active'), dataIndex: 'active', key: 'active', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('active') : t('inactive')}</Tag> },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={record.active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            size="small"
            onClick={() => handleToggle(record.id, record.active)}
            title={record.active ? t('automation.deactivate') : t('automation.activate')}
          />
          <Button icon={<PlayCircleOutlined />} size="small" type="primary" onClick={() => handleRunNow(record.id)} title={t('automation.run_now')} />
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('automation.title')}
        subtitle={t('automation.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            {t('automation.new_rule')}
          </Button>
        }
      />
      
      <Alert
        message={t('automation.visual_builder_available')}
        description={
          <span>
            {t('automation.visual_builder_description')}{' '}
            <Button type="link" icon={<ThunderboltOutlined />} onClick={() => navigate('/automation/workflows')}>
              {t('automation.try_visual_builder')}
            </Button>
          </span>
        }
        type="info"
        showIcon
        style={{ marginTop: space.md, marginBottom: space.md }}
      />
      
      <Card style={{ marginTop: space.md }}>
        <Table dataSource={rules} columns={columns} loading={loading} rowKey="id" />
      </Card>

      <Modal
        title={editing ? t('automation.edit_rule') : t('automation.new_rule')}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label={t('automation.rule_name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="entity_type" label={t('automation.entity_type')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="invoice">{t('invoice')}</Select.Option>
              <Select.Option value="bill">{t('bill')}</Select.Option>
              <Select.Option value="lead">{t('lead')}</Select.Option>
              <Select.Option value="opportunity">{t('opportunity')}</Select.Option>
              <Select.Option value="contact">{t('contact')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="trigger" label={t('automation.trigger')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="on_create">{t('automation.trigger_on_create')}</Select.Option>
              <Select.Option value="on_update">{t('automation.trigger_on_update')}</Select.Option>
              <Select.Option value="on_delete">{t('automation.trigger_on_delete')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="condition" label={t('automation.condition')}>
            <TextArea rows={2} placeholder='e.g., amount > 1000' />
          </Form.Item>
          <Form.Item name="action_type" label={t('automation.action_type')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="send_email">{t('automation.action_send_email')}</Select.Option>
              <Select.Option value="create_activity">{t('automation.action_create_activity')}</Select.Option>
              <Select.Option value="webhook">{t('automation.action_webhook')}</Select.Option>
              <Select.Option value="log">{t('automation.action_log')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="action_config" label={t('automation.action_config')}>
            <TextArea rows={5} placeholder='{"key": "value"}' />
          </Form.Item>
          <Form.Item name="active" label={t('automation.active')} valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AutomationRules;
