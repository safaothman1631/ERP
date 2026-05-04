import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, Select, Switch, 
  Space, message, Popconfirm, Tag, Tooltip, TimePicker,
  InputNumber, Card 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  PlayCircleOutlined, CalendarOutlined 
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import dayjs from 'dayjs';

interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  frequency: string;
  day_of_week?: number;
  day_of_month?: number;
  hour: number;
  recipients: string[];
  format: string;
  active: boolean;
  next_run_at?: string;
  last_run_at?: string;
}

const ScheduledReports: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/scheduled-reports');
      setData(response.data.items || []);
    } catch (error) {
      message.error(t('scheduled_reports.error_loading'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (record?: ScheduledReport) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue({
        ...record,
        hour: dayjs().hour(record.hour).minute(0),
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ frequency: 'daily', hour: dayjs().hour(9).minute(0), format: 'pdf', active: true });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      const payload = {
        ...values,
        hour: values.hour ? values.hour.hour() : 9,
        recipients: values.recipients || [],
      };

      if (editingId) {
        await api.put(`/api/scheduled-reports/${editingId}`, payload);
        message.success(t('scheduled_reports.updated'));
      } else {
        await api.post('/api/scheduled-reports', payload);
        message.success(t('scheduled_reports.saved'));
      }

      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error(t('scheduled_reports.error'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/scheduled-reports/${id}`);
      message.success(t('scheduled_reports.deleted'));
      fetchData();
    } catch (error) {
      message.error(t('scheduled_reports.error'));
      console.error(error);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.post(`/api/scheduled-reports/${id}/toggle`);
      message.success(t('scheduled_reports.change_saved'));
      fetchData();
    } catch (error) {
      message.error(t('scheduled_reports.error'));
      console.error(error);
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await api.post(`/api/scheduled-reports/${id}/run-now`);
      message.success(t('scheduled_reports.report_executed'));
      fetchData();
    } catch (error) {
      message.error(t('scheduled_reports.error'));
      console.error(error);
    }
  };

  const formatFrequency = (record: ScheduledReport) => {
    if (record.frequency === 'daily') return t('scheduled_reports.daily');
    if (record.frequency === 'weekly') {
      const days = [
        t('scheduled_reports.monday'),
        t('scheduled_reports.tuesday'),
        t('scheduled_reports.wednesday'),
        t('scheduled_reports.thursday'),
        t('scheduled_reports.friday'),
        t('scheduled_reports.saturday'),
        t('scheduled_reports.sunday')
      ];
      return t('scheduled_reports.weekly_on', { day: days[record.day_of_week || 0] });
    }
    if (record.frequency === 'monthly') {
      return t('scheduled_reports.monthly_on_day', { day: record.day_of_month || 1 });
    }
    return record.frequency;
  };

  const reportTypeOptions = [
    { label: t('scheduled_reports.sales_summary'), value: 'sales_summary' },
    { label: t('scheduled_reports.aging'), value: 'aging' },
    { label: t('scheduled_reports.pl'), value: 'pl' },
    { label: t('scheduled_reports.balance_sheet'), value: 'balance_sheet' },
    { label: t('scheduled_reports.inventory_summary'), value: 'inventory_summary' },
    { label: t('scheduled_reports.custom'), value: 'custom' },
  ];

  const frequencyOptions = [
    { label: t('scheduled_reports.daily'), value: 'daily' },
    { label: t('scheduled_reports.weekly'), value: 'weekly' },
    { label: t('scheduled_reports.monthly'), value: 'monthly' },
  ];

  const dayOfWeekOptions = [
    { label: t('scheduled_reports.monday'), value: 0 },
    { label: t('scheduled_reports.tuesday'), value: 1 },
    { label: t('scheduled_reports.wednesday'), value: 2 },
    { label: t('scheduled_reports.thursday'), value: 3 },
    { label: t('scheduled_reports.friday'), value: 4 },
    { label: t('scheduled_reports.saturday'), value: 5 },
    { label: t('scheduled_reports.sunday'), value: 6 },
  ];

  const columns = [
    {
      title: t('scheduled_reports.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('scheduled_reports.type'),
      dataIndex: 'report_type',
      key: 'report_type',
      render: (type: string) => reportTypeOptions.find(o => o.value === type)?.label || type,
    },
    {
      title: t('scheduled_reports.frequency'),
      key: 'frequency',
      render: (_: any, record: ScheduledReport) => formatFrequency(record),
    },
    {
      title: t('scheduled_reports.recipients'),
      dataIndex: 'recipients',
      key: 'recipients',
      render: (recipients: string[]) => (
        <Tooltip title={recipients.join(', ')}>
          <Tag>{t('scheduled_reports.persons', { count: recipients.length })}</Tag>
        </Tooltip>
      ),
    },
    {
      title: t('scheduled_reports.next_run'),
      dataIndex: 'next_run_at',
      key: 'next_run_at',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('scheduled_reports.status'),
      dataIndex: 'active',
      key: 'active',
      render: (active: boolean, record: ScheduledReport) => (
        <Switch checked={active} onChange={() => handleToggle(record.id)} />
      ),
    },
    {
      title: t('scheduled_reports.actions'),
      key: 'actions',
      render: (_: any, record: ScheduledReport) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRunNow(record.id)}
            size="small"
          >
            {t('scheduled_reports.run_now')}
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
            size="small"
          >
            {t('scheduled_reports.edit')}
          </Button>
          <Popconfirm
            title={t('scheduled_reports.confirm_delete')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('scheduled_reports.yes')}
            cancelText={t('scheduled_reports.no')}
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              {t('scheduled_reports.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const frequency = Form.useWatch('frequency', form);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>
          <CalendarOutlined /> {t('scheduled_reports.title')}
        </h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          {t('scheduled_reports.new_report')}
        </Button>
      </div>

      <Table
        dataSource={data}
        columns={columns}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingId ? t('scheduled_reports.edit_report') : t('scheduled_reports.new_report')}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={loading}
        okText={t('scheduled_reports.save')}
        cancelText={t('scheduled_reports.cancel')}
        width={700}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="name" label={t('scheduled_reports.name')} rules={[{ required: true, message: t('scheduled_reports.enter_name') }]}>
            <Input placeholder={t('scheduled_reports.report_name')} />
          </Form.Item>

          <Form.Item name="report_type" label={t('scheduled_reports.report_type')} rules={[{ required: true }]}>
            <Select options={reportTypeOptions} placeholder={t('scheduled_reports.select_type')} />
          </Form.Item>

          <Form.Item name="frequency" label={t('scheduled_reports.repeat')} rules={[{ required: true }]}>
            <Select options={frequencyOptions} placeholder={t('scheduled_reports.select_frequency')} />
          </Form.Item>

          {frequency === 'weekly' && (
            <Form.Item name="day_of_week" label={t('scheduled_reports.day_of_week')}>
              <Select options={dayOfWeekOptions} placeholder={t('scheduled_reports.select_day')} />
            </Form.Item>
          )}

          {frequency === 'monthly' && (
            <Form.Item name="day_of_month" label={t('scheduled_reports.day_of_month')}>
              <InputNumber min={1} max={28} placeholder="١-٢٨" style={{ width: '100%' }} />
            </Form.Item>
          )}

          <Form.Item name="hour" label={t('scheduled_reports.hour')} rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="recipients" label={t('scheduled_reports.recipients_email')}>
            <Select mode="tags" placeholder={t('scheduled_reports.enter_emails')} />
          </Form.Item>

          <Form.Item name="format" label={t('scheduled_reports.format')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="pdf">PDF</Select.Option>
              <Select.Option value="csv">CSV</Select.Option>
              <Select.Option value="xlsx">Excel</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="active" label={t('scheduled_reports.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ScheduledReports;
