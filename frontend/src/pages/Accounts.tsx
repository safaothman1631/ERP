import React, { useEffect, useState } from 'react';
import { Table, Tag} from 'antd';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader } from '../design-system';

const Accounts: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/accounts').then(r => setData(Array.isArray(r.data) ? r.data : (r.data.items || [] || []))).catch(() => message.error(t('error'))).finally(() => setLoading(false));
  }, []);

  const typeColors: Record<string, string> = {
    asset: 'blue', liability: 'red', equity: 'purple', income: 'green', expense: 'orange',
    cost_of_goods_sold: 'volcano', other_asset: 'cyan', fixed_asset: 'geekblue',
    other_liability: 'magenta',
  };

  const columns = [
    { title: t('account'), dataIndex: 'code', key: 'code' },
    { title: t('name'), dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'account_type', key: 'account_type', render: (v: string) => <Tag color={typeColors[v] || 'default'}>{v}</Tag> },
    { title: t('balance_due'), dataIndex: 'balance', key: 'balance', render: (v: number) => (v || 0).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader title={t('chart_of_accounts', t('accounts'))} subtitle={t('coa_subtitle', 'پلانی ژمارەکان')} helpKey="reports" />
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={false} />
    </div>
  );
};

export default Accounts;
