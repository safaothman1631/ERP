import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Popconfirm } from 'antd';
import type { TableColumnsType } from 'antd';
import { message } from '../../utils/message';
import { PlusOutlined, SendOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { formatDate } from '../../utils/formatters';

const { TextArea } = Input;

const SmsCampaigns: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [audiences, setAudiences] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/marketing/sms-campaigns');
      setData(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAudiences = async () => {
    try {
      const res = await api.get('/api/marketing/audiences');
      setAudiences(res.data.items || []);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    fetchAudiences();
  }, []);

  const handleCreate = async (values: any) => {
    if (values.body && values.body.length > 160) {
      message.error(t('marketing.sms_too_long'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/marketing/sms-campaigns', values);
      message.success(t('success'));
      setCreateModal(false);
      form.resetFields();
      fetchData();
    } catch {
      message.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (id: string) => {
    try {
      await api.post(`/api/marketing/sms-campaigns/${id}/send`);
      message.success(t('marketing.sms_sent'));
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/marketing/sms-campaigns/${id}`);
      message.success(t('deleted'));
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const columns: TableColumnsType<any> = [
    { title: t('marketing.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('marketing.body'),
      dataIndex: 'body',
      key: 'body',
      render: (val: string) => (val ? val.substring(0, 50) + (val.length > 50 ? '...' : '') : '—'),
    },
    { title: t('marketing.status'), dataIndex: 'status', key: 'status' },
    {
      title: t('marketing.sent_at'),
      dataIndex: 'sent_at',
      key: 'sent_at',
      render: (val: string) => (val ? formatDate(val) : '—'),
    },
    {
      title: t('marketing.recipients'),
      dataIndex: 'recipient_count',
      key: 'recipient_count',
      render: (val: number) => val || 0,
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, rec: any) => (
        <Space size="small">
          {rec.status === 'draft' && (
            <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => handleSend(rec.id)}>
              {t('marketing.send_now')}
            </Button>
          )}
          <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(rec.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('marketing.sms_campaigns')}
        subtitle={t('marketing.sms_campaigns_subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            {t('create')}
          </Button>
        }
      />

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />

      <Modal
        title={t('marketing.create_sms_campaign')}
        open={createModal}
        onCancel={() => setCreateModal(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label={t('marketing.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body" label={t('marketing.body')} rules={[{ required: true }]}>
            <TextArea rows={3} maxLength={160} showCount />
          </Form.Item>
          <Form.Item name="audience_id" label={t('marketing.audience')}>
            <Select
              options={audiences.map((a) => ({ label: a.name, value: a.id }))}
              placeholder={t('select')}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {t('create')}
              </Button>
              <Button onClick={() => setCreateModal(false)}>{t('cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SmsCampaigns;
