import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, DatePicker, Space, Statistic, Row, Col, Tabs } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { message } from '../utils/message';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { ResponsiveChart } from '../components/responsive/ResponsiveChart';
import { asTranslationKey } from '../i18n/types';

interface ConsolidatedRow {
  company_id: string;
  company_name: string;
  revenue: number;
  expenses: number;
  profit: number;
}
interface BSRow {
  company_id: string;
  company_name: string;
  assets: number;
  liabilities: number;
  equity: number;
}

export default function ConsolidatedReports() {
  const { t } = useTranslation();
  const [pl, setPL] = useState<{ rows: ConsolidatedRow[]; totals: { revenue: number; expenses: number; profit: number } } | null>(null);
  const [bs, setBS] = useState<{ rows: BSRow[]; totals: { assets: number; liabilities: number; equity: number } } | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('year'),
    dayjs().endOf('year'),
  ]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [from, to] = range;
      const [plRes, bsRes] = await Promise.all([
        api.get('/api/companies/consolidated/pl', {
          params: { date_from: from.format('YYYY-MM-DD'), date_to: to.format('YYYY-MM-DD') },
        }),
        api.get('/api/companies/consolidated/bs'),
      ]);
      setPL(plRes.data);
      setBS(bsRes.data);
    } catch {
      message.error(t('error'));
    }
    setLoading(false);
  };

  useEffect(() => { load();   }, []);

  const fmt = (n: number) => n.toLocaleString();

  const plCols = [
    { title: t('company') || 'Company', dataIndex: 'company_name' },
    { title: t('revenue') || 'Revenue', dataIndex: 'revenue', render: fmt },
    { title: t('expenses') || 'Expenses', dataIndex: 'expenses', render: fmt },
    { title: t('profit') || 'Profit', dataIndex: 'profit', render: fmt },
  ];

  const bsCols = [
    { title: t('company') || 'Company', dataIndex: 'company_name' },
    { title: t('assets') || 'Assets', dataIndex: 'assets', render: fmt },
    { title: t('liabilities') || 'Liabilities', dataIndex: 'liabilities', render: fmt },
    { title: t('equity') || 'Equity', dataIndex: 'equity', render: fmt },
  ];

  const items = [
    {
      key: 'pl',
      label: t('profit_loss') || 'P&L',
      children: (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Statistic title={t('revenue') || 'Revenue'} value={pl?.totals.revenue || 0} /></Col>
            <Col span={8}><Statistic title={t('expenses') || 'Expenses'} value={pl?.totals.expenses || 0} /></Col>
            <Col span={8}><Statistic title={t('profit') || 'Profit'} value={pl?.totals.profit || 0} /></Col>
          </Row>
          <ResponsiveChart
            legendItems={[
              { id: 'revenue', labelKey: asTranslationKey('revenue'), color: '#52c41a' },
              { id: 'expenses', labelKey: asTranslationKey('expenses'), color: '#ff4d4f' },
              { id: 'profit', labelKey: asTranslationKey('profit'), color: '#7B61FF' },
            ]}
          >
            <BarChart data={pl?.rows || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="company_name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#52c41a" name={t('revenue') || 'Revenue'} />
              <Bar dataKey="expenses" fill="#ff4d4f" name={t('expenses') || 'Expenses'} />
              <Bar dataKey="profit" fill="#7B61FF" name={t('profit') || 'Profit'} />
            </BarChart>
          </ResponsiveChart>
          <ResponsiveTableAdapter
            rowKey="company_id"
            dataSource={pl?.rows || []}
            columns={plCols}
            pagination={false}
            style={{ marginTop: 16 }}
          />
        </>
      ),
    },
    {
      key: 'bs',
      label: t('balance_sheet') || 'Balance Sheet',
      children: (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Statistic title={t('assets') || 'Assets'} value={bs?.totals.assets || 0} /></Col>
            <Col span={8}><Statistic title={t('liabilities') || 'Liabilities'} value={bs?.totals.liabilities || 0} /></Col>
            <Col span={8}><Statistic title={t('equity') || 'Equity'} value={bs?.totals.equity || 0} /></Col>
          </Row>
          <ResponsiveTableAdapter
            rowKey="company_id"
            dataSource={bs?.rows || []}
            columns={bsCols}
            pagination={false}
          />
        </>
      ),
    },
  ];

  return (
    <Card
      title={t('consolidated_reports') || 'Consolidated Reports'}
      extra={
        <Space>
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
          />
          <a onClick={load}>{loading ? '...' : t('refresh') || 'Refresh'}</a>
        </Space>
      }
    >
      <Tabs items={items} />
    </Card>
  );
}
