import { useState } from 'react';
import { Button, Input, Modal, Form, Select, Space, Table, Tag, message } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../api';
import GlassCard from '../components/GlassCard';
import PlatformPageHeader from '../components/PlatformPageHeader';
import { BUNDLES } from '../../onboarding/bundles';

interface OrgRow {
  id: string;
  name: string;
  status: string;
  user_count: number;
  license?: { bundle_id?: string; expires_at?: string };
}

export default function OrgListPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'orgs', q],
    queryFn: async () => {
      const res = await api.get<{ items: OrgRow[] }>('/api/platform/orgs', { params: { q: q || undefined } });
      return res.data.items;
    },
  });

  const createOrg = async () => {
    const values = await form.validateFields();
    await api.post('/api/platform/orgs', values);
    message.success(t('platform.org_created', 'Organization created'));
    setCreateOpen(false);
    form.resetFields();
    void qc.invalidateQueries({ queryKey: ['platform', 'orgs'] });
  };

  return (
    <>
      <PlatformPageHeader
        title={t('platform.orgs.title', 'Organizations')}
        subtitle={t('platform.orgs.subtitle', 'Manage tenant organizations')}
        actions={<Button type="primary" onClick={() => setCreateOpen(true)}>{t('platform.create_org', 'Create organization')}</Button>}
      />
      <GlassCard>
        <Input.Search
          placeholder={t('platform.search_orgs', 'Search organizations')}
          allowClear
          onSearch={setQ}
          style={{ maxWidth: 360, marginBottom: 16 }}
        />
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data || []}
          columns={[
            { title: t('name', 'Name'), dataIndex: 'name', render: (name, row) => <Link to={`/platform/orgs/${row.id}`}>{name}</Link> },
            { title: 'ID', dataIndex: 'id', ellipsis: true },
            { title: t('status', 'Status'), dataIndex: 'status', render: (s: string) => <Tag color={s === 'suspended' ? 'red' : 'green'}>{s}</Tag> },
            { title: t('platform.users_count', 'Users'), dataIndex: 'user_count' },
            { title: t('platform.bundle', 'Bundle'), render: (_, row) => row.license?.bundle_id || '—' },
          ]}
          pagination={{ pageSize: 20 }}
        />
      </GlassCard>
      <Modal
        open={createOpen}
        title={t('platform.create_org', 'Create organization')}
        onCancel={() => setCreateOpen(false)}
        onOk={createOrg}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('name', 'Name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="owner_email" label={t('platform.owner_email', 'Owner email')}>
            <Input type="email" />
          </Form.Item>
          <Form.Item name="bundle_id" label={t('platform.bundle', 'Bundle')} initialValue="full_core">
            <Select options={BUNDLES.map(b => ({ value: b.id, label: b.title || b.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
