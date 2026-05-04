import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Tag, Space, Select, Modal, Form, Input, InputNumber, DatePicker } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import ExportButton from '../components/ExportButton';
import dayjs from 'dayjs';
import { PageHeader, StatusTag, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space } from '../theme/tokens';
import { useAuthStore } from '../store';

const statusColors: Record<string, string> = {
  draft: 'default', open: 'blue', paid: 'green', overdue: 'red', partially_paid: 'orange', void: 'grey',
};

const Bills: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [vendors, setVendors] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [lines, setLines] = useState([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('bills.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/bills', { params: { page, status: statusFilter, page_size: 20 } });
      setData(res.data.items); setTotal(res.data.total);
    } catch { message.error(t('error')); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, statusFilter]);

  useEffect(() => {
    api.get('/api/contacts', { params: { contact_type: 'vendor', page_size: 200 } }).then(r => setVendors(r.data.items || []));
    api.get('/api/accounts').then(r => setAccounts(r.data || []));
  }, []);

  const updateLine = (idx: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      const q = field === 'quantity' ? value : newLines[idx].quantity;
      const r2 = field === 'rate' ? value : newLines[idx].rate;
      newLines[idx].amount = (q || 0) * (r2 || 0);
    }
    setLines(newLines);
  };

  const handleSave = async (values: any) => {
    if (lines.every(l => !l.description && !l.rate)) {
      message.error(t('error')); return;
    }
    const payload = {
      ...values,
      date: values.date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
      due_date: values.due_date?.format('YYYY-MM-DD'),
      lines: lines.filter(l => l.description || l.rate > 0).map(l => ({
        ...l,
        amount: (l.quantity || 1) * (l.rate || 0),
      })),
    };
    // Convert empty strings to null
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
    try {
      await api.post('/api/bills', payload);
      message.success(t('success'));
      setModal(false);
      form.resetFields();
      setLines([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
      fetchData();
    } catch { message.error(t('error')); }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/api/bills/${id}/approve`);
      message.success(t('success'));
      fetchData();
    } catch { message.error(t('error')); }
  };

  const columns = [
    { title: '#', dataIndex: 'bill_number', key: 'bill_number' },
    { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
    { title: t('due_date'), dataIndex: 'due_date', key: 'due_date', render: (d: string) => d?.substring(0, 10) },
    { title: t('total'), dataIndex: 'total', key: 'total', render: (v: number) => v?.toLocaleString() },
    { title: t('balance_due'), dataIndex: 'balance_due', key: 'balance_due', render: (v: number) => v?.toLocaleString() },
    { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={s} label={t(s)} /> },
    {
      title: t('actions'), key: 'actions',
      render: (_: any, r: any) => (
        <Space>
          {r.status === 'draft' && <Button size="small" onClick={() => handleApprove(r.id)}>{t('approve')}</Button>}
        </Space>
      ),
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'bill_number' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('bills.hiddenCols', JSON.stringify(next)); } catch {}
  };

  return (
    <div>
      <PageHeader
        title={t('bills')}
        subtitle={t('bills_subtitle', 'وەسڵی کڕین')}
        helpKey="bills"
        extra={
          <Space size={space.sm}>
            <ExportButton endpoint="/api/export/bills" filename="bills" />
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => { form.resetFields(); setModal(true); }}>{t('new_bill')}</Button>
          </Space>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: space.md, alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
        <Select
          placeholder={t('status')}
          value={statusFilter || undefined}
          onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
          allowClear
          style={{ width: 200 }}
        >
          <Select.Option value="draft">{t('draft')}</Select.Option>
          <Select.Option value="open">{t('open')}</Select.Option>
          <Select.Option value="paid">{t('paid')}</Select.Option>
          <Select.Option value="overdue">{t('overdue')}</Select.Option>
        </Select>
        <Space>
          <ExportMenu
            formats={['csv']}
            onExport={(f: ExportFormat) => {
              if (f === 'csv') {
                const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                downloadCsv('bills', data, cols);
              }
            }}
          />
          <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
        </Space>
      </div>

      <Table dataSource={data} columns={visibleColumns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />

      <Modal title={t('new_bill')} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={700} okText={t('save')}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ date: dayjs(), currency_code: 'IQD' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label={t('vendor')} name="contact_id" rules={[{ required: true, message: t('required_contact') }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={vendors.map((v: any) => ({ label: v.display_name, value: v.id }))}
                placeholder={t('placeholder_vendor')}
              />
            </Form.Item>
            <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}>
              <DatePicker style={{ width: '100%' }} placeholder={t('placeholder_date')} />
            </Form.Item>
            <Form.Item label={t('due_date')} name="due_date">
              <DatePicker style={{ width: '100%' }} placeholder={t('placeholder_due_date')} />
            </Form.Item>
            <Form.Item label={t('account')} name="account_id">
              <Select
                showSearch
                optionFilterProp="label"
                options={accounts.map((a: any) => ({ label: `${a.code} - ${a.name}`, value: a.id }))}
                placeholder={t('placeholder_select')}
                allowClear
              />
            </Form.Item>
          </div>
          <Form.Item label={t('notes')} name="notes"><Input.TextArea rows={2} placeholder={t('placeholder_notes')} /></Form.Item>

          {/* Line items */}
          <div style={{ marginTop: 8 }}>
            <strong>{t('items')}</strong>
            <Table
              size="small"
              pagination={false}
              dataSource={lines}
              rowKey={(_, i) => String(i)}
              columns={[
                {
                  title: t('description'), dataIndex: 'description', key: 'desc',
                  render: (_, __, i) => <Input value={lines[i].description} onChange={e => updateLine(i, 'description', e.target.value)} />,
                },
                {
                  title: t('quantity'), dataIndex: 'quantity', key: 'qty', width: 100,
                  render: (_, __, i) => <InputNumber min={0} value={lines[i].quantity} onChange={v => updateLine(i, 'quantity', v || 0)} style={{ width: '100%' }} />,
                },
                {
                  title: t('rate'), dataIndex: 'rate', key: 'rate', width: 120,
                  render: (_, __, i) => <InputNumber min={0} value={lines[i].rate} onChange={v => updateLine(i, 'rate', v || 0)} style={{ width: '100%' }} />,
                },
                {
                  title: t('amount'), dataIndex: 'amount', key: 'amt', width: 120,
                  render: (_, __, i) => <span>{lines[i].amount.toLocaleString()}</span>,
                },
                {
                  title: '', key: 'del', width: 40,
                  render: (_, __, i) => lines.length > 1 ? <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setLines(lines.filter((_, j) => j !== i))} /> : null,
                },
              ]}
              footer={() => (
                <Button size="small" onClick={() => setLines([...lines, { description: '', quantity: 1, rate: 0, amount: 0 }])}>{t('add_line')}</Button>
              )}
            />
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Bills;
