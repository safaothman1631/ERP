import React, { useEffect, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Table, Button, Space, Drawer, Form, Input, Select, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader } from '../../design-system';
import { Popconfirm } from 'antd';
import { space } from '../../theme/tokens';

interface NCR {
  id: string;
  title: string;
  description: string;
  severity: string;
  product_id?: string;
  detected_in?: string;
  quantity_affected?: number;
  capa_id?: string;
}

const NonConformances: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<NCR[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/quality/non-conformities', { params: { limit: 200 } });
      setData(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (values: any) => {
    try {
      if (editingId) {
        await api.patch(`/api/quality/non-conformities/${editingId}`, values);
        message.success(t('success'));
      } else {
        await api.post('/api/quality/non-conformities', values);
        message.success(t('quality.ncr_created'));
      }
      setDrawerOpen(false);
      form.resetFields();
      setEditingId(null);
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const handleEdit = (record: NCR) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/quality/non-conformities/${id}`);
      message.success(t('success'));
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const severityColor = (sev: string) => {
    if (sev === 'critical') return 'red';
    if (sev === 'high') return 'orange';
    if (sev === 'medium') return 'gold';
    return 'default';
  };

  const columns: ColumnsType<NCR> = [
    {
      title: t('quality.title'),
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: t('quality.severity'),
      dataIndex: 'severity',
      key: 'severity',
      render: (v) => <Tag color={severityColor(v)}>{t(`quality.severity_${v}`)}</Tag>,
    },
    {
      title: t('quality.product'),
      dataIndex: 'product_id',
      key: 'product_id',
      render: (v) => v || '—',
    },
    {
      title: t('quality.detected_in'),
      dataIndex: 'detected_in',
      key: 'detected_in',
      render: (v) => v || '—',
    },
    {
      title: t('quality.quantity_affected'),
      dataIndex: 'quantity_affected',
      key: 'quantity_affected',
      render: (v) => v || 0,
    },
    {
      title: t('quality.capa_linked'),
      dataIndex: 'capa_id',
      key: 'capa_id',
      render: (v) => (v ? <Tag icon={<LinkOutlined />} color="blue">{t('yes')}</Tag> : '—'),
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title={t('confirm_delete')} onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('quality.non_conformances')}
        subtitle={t('quality.ncr_subtitle')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(null);
              form.resetFields();
              setDrawerOpen(true);
            }}
          >
            {t('quality.new_ncr')}
          </Button>
        }
      />
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
      <Drawer
        title={editingId ? t('quality.edit_ncr') : t('quality.new_ncr')}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          form.resetFields();
          setEditingId(null);
        }}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="title"
            label={t('quality.title')}
            rules={[{ required: true, message: t('required') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label={t('quality.description')}
            rules={[{ required: true, message: t('required') }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="severity"
            label={t('quality.severity')}
            initialValue="medium"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="low">{t('quality.severity_low')}</Select.Option>
              <Select.Option value="medium">{t('quality.severity_medium')}</Select.Option>
              <Select.Option value="high">{t('quality.severity_high')}</Select.Option>
              <Select.Option value="critical">{t('quality.severity_critical')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="product_id" label={t('quality.product')}>
            <Input placeholder={t('optional')} />
          </Form.Item>
          <Form.Item name="detected_in" label={t('quality.detected_in')}>
            <Input placeholder={t('optional')} />
          </Form.Item>
          <Form.Item name="quantity_affected" label={t('quality.quantity_affected')} initialValue={0}>
            <Input type="number" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('save')}
              </Button>
              <Button onClick={() => setDrawerOpen(false)}>{t('cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default NonConformances;
