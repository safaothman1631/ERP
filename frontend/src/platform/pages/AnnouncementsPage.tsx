import { Button, Form, Input, Modal, Select, Table, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import api from '../../api';
import GlassCard from '../components/GlassCard';
import PlatformPageHeader from '../components/PlatformPageHeader';

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  severity?: string;
  start_at?: string;
  end_at?: string;
}

export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'announcements'],
    queryFn: async () => (await api.get<{ items: AnnouncementRow[] }>('/api/platform/announcements')).data.items,
  });

  const create = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/api/platform/announcements', values),
    onSuccess: () => {
      message.success(t('platform.announcement_created', 'Announcement created'));
      setOpen(false);
      form.resetFields();
      void qc.invalidateQueries({ queryKey: ['platform', 'announcements'] });
    },
  });

  return (
    <>
      <PlatformPageHeader
        title={t('platform.nav.announcements', 'Announcements')}
        actions={<Button type="primary" onClick={() => setOpen(true)}>{t('platform.new_announcement', 'New announcement')}</Button>}
      />
      <GlassCard>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data || []}
          columns={[
            { title: t('title', 'Title'), dataIndex: 'title' },
            { title: t('platform.severity', 'Severity'), dataIndex: 'severity' },
            { title: t('platform.start', 'Start'), dataIndex: 'start_at' },
            { title: t('platform.end', 'End'), dataIndex: 'end_at' },
          ]}
        />
      </GlassCard>
      <Modal open={open} title={t('platform.new_announcement', 'New announcement')} onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={v => create.mutate(v)}>
          <Form.Item name="title" label={t('title', 'Title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body" label={t('body', 'Body')} rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="severity" label={t('platform.severity', 'Severity')} initialValue="info">
            <Select options={[{ value: 'info' }, { value: 'warning' }, { value: 'critical' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
