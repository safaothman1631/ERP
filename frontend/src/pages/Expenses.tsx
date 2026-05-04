import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space} from 'antd';
import { message } from '../utils/message';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs from 'dayjs';
import { PageHeader, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space } from '../theme/tokens';
import { useAuthStore } from '../store';

const Expenses: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('expenses.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/expenses', { params: { page, page_size: 20 } });
      setData(res.data.items); setTotal(res.data.total);
    } catch { message.error(t('error')); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page]);
  useEffect(() => {
    // Load all accounts - user can pick any expense account (operating_expense, other_expense, etc.)
    api.get('/api/accounts').then(r => {
      const expenseTypes = ['expense', 'operating_expense', 'other_expense', 'cost_of_goods_sold'];
      setAccounts(r.data.filter((a: any) => expenseTypes.includes(a.account_type)));
    }).catch(() => {
      // fallback: load all accounts
      api.get('/api/accounts').then(r => setAccounts(r.data));
    });
  }, []);

  const handleSave = async (values: any) => {
    try {
      await api.post('/api/expenses', {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
      });
      message.success(t('success'));
      setModal(false); form.resetFields(); fetchData();
    } catch { message.error(t('error')); }
  };

  const columns = [
    { title: '#', dataIndex: 'expense_number', key: 'expense_number' },
    { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
    { title: t('description'), dataIndex: 'description', key: 'description' },
    { title: t('amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => v?.toLocaleString() },
    { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => t(s) },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'expense_number',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('expenses.hiddenCols', JSON.stringify(next)); } catch {}
  };

  return (
    <div>
      <PageHeader
        title={t('expenses')}
        subtitle={t('expenses_subtitle', 'تۆمارکردنی خەرجییەکان')}
        helpKey="expenses"
        extra={
          <Space size={space.sm}>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => { form.resetFields(); setModal(true); }}>{t('new_expense')}</Button>
          </Space>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: space.md }}>
        <ExportMenu
          formats={['csv']}
          onExport={(f: ExportFormat) => {
            if (f === 'csv') {
              const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
              downloadCsv('expenses', data, cols);
            }
          }}
        />
        <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
      </div>
      <Table dataSource={data} columns={visibleColumns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />

      <Modal title={t('new_expense')} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={500}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ date: dayjs(), currency_code: 'IQD', exchange_rate: 1 }}>
          <Form.Item label={t('date')} name="date" rules={[{ required: true, message: t('required_date') }]}><DatePicker style={{ width: '100%' }} placeholder={t('placeholder_date')} /></Form.Item>
          <Form.Item label={t('amount')} name="amount" rules={[{ required: true, message: t('required_amount') }]}><InputNumber min={0} style={{ width: '100%' }} placeholder={t('placeholder_amount')} /></Form.Item>
          <Form.Item label={t('account')} name="account_id" rules={[{ required: true, message: t('required_account') }]}>
            <Select placeholder={t('placeholder_select')} options={accounts.map((a: any) => ({ label: a.name, value: a.id }))} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label={t('description')} name="description"><Input.TextArea rows={2} placeholder={t('placeholder_description')} /></Form.Item>
          <Form.Item name="currency_code" hidden><Input /></Form.Item>
          <Form.Item name="exchange_rate" hidden><InputNumber /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Expenses;
