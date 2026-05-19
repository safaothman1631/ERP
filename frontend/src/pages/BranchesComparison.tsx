import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, DatePicker, Space, Button } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { ReloadOutlined } from '@ant-design/icons';
import { message } from '../utils/message';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { ResponsiveChart } from '../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../i18n/types';

interface Row {
  branch_id: string;
  branch_name: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function BranchesComparison() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);

  const load = async () => {
    setLoading(true);
    try {
      const [from, to] = range;
      const res = await api.get('/api/branches/comparison', {
        params: { date_from: from.format('YYYY-MM-DD'), date_to: to.format('YYYY-MM-DD') },
      });
      setRows(res.data.rows || []);
    } catch {
      message.error(t('error'));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const fmt = (n: number) => n.toLocaleString();
  const cols = [
    { title: t('branch') || 'Branch', dataIndex: 'branch_name' },
    { title: t('revenue') || 'Revenue', dataIndex: 'revenue', render: fmt },
    { title: t('expenses') || 'Expenses', dataIndex: 'expenses', render: fmt },
    { title: t('profit') || 'Profit', dataIndex: 'profit', render: fmt },
  ];

  return (
    <Card
      title={t('branch_comparison') || 'Branch Comparison'}
      extra={
        <Space>
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            {t('refresh') || 'Refresh'}
          </Button>
        </Space>
      }
    >
      <ResponsiveChart
        legendItems={[
          { id: 'revenue', labelKey: asTranslationKey('revenue'), color: '#52c41a' },
          { id: 'expenses', labelKey: asTranslationKey('expenses'), color: '#ff4d4f' },
          { id: 'profit', labelKey: asTranslationKey('profit'), color: '#1677ff' },
        ]}
      >
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="branch_name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="revenue" fill="#52c41a" name={t('revenue') || 'Revenue'} />
          <Bar dataKey="expenses" fill="#ff4d4f" name={t('expenses') || 'Expenses'} />
          <Bar dataKey="profit" fill="#1677ff" name={t('profit') || 'Profit'} />
        </BarChart>
      </ResponsiveChart>
      <ResponsiveTableAdapter
        rowKey="branch_id"
        dataSource={rows}
        columns={cols}
        pagination={false}
        style={{ marginTop: 16 }}
      />
    </Card>
  );
}
