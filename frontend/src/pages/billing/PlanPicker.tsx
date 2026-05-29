/**
 * PlanPicker — modal for choosing/switching SaaS plans.
 *
 * Renders 3 plan cards (Starter / Growth / Pro) with a currency toggle
 * (IQD / USD) and a billing-cycle toggle (Monthly / Annual). Annual shows
 * a "2 months free" discount badge.
 *
 * On confirm:
 *   1. POST /api/saas-billing/change-plan with confirm:false → server returns proration preview.
 *   2. Show preview to user → confirm.
 *   3. POST again with confirm:true to apply.
 *
 * Spec: launch-readiness § R5.6.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Modal,
  Radio,
  Row,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';

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

interface Props {
  open: boolean;
  onClose(): void;
  onApplied(): void;
  currentPlanSlug: string;
  currentCurrency: 'IQD' | 'USD';
  currentCycle: 'monthly' | 'annual';
}

interface ProrationPreview {
  amount_due_now: number;
  currency: string;
  credit_from_old_plan: number;
  next_invoice_total: number;
  next_invoice_at: string | null;
}

const formatPrice = (amount: number, currency: string): string => {
  if (currency === 'IQD') return `${amount.toLocaleString()} د.ع`;
  return `$${amount.toFixed(2)}`;
};

export default function PlanPicker({
  open, onClose, onApplied,
  currentPlanSlug, currentCurrency, currentCycle,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [trialDays, setTrialDays] = useState<number>(90);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>(currentPlanSlug);
  const [currency, setCurrency] = useState<'IQD' | 'USD'>(currentCurrency);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>(currentCycle);
  const [preview, setPreview] = useState<ProrationPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<{ items: PlanSummary[]; trial_days: number }>('/api/saas-billing/plans')
      .then((res) => {
        setPlans(res.data.items);
        setTrialDays(res.data.trial_days);
      })
      .catch(() => message.error(t('billing.errors.plans_load_failed', 'Failed to load plans')))
      .finally(() => setLoading(false));
    setSelectedPlan(currentPlanSlug);
    setCurrency(currentCurrency);
    setCycle(currentCycle);
    setPreview(null);
  }, [open, currentPlanSlug, currentCurrency, currentCycle, t]);

  const priceFor = (plan: PlanSummary): number => {
    if (currency === 'IQD') return cycle === 'monthly' ? plan.price_iqd_monthly : plan.price_iqd_annual;
    return cycle === 'monthly' ? plan.price_usd_monthly : plan.price_usd_annual;
  };

  const monthlyEquivalent = (plan: PlanSummary): number => {
    const total = priceFor(plan);
    return cycle === 'annual' ? total / 12 : total;
  };

  const fetchPreview = async () => {
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await api.post<{ preview: ProrationPreview; applied: boolean }>(
        '/api/saas-billing/change-plan',
        { to_plan: selectedPlan, billing_cycle: cycle, currency, confirm: false },
      );
      setPreview(res.data.preview);
    } catch {
      message.error(t('billing.errors.preview_failed', 'Failed to preview change'));
    } finally {
      setPreviewing(false);
    }
  };

  const applyChange = async () => {
    setApplying(true);
    try {
      await api.post('/api/saas-billing/change-plan', {
        to_plan: selectedPlan, billing_cycle: cycle, currency, confirm: true,
      });
      message.success(t('billing.plan_changed', 'Plan changed'));
      onApplied();
    } catch {
      message.error(t('billing.errors.apply_failed', 'Failed to apply change'));
    } finally {
      setApplying(false);
    }
  };

  const isCurrent = (slug: string): boolean =>
    slug === currentPlanSlug && currency === currentCurrency && cycle === currentCycle;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      title={t('billing.picker.title', 'Choose a plan')}
    >
      {loading ? (
        <div style={{ padding: 64, textAlign: 'center' }}><Spin size="large" /></div>
      ) : (
        <>
          <Space style={{ marginBottom: 16 }} size="large">
            <div>
              <Text strong>{t('billing.picker.currency', 'Currency')}</Text>
              <div>
                <Segmented<'IQD' | 'USD'>
                  options={['IQD', 'USD']}
                  value={currency}
                  onChange={(v) => { setCurrency(v); setPreview(null); }}
                />
              </div>
            </div>
            <div>
              <Text strong>{t('billing.picker.cycle', 'Billing cycle')}</Text>
              <div>
                <Segmented<'monthly' | 'annual'>
                  options={[
                    { label: t('billing.cycle.monthly', 'Monthly'), value: 'monthly' },
                    {
                      label: (
                        <span>
                          {t('billing.cycle.annual', 'Annual')}{' '}
                          <Tag color="green" style={{ marginInlineStart: 4 }}>-17%</Tag>
                        </span>
                      ),
                      value: 'annual',
                    },
                  ]}
                  value={cycle}
                  onChange={(v) => { setCycle(v); setPreview(null); }}
                />
              </div>
            </div>
          </Space>

          <Row gutter={[16, 16]}>
            {plans.map((plan) => {
              const total = priceFor(plan);
              const monthly = monthlyEquivalent(plan);
              const selected = selectedPlan === plan.slug;
              return (
                <Col xs={24} md={8} key={plan.slug}>
                  <Card
                    hoverable
                    onClick={() => { setSelectedPlan(plan.slug); setPreview(null); }}
                    style={{
                      border: selected ? '2px solid #1677ff' : undefined,
                      position: 'relative',
                    }}
                  >
                    {selected && (
                      <CheckCircleFilled
                        style={{
                          position: 'absolute',
                          top: 12, insetInlineEnd: 12,
                          color: '#1677ff', fontSize: 20,
                        }}
                      />
                    )}
                    <Title level={4}>{plan.name_ku}</Title>
                    <Text type="secondary">{plan.name_en}</Text>
                    <div style={{ margin: '12px 0' }}>
                      <Title level={2} style={{ margin: 0 }}>
                        {formatPrice(monthly, currency)}
                      </Title>
                      <Text type="secondary">
                        {t('billing.picker.per_month', '/ month')}
                      </Text>
                      {cycle === 'annual' && (
                        <Paragraph type="secondary" style={{ marginTop: 4 }}>
                          {t('billing.picker.billed_annually',
                            'Billed as {{total}} annually',
                            { total: formatPrice(total, currency) })}
                        </Paragraph>
                      )}
                    </div>
                    <ul style={{ paddingInlineStart: 20 }}>
                      <li>{t('billing.picker.users', { count: plan.limits.users,
                        defaultValue: '{{count}} users' })}</li>
                      <li>{plan.limits.invoices_per_month < 0
                        ? t('billing.picker.unlimited_invoices', 'Unlimited invoices')
                        : t('billing.picker.invoices_per_month',
                            { count: plan.limits.invoices_per_month,
                              defaultValue: '{{count}} invoices/month' })}</li>
                      <li>{plan.limits.pos_terminals < 0
                        ? t('billing.picker.unlimited_pos', 'Unlimited POS terminals')
                        : t('billing.picker.pos_terminals',
                            { count: plan.limits.pos_terminals,
                              defaultValue: '{{count}} POS terminals' })}</li>
                      {plan.features.api_access && <li>{t('billing.features.api', 'API access')}</li>}
                      {plan.features.priority_support && <li>{t('billing.features.priority', 'Priority support')}</li>}
                      {plan.features.sso && <li>{t('billing.features.sso', 'SSO')}</li>}
                    </ul>
                    {isCurrent(plan.slug) && (
                      <Tag color="blue">{t('billing.picker.current', 'Current plan')}</Tag>
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>

          {preview && (
            <Alert
              style={{ marginTop: 16 }}
              type="info"
              showIcon
              message={t('billing.picker.preview.title', 'Proration preview')}
              description={
                <Space direction="vertical">
                  <Text>
                    {t('billing.picker.preview.due_now', 'Due now')}:{' '}
                    <strong>
                      {formatPrice(
                        preview.currency === 'IQD'
                          ? preview.amount_due_now
                          : preview.amount_due_now / 100,
                        preview.currency,
                      )}
                    </strong>
                  </Text>
                </Space>
              }
            />
          )}

          <Space style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            {!preview ? (
              <Button type="primary" loading={previewing} onClick={fetchPreview}>
                {t('billing.picker.preview_button', 'Preview change')}
              </Button>
            ) : (
              <Button type="primary" loading={applying} onClick={applyChange}>
                {t('billing.picker.confirm', 'Confirm change')}
              </Button>
            )}
          </Space>
        </>
      )}
    </Modal>
  );
}
