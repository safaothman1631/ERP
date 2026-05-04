import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Tag, message, Card, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';

const { TextArea } = Input;

const Helpdesk: React.FC = () => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/helpdesk/tickets', {
        params: { status: statusFilter || undefined, limit: 100 },
      });
      setTickets(res.data.items || []);
    } catch (error) {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, [statusFilter]);

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await api.patch(`/api/helpdesk/tickets/${editing.id}`, values);
      } else {
        await api.post('/api/helpdesk/tickets', values);
      }
      message.success(t('success'));
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      void fetchTickets();
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t('are_you_sure'),
      onOk: async () => {
        await api.delete(`/api/helpdesk/tickets/${id}`);
        message.success(t('success'));
        void fetchTickets();
      },
    });
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.patch(`/api/helpdesk/tickets/${id}`, { status });
      message.success(t('success'));
      void fetchTickets();
    } catch {
      message.error(t('error'));
    }
  };

  const openEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const statusColors: Record<string, string> = {
    new: 'blue',
    in_progress: 'orange',
    waiting_response: 'purple',
    resolved: 'green',
    closed: 'default',
  };

  const columns = [
    { title: t('helpdesk.ticket_id'), dataIndex: 'id', key: 'id', width: 120 },
    { title: t('helpdesk.subject'), dataIndex: 'subject', key: 'subject' },
    { title: t('helpdesk.priority'), dataIndex: 'priority', key: 'priority', render: (v: string) => <Tag color={v === 'urgent' ? 'red' : v === 'high' ? 'orange' : 'default'}>{t(`priority_${v}`)}</Tag> },
    { title: t('helpdesk.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v] || 'default'}>{t(`helpdesk.status_${v}`)}</Tag> },
    { title: t('helpdesk.contact'), dataIndex: 'contact_email', key: 'contact_email' },
    { title: t('helpdesk.assigned_to'), dataIndex: 'assigned_to', key: 'assigned_to' },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          {record.status !== 'resolved' && (
            <Button icon={<CheckOutlined />} size="small" type="primary" onClick={() => handleStatusChange(record.id, 'resolved')} />
          )}
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('helpdesk.title')}
        subtitle={t('helpdesk.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('helpdesk.new_ticket')}
          </Button>
        }
      />
      <Card style={{ marginTop: space.md }}>
        <Space style={{ marginBottom: space.md }}>
          <Select
            placeholder={t('helpdesk.filter_status')}
            allowClear
            style={{ width: 200 }}
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
          >
            <Select.Option value="new">{t('helpdesk.status_new')}</Select.Option>
            <Select.Option value="in_progress">{t('helpdesk.status_in_progress')}</Select.Option>
            <Select.Option value="waiting_response">{t('helpdesk.status_waiting_response')}</Select.Option>
            <Select.Option value="resolved">{t('helpdesk.status_resolved')}</Select.Option>
            <Select.Option value="closed">{t('helpdesk.status_closed')}</Select.Option>
          </Select>
        </Space>
        <Table dataSource={tickets} columns={columns} loading={loading} rowKey="id" />
      </Card>

      <Modal
        title={editing ? t('helpdesk.edit_ticket') : t('helpdesk.new_ticket')}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="subject" label={t('helpdesk.subject')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('helpdesk.description')}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="contact_email" label={t('helpdesk.contact_email')}>
            <Input type="email" />
          </Form.Item>
          <Form.Item name="priority" label={t('helpdesk.priority')} initialValue="medium">
            <Select>
              <Select.Option value="low">{t('priority_low')}</Select.Option>
              <Select.Option value="medium">{t('priority_medium')}</Select.Option>
              <Select.Option value="high">{t('priority_high')}</Select.Option>
              <Select.Option value="urgent">{t('priority_urgent')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="assigned_to" label={t('helpdesk.assigned_to')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Helpdesk;
