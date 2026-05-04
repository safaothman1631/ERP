import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, InputNumber } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';

const { Option } = Select;

const Budgets: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/budgets');
      setData(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await api.put(`/api/budgets/${editing.id}`, values);
      } else {
        await api.post('/api/budgets', values);
      }
      message.success(t('success'));
      setModal(false);
      form.resetFields();
      setEditing(null);
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: t('are_you_sure'),
      onOk: async () => {
        await api.delete(`/api/budgets/${id}`);
        message.success(t('success'));
        fetchData();
      },
    });
  };

  const openEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModal(true);
  };

  const columns = [
    { title: t('name'), dataIndex: 'name', key: 'name' },
    { title: t('fiscal_year'), dataIndex: 'fiscal_year', key: 'fiscal_year' },
    { title: t('status'), dataIndex: 'status', key: 'status' },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" onClick={() => window.location.href = `/budget-variance?id=${record.id}`}>
            {t('view_variance')}
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('budgets')}
        subtitle={t('budgets_subtitle', 'بودجە و پلان')}
        helpKey="budgets"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
            {t('new')}
          </Button>
        }
      />
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={editing ? t('edit') : t('new')}
        open={modal}
        onCancel={() => { setModal(false); form.resetFields(); setEditing(null); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="fiscal_year" label={t('fiscal_year')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label={t('status')} initialValue="draft">
            <Select>
              <Option value="draft">{t('draft')}</Option>
              <Option value="active">{t('active')}</Option>
              <Option value="closed">{t('closed')}</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Budgets;
