import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Button, Modal, Form, Input, Switch, Tag, Space, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SwapOutlined, BankOutlined } from '@ant-design/icons';
import { message } from '../utils/message';
import api from '../api';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space as spaceTk } from '../theme/tokens';
import { useAuthStore } from '../store';

interface Company {
  id: string;
  name: string;
  code?: string;
  currency?: string;
  tax_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
  is_active?: boolean;
}

export default function Companies() {
  const { t } = useTranslation();
  const [data, setData] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form] = Form.useForm();
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('companies.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/companies');
      setData(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error(t('error'));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (values: Record<string, unknown>) => {
    try {
      if (editing && !editing.is_primary) {
        await api.put(`/api/companies/${editing.id}`, values);
        message.success(t('updated'));
      } else {
        await api.post('/api/companies', values);
        message.success(t('created'));
      }
      setOpen(false);
      form.resetFields();
      setEditing(null);
      load();
    } catch {
      message.error(t('error'));
    }
  };

  const onSwitch = async (id: string) => {
    try {
      await api.post(`/api/companies/${id}/switch`);
      localStorage.setItem('active_company_id', id);
      message.success(t('switched') || 'Switched');
    } catch {
      message.error(t('error'));
    }
  };

  const onArchive = (record: Company) => {
    if (record.is_primary) {
      message.warning(t('cannot_archive_primary') || 'Cannot archive primary');
      return;
    }
    Modal.confirm({
      title: t('confirmDelete'),
      onOk: async () => {
        try {
          await api.delete(`/api/companies/${record.id}`);
          message.success(t('deleted'));
          load();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const columns = [
    {
      title: t('name'),
      dataIndex: 'name',
      key: 'name',
      render: (v: string, r: Company) => (
        <Space>
          <BankOutlined />
          <span>{v}</span>
          {r.is_primary && <Tag color="blue">{t('primary') || 'Primary'}</Tag>}
        </Space>
      ),
    },
    { title: t('code'), dataIndex: 'code', key: 'code' },
    { title: t('currency'), dataIndex: 'currency', key: 'currency' },
    { title: t('tax_id') || 'Tax ID', dataIndex: 'tax_id', key: 'tax_id' },
    { title: t('phone'), dataIndex: 'phone', key: 'phone' },
    {
      title: t('active'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? t('yes') : t('no')}</Tag>,
    },
    {
      title: t('actions') || 'Actions',
      key: 'actions',
      render: (_: unknown, r: Company) => (
        <Space>
          <Tooltip title={t('switch') || 'Switch'}>
            <Button icon={<SwapOutlined />} size="small" onClick={() => onSwitch(r.id)} />
          </Tooltip>
          {!r.is_primary && (
            <>
              <Button
                icon={<EditOutlined />}
                size="small"
                onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}
              />
              <Button danger icon={<DeleteOutlined />} size="small" onClick={() => onArchive(r)} />
            </>
          )}
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
    try { localStorage.setItem('companies.hiddenCols', JSON.stringify(next)); } catch {}
  };

  return (
    <div>
      <PageHeader
        title={t('companies') || 'Companies'}
        subtitle={t('companies_subtitle', 'بەڕێوەبردنی چەند کۆمپانیا')}
        extra={
          <Space size={spaceTk.sm}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}
            >
              {t('new_company') || 'New Company'}
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
              downloadCsv('companies', data, cols);
            }
          }}
        />
        <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
      </div>
      <Table
        rowKey="id"
        dataSource={data}
        columns={visibleColumns}
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
      <Modal
        title={editing ? (t('edit') + ' ' + t('company')) : (t('new_company') || 'New Company')}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="name" label={t('name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label={t('code')}>
            <Input />
          </Form.Item>
          <Form.Item name="currency" label={t('currency')} initialValue="IQD">
            <Input />
          </Form.Item>
          <Form.Item name="tax_id" label={t('tax_id') || 'Tax ID'}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={t('phone')}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t('email')}>
            <Input type="email" />
          </Form.Item>
          <Form.Item name="address" label={t('address')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label={t('active')} valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
