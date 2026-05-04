import React, { useEffect, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Table, Button, Space, Drawer, Form, Input, Select, Tag, InputNumber } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, StatusTag } from '../../design-system';
import { Popconfirm } from 'antd';
import { space } from '../../theme/tokens';

interface QCCheck {
  id: string;
  point_id?: string;
  product_id?: string;
  status?: string;
  notes?: string;
  checked_at?: string;
  measure?: number;
  measure_min?: number;
  measure_max?: number;
}

const QCChecks: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<QCCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/api/quality/checks', { params });
      setData(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSave = async (values: any) => {
    try {
      await api.post('/api/quality/checks', values);
      message.success(t('quality.check_created'));
      setDrawerOpen(false);
      form.resetFields();
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const handlePass = async (id: string) => {
    try {
      await api.post(`/api/quality/checks/${id}/pass`);
      message.success(t('quality.check_passed'));
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const handleFail = async (id: string, reason?: string) => {
    try {
      await api.post(`/api/quality/checks/${id}/fail`, { reason });
      message.success(t('quality.check_failed'));
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const columns: ColumnsType<QCCheck> = [
    {
      title: t('quality.product'),
      dataIndex: 'product_id',
      key: 'product_id',
      render: (v) => v || t('n_a'),
    },
    {
      title: t('quality.notes'),
      dataIndex: 'notes',
      key: 'notes',
      render: (v) => v || '—',
    },
    {
      title: t('quality.measure'),
      key: 'measure',
      render: (_, r) => {
        if (r.measure !== undefined && r.measure !== null) {
          return `${r.measure} (${r.measure_min}–${r.measure_max})`;
        }
        return '—';
      },
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (v) => {
        if (v === 'pass') return <Tag color="green">{t('quality.passed')}</Tag>;
        if (v === 'fail') return <Tag color="red">{t('quality.failed')}</Tag>;
        return <Tag>{t('quality.pending')}</Tag>;
      },
    },
    {
      title: t('quality.date'),
      dataIndex: 'checked_at',
      key: 'checked_at',
      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_, record) => {
        if (record.status === 'pass' || record.status === 'fail') return null;
        return (
          <Space>
            <Popconfirm title={t('quality.confirm_pass')} onConfirm={() => handlePass(record.id)}>
              <Button size="small" type="primary" icon={<CheckOutlined />}>
                {t('quality.pass')}
              </Button>
            </Popconfirm>
            <Popconfirm title={t('quality.confirm_fail')} onConfirm={() => handleFail(record.id)}>
              <Button size="small" danger icon={<CloseOutlined />}>
                {t('quality.fail')}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('quality.qc_checks')}
        subtitle={t('quality.qc_checks_subtitle')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setDrawerOpen(true);
            }}
          >
            {t('quality.new_check')}
          </Button>
        }
      />
      <div style={{ marginBottom: space.md }}>
        <Select
          placeholder={t('quality.filter_by_status')}
          value={statusFilter || undefined}
          onChange={(v) => setStatusFilter(v || '')}
          allowClear
          style={{ width: 200 }}
        >
          <Select.Option value="pending">{t('quality.pending')}</Select.Option>
          <Select.Option value="pass">{t('quality.passed')}</Select.Option>
          <Select.Option value="fail">{t('quality.failed')}</Select.Option>
        </Select>
      </div>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
      <Drawer
        title={t('quality.new_check')}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          form.resetFields();
        }}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="point_id" label={t('quality.plan')}>
            <Input placeholder={t('optional')} />
          </Form.Item>
          <Form.Item name="product_id" label={t('quality.product')}>
            <Input />
          </Form.Item>
          <Form.Item name="reference_id" label={t('quality.reference_id')}>
            <Input placeholder={t('optional')} />
          </Form.Item>
          <Form.Item name="reference_type" label={t('quality.reference_type')}>
            <Input placeholder={t('optional')} />
          </Form.Item>
          <Form.Item name="measure" label={t('quality.measure')}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="measure_min" label={t('quality.measure_min')}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="measure_max" label={t('quality.measure_max')}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label={t('quality.notes')}>
            <Input.TextArea rows={3} />
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

export default QCChecks;
