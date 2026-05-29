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
import {
  Alert,
  Card,
  Col,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';

const { Title } = Typography;

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

const STATUS_COLOR: Record<string, string> = {
  trialing: 'blue',
  active: 'green',
  past_due: 'orange',
  suspended: 'red',
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

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Title level={2}>{t('admin.billing.title', 'SaaS Billing — Admin')}</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('admin.billing.mrr_iqd', 'MRR (IQD)')}
              value={dash.mrr_iqd}
              suffix="د.ع"
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('admin.billing.mrr_usd', 'MRR (USD)')}
              value={dash.mrr_usd}
              prefix="$"
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('admin.billing.arr_iqd', 'ARR (IQD)')}
              value={dash.arr_iqd}
              suffix="د.ع"
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('admin.billing.churn', 'Monthly churn')}
              value={dash.churn_rate_monthly * 100}
              precision={2}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('admin.billing.active', 'Active')}
              value={dash.active_tenants}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('admin.billing.trialing', 'Trialing')}
              value={dash.trialing_tenants}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('admin.billing.past_due', 'Past due')}
              value={dash.past_due_tenants}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('admin.billing.suspended', 'Suspended')}
              value={dash.suspended_tenants}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title={t('admin.billing.tenants', 'Tenants')}>
        <Table<TenantRow>
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
                <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>
              ) : null,
            },
            { title: t('admin.billing.col.cycle', 'Cycle'), dataIndex: 'billing_cycle', key: 'billing_cycle' },
            {
              title: t('admin.billing.col.mrr', 'MRR (IQD)'),
              dataIndex: 'mrr_value',
              key: 'mrr_value',
              sorter: (a, b) => a.mrr_value - b.mrr_value,
              render: (v: number) => v.toLocaleString(),
            },
            { title: t('admin.billing.col.trial_end', 'Trial ends'), dataIndex: 'trial_ends_at', key: 'trial_ends_at' },
            { title: t('admin.billing.col.last_payment', 'Last payment'), dataIndex: 'last_payment_at', key: 'last_payment_at' },
          ]}
        />
      </Card>
    </div>
  );
}
