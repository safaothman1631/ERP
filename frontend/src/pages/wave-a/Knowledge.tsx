import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Tag, message, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';

const { TextArea } = Input;

const Knowledge: React.FC = () => {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingArticle, setViewingArticle] = useState<any>(null);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<any>(null);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/knowledge/articles', { params: { limit: 100 } });
      setArticles(res.data.items || []);
    } catch (error) {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/api/knowledge/categories', { params: { limit: 100 } });
      setCategories(res.data.items || []);
    } catch {}
  };

  useEffect(() => {
    void fetchArticles();
    void fetchCategories();
  }, []);

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await api.patch(`/api/knowledge/articles/${editing.id}`, values);
      } else {
        await api.post('/api/knowledge/articles', values);
      }
      message.success(t('success'));
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      void fetchArticles();
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t('are_you_sure'),
      onOk: async () => {
        await api.delete(`/api/knowledge/articles/${id}`);
        message.success(t('success'));
        void fetchArticles();
      },
    });
  };

  const openEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const openView = (record: any) => {
    setViewingArticle(record);
    setViewModalOpen(true);
  };

  const columns = [
    { title: t('knowledge.title'), dataIndex: 'title', key: 'title' },
    { title: t('knowledge.category'), dataIndex: 'category_id', key: 'category_id' },
    { title: t('knowledge.published'), dataIndex: 'is_published', key: 'is_published', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('knowledge.published') : t('knowledge.draft')}</Tag> },
    { title: t('knowledge.public'), dataIndex: 'is_public', key: 'is_public', render: (v: boolean) => v ? <Tag color="blue">{t('knowledge.public')}</Tag> : <Tag>{t('knowledge.internal')}</Tag> },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => openView(record)} />
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('knowledge.title_page')}
        subtitle={t('knowledge.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            {t('knowledge.new_article')}
          </Button>
        }
      />
      <Card style={{ marginTop: space.md }}>
        <Table dataSource={articles} columns={columns} loading={loading} rowKey="id" />
      </Card>

      <Modal
        title={editing ? t('knowledge.edit_article') : t('knowledge.new_article')}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="title" label={t('knowledge.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body" label={t('knowledge.body')} rules={[{ required: true }]}>
            <TextArea rows={10} />
          </Form.Item>
          <Form.Item name="category_id" label={t('knowledge.category')}>
            <Select allowClear placeholder={t('knowledge.select_category')}>
              {categories.map((c) => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="is_published" label={t('knowledge.published')} valuePropName="checked" initialValue={false}>
            <Select>
              <Select.Option value={false}>{t('knowledge.draft')}</Select.Option>
              <Select.Option value={true}>{t('knowledge.published')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_public" label={t('knowledge.public')} valuePropName="checked" initialValue={false}>
            <Select>
              <Select.Option value={false}>{t('knowledge.internal')}</Select.Option>
              <Select.Option value={true}>{t('knowledge.public')}</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={viewingArticle?.title}
        open={viewModalOpen}
        onCancel={() => { setViewModalOpen(false); setViewingArticle(null); }}
        footer={[<Button key="close" onClick={() => { setViewModalOpen(false); setViewingArticle(null); }}>{t('close')}</Button>]}
        width={800}
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{viewingArticle?.body}</div>
      </Modal>
    </div>
  );
};

export default Knowledge;
