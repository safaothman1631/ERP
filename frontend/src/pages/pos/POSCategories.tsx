import React, { useEffect, useState } from 'react';
import { Tree, Button, Space, Modal, Form, Input, InputNumber, ColorPicker, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import api from '../../api';
import { message } from '../../utils/message';

const POSCategories: React.FC = () => {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    try {
      const res = await api.get('/api/pos/categories', { params: { page_size: 500 } });
      buildTreeData(res.data.items || []);
    } catch {
      message.error(t('error'));
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const buildTreeData = (categories: any[]): DataNode[] => {
    const tree = categories.map((cat) => ({
      title: (
        <Space>
          {cat.color && (
            <span
              style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: cat.color,
                border: '1px solid #d9d9d9',
              }}
            />
          )}
          <span>{cat.name}</span>
          {cat.name_ku && <span style={{ color: '#999' }}>({cat.name_ku})</span>}
          <Space size="small">
            <Button
              icon={<EditOutlined />}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
                openModal(cat);
              }}
            />
            <Button
              icon={<PlusOutlined />}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
                openModal(null, cat.id);
              }}
              title={t('pos.add_subcategory')}
            />
            <Button
              icon={<DeleteOutlined />}
              size="small"
              type="text"
              danger
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(cat.id);
              }}
            />
          </Space>
        </Space>
      ),
      key: cat.id,
      children: cat.children && cat.children.length > 0 ? buildTreeData(cat.children) : [],
    }));
    setTreeData(tree);
    return tree;
  };

  const openModal = (record?: any, parent?: string) => {
    if (record) {
      setEditingId(record.id);
      setParentId(null);
      form.setFieldsValue({
        ...record,
        color: record.color || '#1890ff',
      });
    } else {
      setEditingId(null);
      setParentId(parent || null);
      form.resetFields();
      form.setFieldsValue({
        is_active: true,
        sequence: 10,
        color: '#1890ff',
        parent_id: parent || null,
      });
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        color: typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#1890ff',
        parent_id: values.parent_id || null,
      };

      if (editingId) {
        await api.put(`/api/pos/categories/${editingId}`, payload);
        message.success(t('success'));
      } else {
        await api.post('/api/pos/categories', payload);
        message.success(t('success'));
      }
      setModalVisible(false);
      fetchData();
    } catch {
      message.error(t('error'));
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: t('confirm_delete'),
      onOk: async () => {
        try {
          await api.delete(`/api/pos/categories/${id}`);
          message.success(t('success'));
          fetchData();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  return (
    <Card
      title={t('pos.categories')}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          {t('add')}
        </Button>
      }
    >
      <Tree
        treeData={treeData}
        defaultExpandAll
        showLine
      />

      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        title={editingId ? t('edit') : t('add')}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="name_ku" label={t('name_ku')}>
            <Input />
          </Form.Item>

          <Form.Item name="sequence" label={t('sequence')}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="color" label={t('pos.color')}>
            <ColorPicker showText />
          </Form.Item>

          <Form.Item name="image_url" label={t('pos.image_url')}>
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item name="parent_id" label={t('pos.parent_category')}>
            <Input disabled={!!parentId} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default POSCategories;
