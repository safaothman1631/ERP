import React, { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
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

  const columns = [
    {
      title: t('subscription.subscription_id'),
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <Button type="link" onClick={() => navigate(`/subscriptions/${id}`)}>
          {id.substring(0, 8)}
        </Button>
      ),
    },
    {
      title: t('subscription.contact'),
      dataIndex: 'contact_id',
      key: 'contact_id',
      width: 120,
      render: (id: string) => id.substring(0, 8),
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
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
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
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: Subscription) => (
        <Button
          type="primary"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={() => handleRunDunning(record.id)}
        >
          {t('subscription.run_dunning')}
        </Button>
      ),
      width: 150,
    },
  ];

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

      <SectionCard padded={false}>
        <ResponsiveTableAdapter
          columns={columns}
          dataSource={subscriptions}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: t('subscription.no_past_due'),
          }}
        />
      </SectionCard>
    </div>
  );
};

export default SubscriptionDunning;
