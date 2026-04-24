import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Modal, Form, DatePicker, Input, Space } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';

interface TaxReturn {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  tax_collected: number;
  tax_paid: number;
  net_tax: number;
  status: string;
}

const statusColors: Record<string, string> = { draft: 'default', filed: 'blue', paid: 'green' };

const TaxReturns: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<TaxReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    api.get('/api/taxes/returns')
      .then(r => setData(r.data.items || []))
      .catch(() => message.error(t('error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const periodStart = (values.period_start as dayjs.Dayjs).format('YYYY-MM-DD');
      const periodEnd = (values.period_end as dayjs.Dayjs).format('YYYY-MM-DD');
      await api.post('/api/taxes/returns', {
        name: (values.name as string) || `Tax Return ${periodStart} → ${periodEnd}`,
        period_start: periodStart,
        period_end: periodEnd,
        notes: values.notes as string | undefined,
      });
      message.success(t('success'));
      setModalOpen(false);
      fetchData();
    } catch {
      message.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (id: string) => {
    try {
      await api.post(`/api/taxes/returns/${id}/file`);
      message.success(t('success'));
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const fmtIQD = (v: number) => `${new Intl.NumberFormat('en-US').format(v || 0)} IQD`;

  const columns = [
    { title: t('from_date'), dataIndex: 'period_start', key: 'period_start', render: (d: string) => d?.substring(0, 10) },
    { title: t('to_date'), dataIndex: 'period_end', key: 'period_end', render: (d: string) => d?.substring(0, 10) },
    { title: t('total_output'), dataIndex: 'tax_collected', key: 'tax_collected', render: (v: number) => fmtIQD(v) },
    { title: t('total_input'), dataIndex: 'tax_paid', key: 'tax_paid', render: (v: number) => fmtIQD(v) },
    { title: t('net_payable'), dataIndex: 'net_tax', key: 'net_tax', render: (v: number) => fmtIQD(v) },
    {
      title: t('status'), dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{t(s)}</Tag>,
    },
    {
      title: t('actions'), key: 'actions',
      render: (_: unknown, r: TaxReturn) => (
        <Space>
          {r.status === 'draft' && (
            <Button icon={<SendOutlined />} size="small" onClick={() => handleFile(r.id)}>
              {t('file')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          {t('create')}
        </Button>
      </div>

      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />

      <Modal open={modalOpen} onCancel={() => setModalOpen(false)} title={t('taxReturns')} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label={t('name')} name="name" rules={[{ required: true, message: t('required_name') }]}>
            <Input placeholder={t('placeholder_name')} />
          </Form.Item>
          <Form.Item label={t('from_date')} name="period_start" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('to_date')} name="period_end" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('notes')} name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>{t('save')}</Button>
            <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default TaxReturns;
