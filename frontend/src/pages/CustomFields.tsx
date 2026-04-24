import { useState, useEffect, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Switch, Tag } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space as spaceTk } from '../theme/tokens';
import { useAuthStore } from '../store';

export default function CustomFields() {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editId, setEditId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [fieldType, setFieldType] = useState<string>('text');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('customFields.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/api/custom-fields', { params: { page, page_size: pagination.pageSize } });
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
      const payload = {
        ...values,
        options: values.options ? values.options.split(',').map((o: string) => o.trim()) : [],
      };
      if (editId) {
        await api.put(`/api/custom-fields/${editId}`, payload);
        message.success(t('updated'));
      } else {
        await api.post('/api/custom-fields', payload);
        message.success(t('created'));
      }
      setModalVisible(false);
      form.resetFields();
      setEditId(null);
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
          await api.delete(`/api/custom-fields/${id}`);
          message.success(t('deleted'));
          fetchData(pagination.current);
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const handleEdit = (record: any) => {
    setEditId(record.id);
    setFieldType(record.field_type || 'text');
    form.setFieldsValue({
      ...record,
      options: record.options?.join(', ') || '',
    });
    setModalVisible(true);
  };

  const columns = [
    { title: t('field_name'), dataIndex: 'field_name', key: 'field_name' },
    { title: t('entity_type'), dataIndex: 'entity_type', key: 'entity_type', render: (v: string) => t(v) },
    {
      title: t('field_type'),
      dataIndex: 'field_type',
      key: 'field_type',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: t('required'),
      dataIndex: 'is_required',
      key: 'is_required',
      render: (v: boolean) => (v ? <Tag color="red">{t('yes')}</Tag> : <Tag>{t('no')}</Tag>),
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'field_name' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('customFields.hiddenCols', JSON.stringify(next)); } catch {}
  };

  return (
    <div>
      <PageHeader
        title={t('custom_fields')}
        subtitle={t('custom_fields_subtitle', 'خانە تایبەتییەکان')}
        extra={
          <Space size={spaceTk.sm}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => {
                setEditId(null);
                setFieldType('text');
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
              downloadCsv('custom-fields', data, cols);
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
        title={editId ? t('edit') : t('add')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnHidden
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label={t('entity_type')} name="entity_type" rules={[{ required: true }]}>
            <Select
              placeholder={t('select')}
              options={[
                { label: t('invoice'), value: 'invoice' },
                { label: t('quote'), value: 'quote' },
                { label: t('contact'), value: 'contact' },
                { label: t('item'), value: 'item' },
                { label: t('expense'), value: 'expense' },
                { label: t('bill'), value: 'bill' },
                { label: t('sales_order'), value: 'sales_order' },
                { label: t('purchase_order'), value: 'purchase_order' },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('field_name')} name="field_name" rules={[{ required: true }]}>
            <Input placeholder={t('field_name')} />
          </Form.Item>
          <Form.Item label={t('field_type')} name="field_type" rules={[{ required: true }]} initialValue="text">
            <Select
              placeholder={t('select')}
              onChange={setFieldType}
              options={[
                { label: 'Text', value: 'text' },
                { label: 'Number', value: 'number' },
                { label: 'Date', value: 'date' },
                { label: 'Select', value: 'select' },
                { label: 'Boolean', value: 'boolean' },
              ]}
            />
          </Form.Item>
          {fieldType === 'select' && (
            <Form.Item label={t('options')} name="options" extra={t('comma_separated')}>
              <Input placeholder="Option1, Option2, Option3" />
            </Form.Item>
          )}
          <Form.Item label={t('required')} name="is_required" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
