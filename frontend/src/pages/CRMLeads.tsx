import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import ExportButton from '../components/ExportButton';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space as spaceTk } from '../theme/tokens';
import { useAuthStore } from '../store';

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  stage_id?: string;
  expected_revenue?: number;
  probability?: number;
  status?: string;
}

interface Stage { id: string; name: string; color?: string; }

const SOURCES = ['website', 'referral', 'event', 'cold_call', 'import', 'whatsapp', 'other'];

export default function CRMLeads() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState<Lead | null>(null);
  const [createForm] = Form.useForm();
  const [convertForm] = Form.useForm();
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('crmLeads.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const load = async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        api.get('/api/crm/leads', { params: { page_size: 200 } }),
        api.get('/api/crm/stages'),
      ]);
      setLeads(l.data.items || []);
      setStages(s.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async () => {
    const v = await createForm.validateFields();
    try {
      await api.post('/api/crm/leads', v);
      message.success(t('saved'));
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch { message.error(t('error')); }
  };

  const onConvert = async () => {
    if (!convertOpen) return;
    const v = await convertForm.validateFields();
    try {
      await api.post(`/api/crm/leads/${convertOpen.id}/convert`, v);
      message.success(t('converted'));
      setConvertOpen(null);
      convertForm.resetFields();
      load();
    } catch { message.error(t('error')); }
  };

  const onArchive = async (id: string) => {
    try {
      await api.delete(`/api/crm/leads/${id}`);
      load();
    } catch { message.error(t('error')); }
  };

  const stageName = (id?: string) => stages.find((s) => s.id === id)?.name || '—';

  const columns = [
    { title: t('name'), dataIndex: 'name', key: 'name' },
    { title: t('company'), dataIndex: 'company', key: 'company' },
    { title: t('email'), dataIndex: 'email', key: 'email' },
    { title: t('phone'), dataIndex: 'phone', key: 'phone' },
    { title: t('source'), dataIndex: 'source', key: 'source' },
    { title: t('stage'), key: 'stage_id', render: (_: unknown, r: Lead) => stageName(r.stage_id) },
    { title: t('expected_revenue'), dataIndex: 'expected_revenue', key: 'expected_revenue', align: 'right' as const },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (s?: string) => <Tag color={s === 'converted' ? 'green' : s === 'archived' ? 'default' : 'blue'}>{s || 'open'}</Tag>,
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: unknown, r: Lead) => (
        <Space>
          <Button
            size="small"
            icon={<SwapOutlined />}
            disabled={r.status === 'converted'}
            onClick={() => { setConvertOpen(r); convertForm.setFieldsValue({ amount: r.expected_revenue || 0, probability: r.probability || 50 }); }}
          >
            {t('convert')}
          </Button>
          <Popconfirm title={t('confirm_archive')} onConfirm={() => onArchive(r.id)}>
            <Button size="small" danger>{t('archive')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'name' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('crmLeads.hiddenCols', JSON.stringify(next)); } catch {}
  };

  return (
    <div>
      <PageHeader
        title={t('leads')}
        subtitle={t('leads_subtitle', 'سەردێرییەکانی رێگە')}
        extra={
          <Space size={spaceTk.sm}>
            <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
            <ExportButton endpoint="/api/export/customers" filename="leads" />
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setCreateOpen(true)}>
              {t('new_lead')}
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
              downloadCsv('crm-leads', leads, cols);
            }
          }}
        />
        <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
      </div>
      <Table rowKey="id" loading={loading} dataSource={leads} columns={visibleColumns} pagination={{ pageSize: 20 }} />

      <Modal
        title={t('new_lead')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreate}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label={t('name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="company" label={t('company')}><Input /></Form.Item>
          <Form.Item name="email" label={t('email')}><Input /></Form.Item>
          <Form.Item name="phone" label={t('phone')}><Input /></Form.Item>
          <Form.Item name="source" label={t('source')}>
            <Select options={SOURCES.map((s) => ({ value: s, label: s }))} allowClear />
          </Form.Item>
          <Form.Item name="stage_id" label={t('stage')}>
            <Select options={stages.map((s) => ({ value: s.id, label: s.name }))} allowClear />
          </Form.Item>
          <Form.Item name="expected_revenue" label={t('expected_revenue')}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="probability" label={t('probability')}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('convert_to_opportunity')}
        open={!!convertOpen}
        onCancel={() => setConvertOpen(null)}
        onOk={onConvert}
        destroyOnHidden
      >
        <Form form={convertForm} layout="vertical" initialValues={{ amount: 0, probability: 50 }}>
          <Form.Item name="amount" label={t('amount')}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="probability" label={t('probability')}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="close_date" label={t('close_date')}>
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="stage_id" label={t('stage')}>
            <Select options={stages.map((s) => ({ value: s.id, label: s.name }))} allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
