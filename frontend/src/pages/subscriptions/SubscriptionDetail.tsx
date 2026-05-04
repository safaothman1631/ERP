import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Button, Space, message, Table, Modal, Select } from 'antd';
import { ArrowLeftOutlined, PauseOutlined, PlayCircleOutlined, StopOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space } from '../../theme/tokens';
import dayjs from 'dayjs';

interface Subscription {
  id: string;
  contact_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  current_period_start: string;
  current_period_end: string;
  next_invoice_date?: string;
  trial_end?: string;
  last_invoice_id?: string;
  cancel_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
}

const SubscriptionDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [dunning, setDunning] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [newPlanId, setNewPlanId] = useState<string>('');

  const fetchSubscription = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/subscriptions/${id}`);
      setSubscription(res.data);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDunning = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/api/subscriptions/${id}/dunning`);
      setDunning(res.data.items || []);
    } catch {}
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get('/api/subscriptions/plans');
      setPlans(res.data.items || []);
    } catch {}
  };

  useEffect(() => {
    void fetchSubscription();
    void fetchDunning();
    void fetchPlans();
  }, [id]);

  const handlePause = async () => {
    if (!id) return;
    try {
      await api.post(`/api/subscriptions/${id}/pause`, {});
      message.success(t('subscription.paused'));
      void fetchSubscription();
    } catch {
      message.error(t('error'));
    }
  };

  const handleResume = async () => {
    if (!id) return;
    try {
      await api.post(`/api/subscriptions/${id}/resume`, {});
      message.success(t('subscription.resumed'));
      void fetchSubscription();
    } catch {
      message.error(t('error'));
    }
  };

  const handleCancel = () => {
    if (!id) return;
    Modal.confirm({
      title: t('subscription.confirm_cancel'),
      content: t('subscription.cancel_warning'),
      onOk: async () => {
        try {
          await api.post(`/api/subscriptions/${id}/cancel`, { at_period_end: true });
          message.success(t('subscription.cancel_scheduled'));
          void fetchSubscription();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const handleGenerateInvoice = async () => {
    if (!id) return;
    try {
      await api.post(`/api/subscriptions/${id}/generate-invoice`, {});
      message.success(t('subscription.invoice_generated'));
      void fetchSubscription();
    } catch {
      message.error(t('error'));
    }
  };

  const handleUpgrade = async () => {
    if (!id || !newPlanId) return;
    try {
      await api.post(`/api/subscriptions/${id}/upgrade`, { new_plan_id: newPlanId });
      message.success(t('subscription.upgraded'));
      setUpgradeModalOpen(false);
      void fetchSubscription();
    } catch {
      message.error(t('error'));
    }
  };

  const statusColors: Record<string, string> = {
    trial: 'blue',
    active: 'green',
    past_due: 'orange',
    cancelled: 'red',
    paused: 'default',
  };

  const dunningColumns = [
    {
      title: t('subscription.attempt_number'),
      dataIndex: 'attempt_number',
      key: 'attempt_number',
      width: 80,
    },
    {
      title: t('subscription.action'),
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: t('subscription.sent_at'),
      dataIndex: 'sent_at',
      key: 'sent_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag>{status}</Tag>,
    },
  ];

  if (!subscription) {
    return <div style={{ padding: space.lg }}>{t('loading')}</div>;
  }

  const currentPlan = plans.find(p => p.id === subscription.plan_id);

  return (
    <div style={{ padding: space.lg }}>
      <PageHeader
        title={t('subscription.subscription_detail')}
        subtitle={subscription.id}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/subscriptions')}>
            {t('back')}
          </Button>
        }
      />

      <Card
        title={t('subscription.overview')}
        style={{ marginTop: space.md }}
        extra={
          <Space>
            {subscription.status === 'active' && (
              <>
                <Button icon={<FileTextOutlined />} onClick={handleGenerateInvoice}>
                  {t('subscription.generate_invoice')}
                </Button>
                <Button icon={<UploadOutlined />} onClick={() => setUpgradeModalOpen(true)}>
                  {t('subscription.upgrade')}
                </Button>
                <Button icon={<PauseOutlined />} onClick={handlePause}>
                  {t('subscription.pause')}
                </Button>
                <Button danger icon={<StopOutlined />} onClick={handleCancel}>
                  {t('subscription.cancel')}
                </Button>
              </>
            )}
            {subscription.status === 'paused' && (
              <Button icon={<PlayCircleOutlined />} onClick={handleResume}>
                {t('subscription.resume')}
              </Button>
            )}
          </Space>
        }
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label={t('subscription.status')}>
            <Tag color={statusColors[subscription.status] || 'default'}>
              {t(`subscription.status_${subscription.status}`)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('subscription.plan')}>
            {currentPlan?.name || subscription.plan_id}
          </Descriptions.Item>
          <Descriptions.Item label={t('subscription.contact')}>
            {subscription.contact_id}
          </Descriptions.Item>
          <Descriptions.Item label={t('subscription.start_date')}>
            {dayjs(subscription.start_date).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label={t('subscription.current_period_start')}>
            {dayjs(subscription.current_period_start).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label={t('subscription.current_period_end')}>
            {dayjs(subscription.current_period_end).format('YYYY-MM-DD')}
          </Descriptions.Item>
          {subscription.next_invoice_date && (
            <Descriptions.Item label={t('subscription.next_invoice')}>
              {dayjs(subscription.next_invoice_date).format('YYYY-MM-DD')}
            </Descriptions.Item>
          )}
          {subscription.trial_end && (
            <Descriptions.Item label={t('subscription.trial_end')}>
              {dayjs(subscription.trial_end).format('YYYY-MM-DD')}
            </Descriptions.Item>
          )}
          {subscription.cancel_at && (
            <Descriptions.Item label={t('subscription.cancel_at')}>
              {dayjs(subscription.cancel_at).format('YYYY-MM-DD')}
            </Descriptions.Item>
          )}
          {subscription.cancelled_at && (
            <Descriptions.Item label={t('subscription.cancelled_at')}>
              {dayjs(subscription.cancelled_at).format('YYYY-MM-DD')}
            </Descriptions.Item>
          )}
          {subscription.cancel_reason && (
            <Descriptions.Item label={t('subscription.cancel_reason')} span={2}>
              {subscription.cancel_reason}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {dunning.length > 0 && (
        <Card title={t('subscription.dunning_history')} style={{ marginTop: space.md }}>
          <Table
            columns={dunningColumns}
            dataSource={dunning}
            loading={loading}
            rowKey="id"
            pagination={false}
          />
        </Card>
      )}

      <Modal
        title={t('subscription.upgrade')}
        open={upgradeModalOpen}
        onCancel={() => setUpgradeModalOpen(false)}
        onOk={handleUpgrade}
      >
        <Select
          placeholder={t('subscription.select_new_plan')}
          style={{ width: '100%' }}
          value={newPlanId}
          onChange={setNewPlanId}
        >
          {plans
            .filter(p => p.id !== subscription.plan_id && p.active)
            .map(p => (
              <Select.Option key={p.id} value={p.id}>
                {p.name} - {p.price.toLocaleString()}
              </Select.Option>
            ))}
        </Select>
      </Modal>
    </div>
  );
};

export default SubscriptionDetail;
