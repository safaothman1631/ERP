import React, { useEffect, useState } from 'react';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, StatusTag, type StatusKind } from '../design-system';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

const Accounts: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/accounts').then(r => setData(Array.isArray(r.data) ? r.data : (r.data.items || [] || []))).catch(() => message.error(t('error'))).finally(() => setLoading(false));
  }, []);

  // Map accounting account types → kit StatusTag semantic kinds (token-driven, auto-flip).
  const typeStatus: Record<string, StatusKind> = {
    asset: 'info', fixed_asset: 'info', other_asset: 'info',
    liability: 'error', other_liability: 'error',
    equity: 'open', income: 'success',
    expense: 'warning', cost_of_goods_sold: 'warning',
  };

  const columns = [
    { title: t('account'), dataIndex: 'code', key: 'code' },
    { title: t('name'), dataIndex: 'name', key: 'name' },
    { title: t('type', 'Type'), dataIndex: 'account_type', key: 'account_type', render: (v: string) => <StatusTag status={typeStatus[v] || 'default'} label={t(v, v)} /> },
    { title: t('balance_due'), dataIndex: 'balance', key: 'balance', render: (v: number) => (v || 0).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader title={t('chart_of_accounts', t('accounts'))} subtitle={t('coa_subtitle', 'Chart of accounts')} helpKey="reports" sectionId="accounting.accounts" />
      <ResponsiveTableAdapter dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={false} />
    </div>
  );
};

export default Accounts;
