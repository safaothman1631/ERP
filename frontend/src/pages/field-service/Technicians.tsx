import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Switch, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { message } from '../../utils/message';
import type { ColumnsType } from 'antd/es/table';

interface Technician {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  skills: string[];
  is_active: boolean;
  current_load?: number;
}

const Technicians: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchTechnicians = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/field-service/workers', { params: { limit: 500 } });
      setTechnicians(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTechnicians();
  }, []);

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, skills: [] });
    setShowModal(true);
  };

  const handleEdit = (tech: Technician) => {
    setEditingId(tech.id);
    form.setFieldsValue({
      name: tech.name,
      phone: tech.phone,
      email: tech.email,
      skills: tech.skills.join(', '),
      is_active: tech.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t('confirm_delete'),
      content: t('delete_warning'),
      onOk: async () => {
        try {
          await api.delete(`/api/field-service/workers/${id}`);
          message.success(t('field_service.technician_deleted'));
          void fetchTechnicians();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      skills: typeof values.skills === 'string' 
        ? (values.skills as string).split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };

    try {
      if (editingId) {
        await api.patch(`/api/field-service/workers/${editingId}`, payload);
        message.success(t('field_service.technician_updated'));
      } else {
        await api.post('/api/field-service/workers', payload);
        message.success(t('field_service.technician_created'));
      }
      setShowModal(false);
      form.resetFields();
      void fetchTechnicians();
    } catch {
      message.error(t('error'));
    }
  };

  const columns: ColumnsType<Technician> = [
    {
      title: t('field_service.technician_name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('field_service.technician_phone'),
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '-',
    },
    {
      title: t('email'),
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => email || '-',
    },
    {
      title: t('field_service.technician_skills'),
      dataIndex: 'skills',
      key: 'skills',
      render: (skills: string[]) => (
        <>
          {skills.map((skill, idx) => (
            <Tag key={idx} color="blue">
              {skill}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: t('field_service.current_load'),
      dataIndex: 'current_load',
      key: 'current_load',
      render: (load: number) => load || 0,
    },
    {
      title: t('status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? t('field_service.active') : t('inactive')}
        </Tag>
      ),
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: unknown, record: Technician) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('edit')}
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            {t('delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('field_service.technicians')}
        subtitle={t('field_service.title')}
        breadcrumb={[
          { label: t('dashboard'), to: '/' },
          { label: t('field_service.title') },
          { label: t('field_service.technicians') },
        ]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('field_service.new_technician')}
          </Button>
        }
      />

      <Card>
        <Table
          dataSource={technicians}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={editingId ? t('field_service.edit_technician') : t('field_service.new_technician')}
        open={showModal}
        onCancel={() => {
          setShowModal(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label={t('field_service.technician_name')}
            rules={[{ required: true, message: t('required_field') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={t('field_service.technician_phone')}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t('email')} rules={[{ type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="skills"
            label={t('field_service.technician_skills')}
            extra={t('comma_separated')}
          >
            <Input placeholder="HVAC, Plumbing, Electrical" />
          </Form.Item>
          <Form.Item name="is_active" label={t('field_service.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Technicians;
