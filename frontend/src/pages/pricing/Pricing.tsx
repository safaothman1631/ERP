/**
 * Public-facing pricing page.
 *
 * Renders 3 plan cards with IQD ↔ USD toggle, Monthly ↔ Annual toggle,
 * FAQ accordion, and a CTA that routes to /signup. Marked as public in
 * routing — must not require auth. Has SEO meta + Open Graph tags.
 *
 * Spec: launch-readiness § R5 (public marketing surface).
 */

import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Collapse,
  Row,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';

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

const formatPrice = (amount: number, currency: string): string => {
  if (currency === 'IQD') return `${amount.toLocaleString()} د.ع`;
  return `$${amount.toFixed(2)}`;
};

const PLAN_ACCENT: Record<string, string> = {
  starter: '#7B61FF',
  growth: '#52c41a',
  pro: '#722ed1',
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'pricing.faq.q1', a: 'pricing.faq.a1',
  },
  {
    q: 'pricing.faq.q2', a: 'pricing.faq.a2',
  },
  {
    q: 'pricing.faq.q3', a: 'pricing.faq.a3',
  },
  {
    q: 'pricing.faq.q4', a: 'pricing.faq.a4',
  },
];

export default function Pricing(): React.ReactElement {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [trialDays, setTrialDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    // SEO + OG meta (set imperatively to avoid pulling in react-helmet just for this).
    const set = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    const setProp = (prop: string, content: string) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', prop);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    const prevTitle = document.title;
    document.title = t('pricing.seo.title',
      'Pricing — Zoho Kurdistan ERP');
    set('description', t('pricing.seo.description',
      'Affordable, Iraqi-localized ERP. Start a 90-day free trial.'));
    setProp('og:title', document.title);
    setProp('og:description', t('pricing.seo.description', ''));
    setProp('og:type', 'website');
    return () => { document.title = prevTitle; };
  }, [t]);

  useEffect(() => {
    api
      .get<{ items: PlanSummary[]; trial_days: number }>('/api/saas-billing/plans')
      .then((res) => {
        setPlans(res.data.items);
        setTrialDays(res.data.trial_days);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 96, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const priceFor = (plan: PlanSummary): number => {
    if (currency === 'IQD') return cycle === 'monthly' ? plan.price_iqd_monthly : plan.price_iqd_annual;
    return cycle === 'monthly' ? plan.price_usd_monthly : plan.price_usd_annual;
  };

  return (
    <div style={{ padding: '48px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title>{t('pricing.headline', 'Pricing that grows with you')}</Title>
        <Paragraph type="secondary" style={{ fontSize: 18 }}>
          {t('pricing.subhead',
            'Start with a {{days}}-day free trial — no credit card required.',
            { days: trialDays })}
        </Paragraph>
        <Space size="large" style={{ marginTop: 16 }}>
          <Segmented<'IQD' | 'USD'>
            options={['IQD', 'USD']}
            value={currency}
            onChange={setCurrency}
          />
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
            onChange={setCycle}
          />
        </Space>
      </div>

      <Row gutter={[24, 24]} justify="center">
        {plans.map((plan) => {
          const total = priceFor(plan);
          const monthly = cycle === 'annual' ? total / 12 : total;
          const accent = PLAN_ACCENT[plan.slug] || '#7B61FF';
          return (
            <Col xs={24} md={8} key={plan.slug}>
              <Card style={{ height: '100%', borderTop: `4px solid ${accent}` }}>
                <Title level={3}>{plan.name_ku}</Title>
                <Text type="secondary">{plan.name_en}</Text>
                <div style={{ margin: '24px 0' }}>
                  <Title level={1} style={{ margin: 0, color: accent }}>
                    {formatPrice(monthly, currency)}
                  </Title>
                  <Text type="secondary">
                    {t('pricing.per_month', '/ month')}
                  </Text>
                  {cycle === 'annual' && (
                    <Paragraph type="secondary" style={{ marginTop: 4 }}>
                      {t('pricing.billed_annually',
                        'Billed annually as {{total}}',
                        { total: formatPrice(total, currency) })}
                    </Paragraph>
                  )}
                </div>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <FeatureLine ok>{t('pricing.users', { count: plan.limits.users,
                    defaultValue: '{{count}} users' })}</FeatureLine>
                  <FeatureLine ok>
                    {plan.limits.invoices_per_month < 0
                      ? t('pricing.unlimited_invoices', 'Unlimited invoices')
                      : t('pricing.invoices', { count: plan.limits.invoices_per_month,
                          defaultValue: '{{count}} invoices / month' })}
                  </FeatureLine>
                  <FeatureLine ok>
                    {plan.limits.pos_terminals < 0
                      ? t('pricing.unlimited_pos', 'Unlimited POS terminals')
                      : t('pricing.pos_terminals', { count: plan.limits.pos_terminals,
                          defaultValue: '{{count}} POS terminals' })}
                  </FeatureLine>
                  <FeatureLine ok={plan.features.multi_currency}>
                    {t('pricing.features.multi_currency', 'Multi-currency')}
                  </FeatureLine>
                  <FeatureLine ok={plan.features.api_access}>
                    {t('pricing.features.api', 'API access')}
                  </FeatureLine>
                  <FeatureLine ok={plan.features.priority_support}>
                    {t('pricing.features.priority', 'Priority support')}
                  </FeatureLine>
                  <FeatureLine ok={plan.features.sso}>
                    {t('pricing.features.sso', 'SSO')}
                  </FeatureLine>
                </Space>
                <Button
                  type="primary"
                  size="large"
                  block
                  style={{ marginTop: 24, background: accent, borderColor: accent }}
                  href={`/signup?plan=${plan.slug}&cycle=${cycle}&currency=${currency}`}
                >
                  {t('pricing.cta', 'Start free trial')}
                </Button>
              </Card>
            </Col>
          );
        })}
      </Row>

      <div style={{ marginTop: 64 }}>
        <Title level={3}>{t('pricing.faq.title', 'Frequently asked questions')}</Title>
        <Collapse
          items={FAQS.map((f, i) => ({
            key: String(i),
            label: t(f.q, '—'),
            children: <Paragraph>{t(f.a, '—')}</Paragraph>,
          }))}
        />
      </div>
    </div>
  );
}

function FeatureLine({ ok, children }: { ok: boolean; children: React.ReactNode }): React.ReactElement {
  return (
    <Space>
      <CheckOutlined style={{ color: ok ? 'var(--success-500)' : 'var(--ink-400)' }} />
      <Text style={{ textDecoration: ok ? undefined : 'line-through', color: ok ? undefined : 'var(--ink-400)' }}>
        {children}
      </Text>
    </Space>
  );
}
