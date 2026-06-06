import React, { useEffect, useMemo, useState } from 'react';
import { Button, message } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import dayjs from 'dayjs';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface Subscription {
  id: string;
  contact_id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  last_invoice_id?: string;
}

const SubscriptionDunning: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('subscriptions.dunning.hiddenCols') || '[]'); } catch { return []; }
  });

  const filteredData = useMemo(() => {
    if (!search) return subscriptions;
    const q = search.toLowerCase();
    return subscriptions.filter((row: any) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }, [subscriptions, search]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/subscriptions/dunning/queue');
      setSubscriptions(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQueue();
  }, []);

  const handleRunDunning = async (id: string) => {
    try {
      await api.post(`/api/subscriptions/${id}/dunning/run`, {});
      message.success(t('subscription.dunning_sent'));
      void fetchQueue();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || t('error');
      message.error(errorMsg);
    }
  };

  const allColumns = [
    {
      title: t('subscription.subscription_id'),
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: string) => (
        <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
          {id.substring(0, 8)}
        </span>
      ),
    },
    {
      title: t('subscription.contact'),
      dataIndex: 'contact_id',
      key: 'contact_id',
      width: 140,
      render: (id: string) => (
        <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
          {id.substring(0, 8)}
        </span>
      ),
    },
    {
      title: t('subscription.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <StatusTag status="warning" label={t(`subscription.status_${status}`)} />
      ),
      width: 100,
    },
    {
      title: t('subscription.period_end'),
      dataIndex: 'current_period_end',
      key: 'current_period_end',
      render: (date: string) => (
        <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
          {dayjs(date).format('YYYY-MM-DD')}
        </span>
      ),
      width: 120,
    },
    {
      title: t('subscription.days_overdue'),
      key: 'days_overdue',
      render: (_: any, record: Subscription) => {
        const end = dayjs(record.current_period_end);
        const now = dayjs();
        const days = now.diff(end, 'day');
        return <StatusTag status={days > 7 ? 'error' : 'warning'} label={String(days)} />;
      },
      width: 100,
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'center' as const,
      render: (_: any, record: Subscription) => (
        <KitRowActions
          ariaLabel={t('actions')}
          actions={[
            { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => navigate(`/subscriptions/${record.id}`) },
            { key: 'run', icon: <PlayCircleOutlined />, label: t('subscription.run_dunning'), onClick: () => handleRunDunning(record.id) },
          ]}
        />
      ),
    },
  ];

  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'id' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('subscriptions.dunning.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <div>
      <PageHeader
        title={t('subscription.dunning_queue')}
        subtitle={t('subscription.dunning_subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchQueue}>
            {t('refresh')}
          </Button>
        }
      />

      <KitListCard
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => { setSearch(v); }}
              placeholder={t('search')}
            />
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta.filter((c) => c.key !== 'actions')}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('dunning-queue', filteredData, cols);
                }}
                onPrint={() => window.print()}
                onImport={() => message.info(t('coming_soon', 'Coming soon'))}
                onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
                onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
              />
            </div>
          </>
        }
      >
        <ResponsiveTableAdapter
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: t('subscription.no_past_due'),
          }}
        />
      </KitListCard>
    </div>
  );
};

export default SubscriptionDunning;
