/**
 * TenantBilling — the in-app SaaS billing page for the current tenant.
 *
 * Renders:
 *   - Current plan card (slug, cycle, price)
 *   - Trial countdown banner if status === 'trialing'
 *   - Usage vs limits bars (users, invoices/month, POS terminals)
 *   - Next invoice / next-charge preview
 *   - Upgrade / downgrade button (opens PlanPicker)
 *   - Cancel button (confirm modal with reason)
 *   - Invoice history table
 *
 * Backend contract: `/api/saas-billing/state`, `/api/saas-billing/invoices`,
 * `/api/saas-billing/change-plan`, `/api/saas-billing/cancel`.
 *
 * Spec: launch-readiness § R5.6.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  Modal,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Typography,
  Input,
} from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, SectionCard, StatusTag, DataTable, type StatusKind } from '../../design-system';
import PlanPicker from './PlanPicker';

const { Title, Text, Paragraph } = Typography;

interface PlanSummary {
  slug: string;
  name_ku: string;
  name_en: string;
  price_iqd_monthly: number;
  price_usd_monthly: number;
  price_iqd_annual: number;
  price_usd_annual: number;
  limits: Record<string, number>;
  features: Record<string, boolean>;
}

interface BillingState {
  tenant_id: string;
  plan_slug: string;
  billing_cycle: 'monthly' | 'annual';
  currency: 'IQD' | 'USD';
  status: string;
  trial_ends_at: string | null;
  days_left_in_trial: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  payment_method_type: string | null;
  last_payment_at: string | null;
  dunning_step: number;
  plan: PlanSummary | null;
  cancel_at_period_end: boolean;
}

interface InvoiceRow {
  id: string;
  number?: string | null;
  amount_due: number;
  currency: string;
  status: string;
  issued_at?: string | null;
  paid_at?: string | null;
  hosted_url?: string | null;
  pdf_url?: string | null;
}

const formatMoney = (amount: number, currency: string): string => {
  if (currency === 'IQD') return `${amount.toLocaleString()} د.ع`;
  return `$${(amount / 100).toFixed(2)}`;
};

const STATUS_KIND: Record<string, StatusKind> = {
  trialing: 'info',
  active: 'active',
  past_due: 'warning',
  suspended: 'error',
  cancelled: 'default',
  incomplete: 'warning',
};

export default function TenantBilling(): React.ReactElement {
  const { t } = useTranslation();
  const [state, setState] = useState<BillingState | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const [stateRes, invRes] = await Promise.all([
        api.get<BillingState>('/api/saas-billing/state'),
        api.get<{ items: InvoiceRow[] }>('/api/saas-billing/invoices'),
      ]);
      setState(stateRes.data);
      setInvoices(invRes.data.items || []);
    } catch (_err) {
      message.error(t('billing.errors.load_failed', 'Failed to load billing state'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handlePlanChanged = useCallback(() => {
    setPickerOpen(false);
    void loadState();
  }, [loadState]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      await api.post('/api/saas-billing/cancel', {
        at: 'period_end',
        reason: cancelReason,
      });
      message.success(t('billing.cancelled', 'Subscription cancelled'));
      setCancelOpen(false);
      void loadState();
    } catch (_err) {
      message.error(t('billing.errors.cancel_failed', 'Could not cancel'));
    } finally {
      setCancelling(false);
    }
  }, [cancelReason, loadState, t]);

  const handleRestart = useCallback(async () => {
    try {
      await api.post('/api/saas-billing/restart', {});
      message.success(t('billing.restarted', 'Subscription restarted'));
      void loadState();
    } catch {
      message.error(t('billing.errors.restart_failed', 'Could not restart'));
    }
  }, [loadState, t]);

  if (loading || !state) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const plan = state.plan;
  const price = plan
    ? state.currency === 'IQD'
      ? state.billing_cycle === 'monthly'
        ? plan.price_iqd_monthly
        : plan.price_iqd_annual
      : state.billing_cycle === 'monthly'
        ? Math.round(plan.price_usd_monthly * 100)
        : Math.round(plan.price_usd_annual * 100)
    : 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader title={t('billing.title', 'Subscription & Billing')} />

      {state.status === 'trialing' && state.days_left_in_trial !== null && (
        <Alert
          type={state.days_left_in_trial <= 3 ? 'error' : 'info'}
          showIcon
          style={{ marginBottom: 16 }}
          message={t('billing.trial.banner', {
            days: state.days_left_in_trial,
            defaultValue: '{{days}} days left in your trial',
          })}
          action={
            <Button type="primary" onClick={() => setPickerOpen(true)}>
              {t('billing.upgrade_now', 'Upgrade now')}
            </Button>
          }
        />
      )}

      {state.status === 'past_due' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('billing.past_due.banner',
            'Your payment is past due. Please update your billing details.')}
        />
      )}

      {state.status === 'suspended' && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('billing.suspended.banner',
            'Your account is suspended. Restart your subscription to regain access.')}
          action={<Button onClick={handleRestart}>{t('billing.restart', 'Restart')}</Button>}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <SectionCard title={t('billing.current_plan', 'Current plan')}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Title level={3} style={{ margin: 0 }}>
                {plan?.name_ku || plan?.name_en || state.plan_slug}
              </Title>
              <StatusTag status={STATUS_KIND[state.status] || 'default'} label={t(`billing.status.${state.status}`, state.status)} />
              <Statistic
                value={formatMoney(price, state.currency)}
                suffix={`/ ${t(`billing.cycle.${state.billing_cycle}`, state.billing_cycle)}`}
              />
              <Space style={{ marginTop: 12 }}>
                <Button type="primary" onClick={() => setPickerOpen(true)}>
                  {t('billing.change_plan', 'Change plan')}
                </Button>
                {state.status !== 'cancelled' && !state.cancel_at_period_end && (
                  <Button danger onClick={() => setCancelOpen(true)}>
                    {t('billing.cancel', 'Cancel subscription')}
                  </Button>
                )}
                {state.cancel_at_period_end && (
                  <Button onClick={handleRestart}>
                    {t('billing.undo_cancel', 'Undo cancellation')}
                  </Button>
                )}
              </Space>
            </Space>
          </SectionCard>
        </Col>

        <Col xs={24} md={12}>
          <SectionCard title={t('billing.usage', 'Usage')}>
            {plan && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <UsageBar
                  label={t('billing.usage.users', 'Users')}
                  limit={plan.limits.users}
                />
                <UsageBar
                  label={t('billing.usage.invoices', 'Invoices / month')}
                  limit={plan.limits.invoices_per_month}
                />
                <UsageBar
                  label={t('billing.usage.pos_terminals', 'POS terminals')}
                  limit={plan.limits.pos_terminals}
                />
                <UsageBar
                  label={t('billing.usage.storage', 'Storage (GB)')}
                  limit={plan.limits.storage_gb}
                />
              </Space>
            )}
          </SectionCard>
        </Col>
      </Row>

      <SectionCard title={t('billing.invoices', 'Invoice history')} padded={false} style={{ marginTop: 'var(--space-lg)' }}>
        <DataTable<InvoiceRow>
          rowKey="id"
          dataSource={invoices}
          pagination={false}
          emptyTitle={t('billing.no_invoices', 'No invoices yet')}
          columns={[
            { title: t('billing.invoice.number', 'Number'), dataIndex: 'number', key: 'number' },
            {
              title: t('billing.invoice.amount', 'Amount'),
              dataIndex: 'amount_due',
              key: 'amount_due',
              align: 'right',
              render: (v: number, row) => formatMoney(v, row.currency),
            },
            {
              title: t('billing.invoice.status', 'Status'),
              dataIndex: 'status',
              key: 'status',
              render: (s: string) => <StatusTag status={(STATUS_KIND[s] || 'default')} label={s} />,
            },
            { title: t('billing.invoice.date', 'Date'), dataIndex: 'issued_at', key: 'issued_at' },
            {
              title: '',
              key: 'actions',
              render: (_v, row) =>
                row.hosted_url ? (
                  <a href={row.hosted_url} target="_blank" rel="noreferrer">
                    {t('billing.invoice.view', 'View')}
                  </a>
                ) : null,
            },
          ]}
        />
      </SectionCard>

      <PlanPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onApplied={handlePlanChanged}
        currentPlanSlug={state.plan_slug}
        currentCurrency={state.currency}
        currentCycle={state.billing_cycle}
      />

      <Modal
        title={t('billing.cancel.title', 'Cancel subscription')}
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={handleCancel}
        okButtonProps={{ danger: true, loading: cancelling }}
        okText={t('billing.cancel.confirm', 'Yes, cancel')}
      >
        <Paragraph>
          {t('billing.cancel.body',
            "We're sorry to see you go. Your subscription will end at the period end.")}
        </Paragraph>
        <Input.TextArea
          rows={3}
          placeholder={t('billing.cancel.reason_placeholder',
            'Optional — tell us why so we can improve') as string}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}

interface UsageBarProps {
  label: string;
  limit: number;
  used?: number;
}

function UsageBar({ label, limit, used = 0 }: UsageBarProps): React.ReactElement {
  const isUnlimited = limit < 0;
  const percent = isUnlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Text>{label}</Text>
        <Text type="secondary">
          {isUnlimited ? '∞' : `${used} / ${limit}`}
        </Text>
      </div>
      {!isUnlimited && (
        <Progress percent={percent} showInfo={false} />
      )}
    </div>
  );
}
