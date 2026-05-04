import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space} from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, BarChartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { PageHeader, StatusTag } from '../design-system';
import { space } from '../theme/tokens';

const statusColors: Record<string, string> = {
  active: 'blue', completed: 'green', on_hold: 'orange', cancelled: 'red',
};

const Projects: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/projects', { params: { page, page_size: 20 } });
      setData(res.data.items); setTotal(res.data.total);
    } catch { message.error(t('error')); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page]);
  useEffect(() => {
    api.get('/api/contacts', { params: { page_size: 100 } }).then(r => setContacts(r.data.items || []));
  }, []);

  const handleSave = async (values: any) => {
    try {
      await api.post('/api/projects', values);
      message.success(t('success'));
      setModal(false); form.resetFields(); fetchData();
    } catch { message.error(t('error')); }
  };

  const columns = [
    { title: t('name'), dataIndex: 'name', key: 'name' },
    { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={s} label={t(s)} /> },
    { title: t('description'), dataIndex: 'description', key: 'description' },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<BarChartOutlined />}
          onClick={() => navigate(`/projects/${record.id}/gantt`)}
        >
          {t('gantt')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('projects')}
        subtitle={t('projects_subtitle', 'پرۆژە و فرەوئوربەرستی')}
        helpKey="projects"
        extra={
          <Space size={space.sm}>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => { form.resetFields(); setModal(true); }}>{t('new_project')}</Button>
          </Space>
        }
      />

      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />

      <Modal title={t('new_project')} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={500}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ status: 'active', billing_method: 'fixed_cost' }}>
          <Form.Item label={t('name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label={t('description')} name="description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label={t('customer')} name="contact_id">
            <Select allowClear showSearch optionFilterProp="label" options={contacts.map(c => ({ label: c.display_name, value: c.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Projects;
