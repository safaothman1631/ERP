import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, Tabs } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';

export default function Approvals() {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [reasonModal, setReasonModal] = useState(false);
  const [form] = Form.useForm();
  const [reasonForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('workflows');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/approvals/workflows');
      setWorkflows(res.data.items || []);
    } catch {
      message.error(t('error'));
    }
    setLoading(false);
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/approvals/requests');
      setRequests(res.data.items || []);
    } catch {
      message.error(t('error'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkflows();
    fetchRequests();
  }, []);

  const handleCreateWorkflow = async (values: any) => {
    try {
      await api.post('/api/approvals/workflows', values);
      message.success(t('created'));
      setModalVisible(false);
      form.resetFields();
      fetchWorkflows();
    } catch {
      message.error(t('error'));
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/api/approvals/requests/${id}/approve`, {});
      message.success(t('approved'));
      fetchRequests();
    } catch {
      message.error(t('error'));
    }
  };

  const handleReject = async (values: any) => {
    try {
      await api.post(`/api/approvals/requests/${selectedRequest}/reject`, {
        reason: values.reason,
      });
      message.success(t('rejected'));
      setReasonModal(false);
      reasonForm.resetFields();
      setSelectedRequest(null);
      fetchRequests();
    } catch {
      message.error(t('error'));
    }
  };

  const workflowColumns = [
    { title: t('name'), dataIndex: 'name', key: 'name' },
    { title: t('entity_type'), dataIndex: 'entity_type', key: 'entity_type', render: (v: string) => t(v) },
    { title: t('condition'), dataIndex: 'condition', key: 'condition' },
    { title: t('approvers'), dataIndex: 'approvers', key: 'approvers', render: (v: string[]) => v?.join(', ') || '-' },
  ];

  const requestColumns = [
    { title: t('entity_type'), dataIndex: 'entity_type', key: 'entity_type', render: (v: string) => t(v) },
    { title: t('entity_id'), dataIndex: 'entity_id', key: 'entity_id' },
    { title: t('requester'), dataIndex: 'requester', key: 'requester' },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          pending: 'blue',
          approved: 'green',
          rejected: 'red',
        };
        return <Tag color={colors[status] || 'default'}>{t(status)}</Tag>;
      },
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => {
        if (record.status !== 'pending') return null;
        return (
          <Space size="small">
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record.id)}
            >
              {t('approve')}
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => {
                setSelectedRequest(record.id);
                setReasonModal(true);
              }}
            >
              {t('reject')}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          activeTab === 'workflows' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setModalVisible(true);
              }}
            >
              {t('add_workflow')}
            </Button>
          )
        }
      >
        <Tabs.TabPane tab={t('workflows')} key="workflows">
          <Table dataSource={workflows} columns={workflowColumns} rowKey="id" loading={loading} />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('requests')} key="requests">
          <Table dataSource={requests} columns={requestColumns} rowKey="id" loading={loading} />
        </Tabs.TabPane>
      </Tabs>

      <Modal
        title={t('create_workflow')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnHidden
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateWorkflow}>
          <Form.Item label={t('name')} name="name" rules={[{ required: true }]}>
            <Input placeholder={t('name')} />
          </Form.Item>
          <Form.Item label={t('entity_type')} name="entity_type" rules={[{ required: true }]}>
            <Select
              placeholder={t('select')}
              options={[
                { label: t('invoice'), value: 'invoice' },
                { label: t('expense'), value: 'expense' },
                { label: t('bill'), value: 'bill' },
                { label: t('purchase_order'), value: 'purchase_order' },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('condition')} name="condition">
            <Input placeholder="amount > 1000000" />
          </Form.Item>
          <Form.Item label={t('description')} name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('reject_reason')}
        open={reasonModal}
        onCancel={() => {
          setReasonModal(false);
          reasonForm.resetFields();
          setSelectedRequest(null);
        }}
        onOk={() => reasonForm.submit()}
        destroyOnHidden
      >
        <Form form={reasonForm} layout="vertical" onFinish={handleReject}>
          <Form.Item label={t('reason')} name="reason" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder={t('reason')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
