import React, { useEffect, useState } from 'react';
import { Table, Card, Tag } from 'antd';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { PageHeader } from '../design-system';

const BudgetVariance: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const budgetId = searchParams.get('id');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!budgetId) return;
    setLoading(true);
    api.get(`/api/budgets/${budgetId}/variance`)
      .then(r => setData(r.data))
      .catch(() => message.error(t('error')))
      .finally(() => setLoading(false));
  }, [budgetId]);

  const columns = [
    { title: t('account'), dataIndex: 'account_id', key: 'account_id' },
    { title: t('period'), dataIndex: 'period_year', key: 'period', render: (_: any, record: any) => `${record.period_year}-${String(record.period_month).padStart(2, '0')}` },
    { title: t('budgeted'), dataIndex: 'budgeted', key: 'budgeted', render: (v: number) => (v || 0).toLocaleString() },
    { title: t('actual'), dataIndex: 'actual', key: 'actual', render: (v: number) => (v || 0).toLocaleString() },
    { title: t('variance'), dataIndex: 'variance', key: 'variance', render: (v: number) => (v || 0).toLocaleString() },
    {
      title: t('variance_percent'),
      dataIndex: 'variance_percent',
      key: 'variance_percent',
      render: (v: number) => (
        <Tag color={v > 0 ? 'green' : v < 0 ? 'red' : 'default'}>
          {(v || 0).toFixed(1)}%
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('budget_variance')}
        subtitle={data?.budget_name || t('budget_variance_subtitle', 'جیاوازی بودجە و ڕاستەقینە')}
        helpKey="budgets"
      />
      <Card>
        <Table
          dataSource={data?.variances || []}
          columns={columns}
          rowKey={(r) => `${r.account_id}_${r.period_year}_${r.period_month}`}
          loading={loading}
          pagination={{ pageSize: 50 }}
        />
      </Card>
    </div>
  );
};

export default BudgetVariance;
