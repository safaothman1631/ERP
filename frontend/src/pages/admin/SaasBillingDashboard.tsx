/**
 * SaasBillingDashboard — Super-Admin view of SaaS billing KPIs.
 *
 * Renders:
 *   - MRR / ARR statistics (IQD + USD side by side)
 *   - Tenant status breakdown chart
 *   - Past-due + suspended tenant tables with drill-in
 *
 * Access: must be platform admin (super_admin). The backend enforces this
 * via _require_platform_admin; the UI hides the page in nav for non-admins.
 *
 * Spec: launch-readiness § R5.7.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Spin } from 'antd';
import { DollarOutlined, FallOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { PageHeader, SectionCard, StatusTag, DataTable, KpiCard, type StatusKind } from '../../design-system';
import { space } from '../../theme/tokens';

interface Dashboard {
  mrr_iqd: number;
  mrr_usd: number;
  arr_iqd: number;
  arr_usd: number;
  active_tenants: number;
  trialing_tenants: number;
  past_due_tenants: number;
  suspended_tenants: number;
  cancelled_tenants: number;
  trial_to_paid_conversion: number;
  churn_rate_monthly: number;
}

interface TenantRow {
  tenant_id: string;
  plan_slug: string | null;
  status: string | null;
  billing_cycle: string | null;
  trial_ends_at: string | null;
  last_payment_at: string | null;
  mrr_value: number;
}

const STATUS_KIND: Record<string, StatusKind> = {
  trialing: 'info',
  active: 'active',
  past_due: 'warning',
  suspended: 'error',
  cancelled: 'default',
};

export default function SaasBillingDashboard(): React.ReactElement {
  const { t } = useTranslation();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, list] = await Promise.all([
        api.get<Dashboard>('/api/saas-billing/admin/dashboard'),
        api.get<{ items: TenantRow[] }>('/api/saas-billing/admin/tenants?page_size=200'),
      ]);
      setDash(d.data);
      setTenants(list.data.items || []);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403) setForbidden(true);
      else message.error(t('admin.billing.load_failed', 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (forbidden) {
    return (
      <Alert
        type="error"
        message={t('admin.billing.forbidden', 'Platform-admin access required')}
      />
    );
  }

  if (loading || !dash) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const numberFmt = (n: number) => n.toLocaleString('en-US');

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader title={t('admin.billing.title', 'SaaS Billing — Admin')} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: space.md, marginBottom: space.md }}>
        <KpiCard title={t('admin.billing.mrr_iqd', 'MRR (IQD)')} value={`${numberFmt(dash.mrr_iqd)} د.ع`} icon={<DollarOutlined />} tone="primary" />
        <KpiCard title={t('admin.billing.mrr_usd', 'MRR (USD)')} value={`$${dash.mrr_usd.toFixed(2)}`} icon={<DollarOutlined />} tone="primary" />
        <KpiCard title={t('admin.billing.arr_iqd', 'ARR (IQD)')} value={`${numberFmt(dash.arr_iqd)} د.ع`} icon={<DollarOutlined />} tone="info" />
        <KpiCard title={t('admin.billing.churn', 'Monthly churn')} value={`${(dash.churn_rate_monthly * 100).toFixed(2)}%`} icon={<FallOutlined />} tone="warning" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: space.md, marginBottom: space.lg }}>
        <KpiCard title={t('admin.billing.active', 'Active')} value={dash.active_tenants} icon={<CheckCircleOutlined />} tone="success" />
        <KpiCard title={t('admin.billing.trialing', 'Trialing')} value={dash.trialing_tenants} icon={<ClockCircleOutlined />} tone="primary" />
        <KpiCard title={t('admin.billing.past_due', 'Past due')} value={dash.past_due_tenants} icon={<ExclamationCircleOutlined />} tone="warning" />
        <KpiCard title={t('admin.billing.suspended', 'Suspended')} value={dash.suspended_tenants} icon={<StopOutlined />} tone="danger" />
      </div>

      <SectionCard title={t('admin.billing.tenants', 'Tenants')} padded={false}>
        <DataTable<TenantRow>
          rowKey="tenant_id"
          dataSource={tenants}
          pagination={{ pageSize: 25 }}
          columns={[
            { title: t('admin.billing.col.tenant', 'Tenant'), dataIndex: 'tenant_id', key: 'tenant_id' },
            { title: t('admin.billing.col.plan', 'Plan'), dataIndex: 'plan_slug', key: 'plan_slug' },
            {
              title: t('admin.billing.col.status', 'Status'),
              dataIndex: 'status',
              key: 'status',
              render: (s: string | null) => s ? (
                <StatusTag status={STATUS_KIND[s] || 'default'} label={s} />
              ) : null,
            },
            { title: t('admin.billing.col.cycle', 'Cycle'), dataIndex: 'billing_cycle', key: 'billing_cycle' },
            {
              title: t('admin.billing.col.mrr', 'MRR (IQD)'),
              dataIndex: 'mrr_value',
              key: 'mrr_value',
              align: 'right',
              sorter: (a, b) => a.mrr_value - b.mrr_value,
              render: (v: number) => v.toLocaleString(),
            },
            { title: t('admin.billing.col.trial_end', 'Trial ends'), dataIndex: 'trial_ends_at', key: 'trial_ends_at' },
            { title: t('admin.billing.col.last_payment', 'Last payment'), dataIndex: 'last_payment_at', key: 'last_payment_at' },
          ]}
        />
      </SectionCard>
    </div>
  );
}
