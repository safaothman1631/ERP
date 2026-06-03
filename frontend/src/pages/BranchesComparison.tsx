import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DatePicker, Space, Button } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { ReloadOutlined } from '@ant-design/icons';
import { message } from '../utils/message';
import api from '../api';
import { PageHeader } from '../design-system';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { ResponsiveChart } from '../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../i18n/types';
import { dataViz } from '../theme/tokens';

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

  useEffect(() => { load();   }, []);

  const fmt = (n: number) => n.toLocaleString();
  const cols = [
    { title: t('branch') || 'Branch', dataIndex: 'branch_name' },
    { title: t('revenue') || 'Revenue', dataIndex: 'revenue', render: fmt },
    { title: t('expenses') || 'Expenses', dataIndex: 'expenses', render: fmt },
    { title: t('profit') || 'Profit', dataIndex: 'profit', render: fmt },
  ];

  return (
    <div>
      <PageHeader
        title={t('branch_comparison')}
        extra={
          <Space>
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
            />
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              {t('refresh')}
            </Button>
          </Space>
        }
      />
      <ResponsiveChart
        legendItems={[
          { id: 'revenue', labelKey: asTranslationKey('revenue'), color: dataViz.categorical[1] },
          { id: 'expenses', labelKey: asTranslationKey('expenses'), color: dataViz.categorical[3] },
          { id: 'profit', labelKey: asTranslationKey('profit'), color: '#7B61FF' },
        ]}
      >
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="branch_name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="revenue" fill={dataViz.categorical[1]} name={t('revenue') || 'Revenue'} />
          <Bar dataKey="expenses" fill={dataViz.categorical[3]} name={t('expenses') || 'Expenses'} />
          <Bar dataKey="profit" fill="#7B61FF" name={t('profit') || 'Profit'} />
        </BarChart>
      </ResponsiveChart>
      <ResponsiveTableAdapter
        rowKey="branch_id"
        dataSource={rows}
        columns={cols}
        pagination={false}
        style={{ marginTop: 16 }}
      />
    </div>
  );
}
