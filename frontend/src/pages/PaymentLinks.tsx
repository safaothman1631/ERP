import { useState, useEffect, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, Tag } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space as spaceTk } from '../theme/tokens';
import { useAuthStore } from '../store';

export default function PaymentLinks() {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('paymentLinks.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/api/payment-links', { params: { page, page_size: pagination.pageSize } });
      setData(res.data.items || []);
      setPagination(p => ({ ...p, total: res.data.total || 0, current: page }));
    } catch {
      message.error(t('error'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (values: any) => {
    try {
      await api.post('/api/payment-links', values);
      message.success(t('created'));
      setModalVisible(false);
      form.resetFields();
      fetchData(pagination.current);
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: t('confirmDelete'),
      onOk: async () => {
        try {
          await api.delete(`/api/payment-links/${id}`);
          message.success(t('deleted'));
          fetchData(pagination.current);
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    message.success(t('copied'));
  };

  const statusColors: Record<string, string> = {
    active: 'green',
    expired: 'red',
    used: 'blue',
  };

  const columns = [
    { title: t('description'), dataIndex: 'description', key: 'description' },
    {
      title: t('amount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => v?.toLocaleString() || '0',
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>{t(status)}</Tag>
      ),
    },
    {
      title: t('created'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d: string) => d?.substring(0, 10) || '-',
    },
    {
      title: t('expires'),
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (d: string) => d?.substring(0, 10) || '-',
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopyLink(record.link_url || `${window.location.origin}/pay/${record.id}`)}
          >
            {t('copy_link')}
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'description' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('paymentLinks.hiddenCols', JSON.stringify(next)); } catch {}
  };

  return (
    <div>
      <PageHeader
        title={t('payment_links')}
        subtitle={t('payment_links_subtitle', 'بەستەری پارەدان')}
        extra={
          <Space size={spaceTk.sm}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => {
                form.resetFields();
                setModalVisible(true);
              }}
            >
              {t('add')}
            </Button>
          </Space>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spaceTk.md }}>
        <ExportMenu
          formats={['csv']}
          onExport={(f: ExportFormat) => {
            if (f === 'csv') {
              const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
              downloadCsv('payment-links', data, cols);
            }
          }}
        />
        <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
      </div>
      <Table
        dataSource={data}
        columns={visibleColumns}
        rowKey="id"
        loading={loading}
        pagination={{ ...pagination, onChange: fetchData }}
      />
      <Modal
        title={t('create_payment_link')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnHidden
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label={t('description')} name="description" rules={[{ required: true }]}>
            <Input placeholder={t('description')} />
          </Form.Item>
          <Form.Item label={t('amount')} name="amount" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder={t('amount')} />
          </Form.Item>
          <Form.Item label={t('expiry_days')} name="expiry_days" initialValue={7}>
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('notes')} name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
