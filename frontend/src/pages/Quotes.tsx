import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Tag, Select, Dropdown, Space } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, MoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { PageHeader, StatusTag, ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { space } from '../theme/tokens';
import { useAuthStore } from '../store';

const statusColors: Record<string, string> = {
  draft: 'default', sent: 'blue', accepted: 'green', declined: 'red', expired: 'grey', invoiced: 'purple',
};

const Quotes: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('quotes.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/quotes', { params: { page, status: statusFilter, page_size: 20 } });
      setData(res.data.items); setTotal(res.data.total);
    } catch { message.error(t('error')); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, statusFilter]);

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post(`/api/quotes/${id}/${action}`);
      message.success(t('success'));
      fetchData();
    } catch { message.error(t('error')); }
  };

  const columns = [
    { title: '#', dataIndex: 'quote_number', key: 'quote_number' },
    { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
    { title: t('expiry_date'), dataIndex: 'expiry_date', key: 'expiry_date', render: (d: string) => d?.substring(0, 10) },
    { title: t('total'), dataIndex: 'total', key: 'total', render: (v: number) => v?.toLocaleString() },
    { title: t('status'), dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={s} label={t(s)} /> },
    {
      title: t('actions'), key: 'actions',
      render: (_: any, r: any) => {
        const items = [];
        if (r.status === 'draft') items.push({ key: 'send', label: t('send'), onClick: () => handleAction(r.id, 'send') });
        if (r.status === 'sent') {
          items.push({ key: 'accept', label: t('accept'), onClick: () => handleAction(r.id, 'accept') });
          items.push({ key: 'decline', label: t('decline'), onClick: () => handleAction(r.id, 'decline') });
        }
        if (['draft', 'sent', 'accepted'].includes(r.status)) {
          items.push({ key: 'to-invoice', label: t('convert_to_invoice'), onClick: () => handleAction(r.id, 'convert-to-invoice') });
          items.push({ key: 'to-so', label: t('convert_to_sales_order'), onClick: () => handleAction(r.id, 'convert-to-sales-order') });
        }
        return <Dropdown menu={{ items }} trigger={['click']}><Button icon={<MoreOutlined />} size="small" /></Dropdown>;
      },
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'quote_number' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('quotes.hiddenCols', JSON.stringify(next)); } catch {}
  };

  return (
    <div>
      <PageHeader
        title={t('quotes')}
        subtitle={t('quotes_subtitle', 'پێشنیاری نرخ بۆ کڕیاران')}
        helpKey="quotes"
        extra={
          <Space size={space.sm}>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/quotes/new')}>{t('new_quote')}</Button>
          </Space>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: space.md, alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
        <Select placeholder={t('status')} value={statusFilter || undefined} onChange={(v) => { setStatusFilter(v || ''); setPage(1); }} allowClear style={{ width: 200 }}>
          {['draft', 'sent', 'accepted', 'declined', 'invoiced'].map(s => <Select.Option key={s} value={s}>{t(s)}</Select.Option>)}
        </Select>
        <ExportMenu
          formats={['csv']}
          onExport={(f: ExportFormat) => {
            if (f === 'csv') {
              const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
              downloadCsv('quotes', data, cols);
            }
          }}
        />
        <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
      </div>
      <Table dataSource={data} columns={visibleColumns} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
    </div>
  );
};

export default Quotes;
