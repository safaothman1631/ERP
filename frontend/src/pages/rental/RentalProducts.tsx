import type React from 'react';
import { useEffect, useState } from 'react';
import { Table, Button, Space, Input, Modal, Form, InputNumber, Switch } from 'antd';
import { message } from '../../utils/message';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat, BulkActionBar } from '../../design-system';
import { downloadCsv } from '../../utils/exportCsv';
import { space } from '../../theme/tokens';
import { useAuthStore } from '../../store';

interface RentalProduct {
  id: string;
  name: string;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  deposit: number;
  quantity_total: number;
  is_available: boolean;
}

const RentalProducts: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<RentalProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<RentalProduct | null>(null);
  const [form] = Form.useForm();
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/rental/products', { params: { limit: 100 } });
      const items = res.data.items || [];
      setData(items);
      setTotal(res.data.total || items.length);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (search) {
      const filtered = data.filter((p) =>
        p.name?.toLowerCase().includes(search.toLowerCase())
      );
      setTotal(filtered.length);
    } else {
      setTotal(data.length);
    }
  }, [search, data]);

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await api.patch(`/api/rental/products/${editing.id}`, values);
      } else {
        await api.post('/api/rental/products', values);
      }
      message.success(t('success'));
      setModal(false);
      form.resetFields();
      setEditing(null);
      void fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t('are_you_sure'),
      onOk: async () => {
        await api.delete(`/api/rental/products/${id}`);
        message.success(t('success'));
        void fetchData();
      },
    });
  };

  const handleBulkDelete = () => {
    Modal.confirm({
      title: t('are_you_sure'),
      content: t('data_table_v2.delete_n_confirm', { n: selectedIds.length }),
      okButtonProps: { danger: true },
      onOk: async () => {
        await Promise.all(selectedIds.map((id) => api.delete(`/api/rental/products/${id}`)));
        message.success(t('success'));
        setSelectedIds([]);
        void fetchData();
      },
    });
  };

  const allColumns = [
    { title: t('rental.product_name'), dataIndex: 'name', key: 'name' },
    {
      title: t('rental.daily_rate'),
      dataIndex: 'daily_rate',
      key: 'daily_rate',
      render: (v: number) => v?.toLocaleString(),
    },
    {
      title: t('rental.weekly_rate'),
      dataIndex: 'weekly_rate',
      key: 'weekly_rate',
      render: (v: number) => v?.toLocaleString(),
    },
    {
      title: t('rental.monthly_rate'),
      dataIndex: 'monthly_rate',
      key: 'monthly_rate',
      render: (v: number) => v?.toLocaleString(),
    },
    {
      title: t('rental.deposit'),
      dataIndex: 'deposit',
      key: 'deposit',
      render: (v: number) => v?.toLocaleString(),
    },
    { title: t('rental.quantity'), dataIndex: 'quantity_total', key: 'quantity_total' },
    {
      title: t('rental.available'),
      dataIndex: 'is_available',
      key: 'is_available',
      render: (v: boolean) => (v ? t('yes') : t('no')),
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: RentalProduct) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditing(record);
              form.setFieldsValue(record);
              setModal(true);
            }}
          />
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  const columns = allColumns.filter((c) => !hiddenCols.includes(c.key));
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'name' || c.key === 'actions',
  }));

  const filteredData = search
    ? data.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
    : data;

  return (
    <div>
      <PageHeader
        title={t('rental.rental_products')}
        subtitle={t('rental.rental_products_subtitle')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setModal(true);
            }}
          >
            {t('rental.new_product')}
          </Button>
        }
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: space.md,
          alignItems: 'center',
          gap: space.md,
          flexWrap: 'wrap',
        }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 320 }}
          allowClear
        />
        <Space>
          <ExportMenu
            formats={['csv']}
            onExport={(f: ExportFormat) => {
              if (f === 'csv') {
                const cols = columnsMeta.filter(
                  (c) => !hiddenCols.includes(c.key) && c.key !== 'actions'
                );
                downloadCsv('rental_products', filteredData, cols);
              }
            }}
          />
          <ColumnVisibility
            columns={columnsMeta}
            hidden={hiddenCols}
            onChange={setHiddenCols}
            isDark={isDark}
          />
        </Space>
      </div>

      <Table
        dataSource={filteredData}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, total }}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys),
        }}
      />

      <BulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        isDark={isDark}
        actions={[
          {
            key: 'delete',
            label: t('delete'),
            icon: <DeleteOutlined />,
            danger: true,
            onClick: handleBulkDelete,
          },
        ]}
      />

      <Modal
        title={editing ? t('edit') : t('rental.new_product')}
        open={modal}
        onCancel={() => {
          setModal(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            daily_rate: 0,
            weekly_rate: 0,
            monthly_rate: 0,
            deposit: 0,
            quantity_total: 1,
            is_available: true,
          }}
        >
          <Form.Item
            label={t('rental.product_name')}
            name="name"
            rules={[{ required: true, message: t('required_name') }]}
          >
            <Input placeholder={t('rental.product_name_placeholder')} />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item label={t('rental.daily_rate')} name="daily_rate">
              <InputNumber min={0} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item label={t('rental.weekly_rate')} name="weekly_rate">
              <InputNumber min={0} style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item label={t('rental.monthly_rate')} name="monthly_rate">
              <InputNumber min={0} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item label={t('rental.deposit')} name="deposit">
              <InputNumber min={0} style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item label={t('rental.quantity')} name="quantity_total">
              <InputNumber min={1} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item label={t('rental.available')} name="is_available" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default RentalProducts;
