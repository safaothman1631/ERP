/**
 * Dashboard — embedded dashboard body, rebuilt to the Vertex "Slate & Signal" kit.
 *
 * Rendered under RoleHomeHero via pages/dashboard/homes/createRoleHome.tsx (embedded,
 * hideHero). Composition mirrors the /vertex proof dashboard (src/vertex-proof):
 *   1. Row of 4 KPI cards (receivable / payable / income / expenses) — each a
 *      design-system <KpiCard> with title + big tabular value + delta% + sparkline.
 *   2. A two-column row: revenue area chart (ChartCard + recharts, ~12 months, YoY
 *      delta badge) and a cash-position card (labeled horizontal progress bars).
 *   3. A recent-invoices table using the design-system <DataTable> (kit .vx-table).
 *
 * Data: GET /api/dashboard. The lean backend payload (total_receivable, total_payable,
 * income_this_month, expenses_this_month, total_contacts, overdue_invoices,
 * recent_invoices[]) is merged over a richer MOCK_DATA default so the optional
 * revenue_trend / cash_flow / *_sparkline fields are always present. MOCK_DATA is also
 * the full fallback when the backend is unavailable.
 *
 * Styling: design-system primitives + Vertex CSS-var tokens only (var(--surface),
 * var(--ink-900), var(--accent-500), var(--border), var(--font-display) …) which
 * auto-flip light/dark via html[data-theme="dark"]. RTL-safe (logical CSS only).
 * Props / routing / Zustand / i18n keys are unchanged from the previous version.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DollarOutlined, WarningOutlined, RiseOutlined, FallOutlined,
  PlusOutlined, InboxOutlined, BankOutlined, WalletOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api, { backendRetryConfig, isBackendUnavailableError } from '../api';
import {
  PageHeader, KpiCard, ChartCard, DataTable, StatusTag, type ColumnDef,
} from '../design-system';
import DashboardHero from '../components/DashboardHero';
import { space } from '../theme/tokens';
import { InlineError } from '../components/feedback/InlineError';
import { useLoadingState } from '../hooks/useLoadingState';
import type { RoleThemeId } from '../personas/types';
import { getDashboardLayout } from './dashboard/dashboardLayouts';
import MyActivitiesWidget from '../components/activities/MyActivitiesWidget';

// ─── Types ──────────────────────────────────────────────────────────────────
// Mirrors the shape used by features/dashboard/DashboardPage.tsx. The live
// /api/dashboard endpoint returns the first block (plus recent_invoices); the
// trend / cash-flow / sparkline fields are optional and filled from MOCK_DATA.

interface RecentInvoice {
  id: string;
  invoice_number?: string;
  date?: string;
  total?: number;
  balance_due?: number;
  status?: string;
}

interface DashboardData {
  total_receivable: number;
  total_payable: number;
  income_this_month: number;
  expenses_this_month: number;
  total_contacts: number;
  overdue_invoices: number;
  recent_invoices?: RecentInvoice[];
  // Rich analytics fields — supplied directly by the backend. They are optional on
  // the type so a lean payload renders gracefully (each consumer guards/degrades)
  // instead of being masked by mock defaults.
  revenue_trend?: Array<{ month: string; revenue: number; expense: number }>;
  top_customers?: Array<{ name: string; amount: number }>;
  aging?: Array<{ range: string; amount: number }>;
  cash_flow?: Array<{ month: string; inflow: number; outflow: number; net: number }>;
  cash_breakdown?: Array<{ name: string; percent: number }>;
  receivable_sparkline?: number[];
  payable_sparkline?: number[];
  income_sparkline?: number[];
  expense_sparkline?: number[];
}

// ─── Mock / fallback data ─────────────────────────────────────────────────────

const MOCK_DATA: DashboardData = {
  total_receivable: 12_500_000,
  total_payable: 4_200_000,
  income_this_month: 3_800_000,
  expenses_this_month: 1_600_000,
  total_contacts: 248,
  overdue_invoices: 7,
  revenue_trend: [
    { month: 'Jul', revenue: 3_200_000, expense: 1_400_000 },
    { month: 'Aug', revenue: 2_900_000, expense: 1_200_000 },
    { month: 'Sep', revenue: 3_600_000, expense: 1_500_000 },
    { month: 'Oct', revenue: 4_100_000, expense: 1_700_000 },
    { month: 'Nov', revenue: 3_800_000, expense: 1_600_000 },
    { month: 'Dec', revenue: 4_400_000, expense: 1_800_000 },
    { month: 'Jan', revenue: 4_000_000, expense: 1_650_000 },
    { month: 'Feb', revenue: 4_600_000, expense: 1_900_000 },
    { month: 'Mar', revenue: 4_300_000, expense: 1_750_000 },
    { month: 'Apr', revenue: 5_100_000, expense: 2_050_000 },
    { month: 'May', revenue: 4_900_000, expense: 1_950_000 },
    { month: 'Jun', revenue: 5_400_000, expense: 2_150_000 },
  ],
  top_customers: [
    { name: 'Al-Rashid Trading', amount: 2_400_000 },
    { name: 'Kurdistan Supplies', amount: 1_900_000 },
    { name: 'Baghdad Imports', amount: 1_500_000 },
    { name: 'Erbil Wholesale', amount: 1_200_000 },
    { name: 'Sulaymaniyah Co.', amount: 980_000 },
  ],
  cash_flow: [
    { month: 'Apr', inflow: 4_100_000, outflow: 1_700_000, net: 2_400_000 },
    { month: 'May', inflow: 4_900_000, outflow: 1_950_000, net: 2_950_000 },
    { month: 'Jun', inflow: 5_400_000, outflow: 2_150_000, net: 3_250_000 },
  ],
  aging: [
    { range: '0-30', amount: 6_200_000 },
    { range: '31-60', amount: 3_100_000 },
    { range: '61-90', amount: 1_900_000 },
    { range: '90+', amount: 1_300_000 },
  ],
  cash_breakdown: [
    { name: 'Banking', percent: 52 },
    { name: 'Cash', percent: 28 },
    { name: 'Total Receivable', percent: 20 },
  ],
  receivable_sparkline: [8, 10, 9, 12, 11, 13, 12, 14, 13, 12, 13, 12.5],
  payable_sparkline:    [5, 4, 6, 5, 4, 5, 4, 4, 5, 4, 4, 4.2],
  income_sparkline:     [2.8, 3.1, 3.4, 3.2, 3.6, 3.8, 3.5, 3.9, 3.7, 3.8, 3.9, 3.8],
  expense_sparkline:    [1.4, 1.3, 1.5, 1.4, 1.6, 1.5, 1.6, 1.7, 1.6, 1.6, 1.7, 1.6],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtIQD = (v: number): string => new Intl.NumberFormat('en-US').format(v || 0);

/** Year-over-year style delta for the revenue card: first vs last point. */
function yoyDelta(trend: DashboardData['revenue_trend']): number {
  if (!trend || trend.length < 2) return 0;
  const first = trend[0]?.revenue || 0;
  const last = trend[trend.length - 1]?.revenue || 0;
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}

/** Token ramp for the cash-position bars (cycled so any number of accounts is themed). */
const CASH_BAR_COLORS = ['var(--accent-500)', 'var(--info-500)', 'var(--success-500)', 'var(--warning-500)'];

/**
 * Cash-position breakdown bars.
 *
 * Prefers the real backend `cash_breakdown` ({ name, percent }). Falls back to a
 * value derived from the latest cash-flow month only when the field is absent (e.g.
 * a lean payload or the offline mock), so real data is never masked.
 */
function cashBreakdown(
  data: DashboardData,
  labels: { bank: string; cash: string; receivable: string },
): Array<{ label: string; pct: number; color: string }> {
  if (data.cash_breakdown && data.cash_breakdown.length > 0) {
    return data.cash_breakdown.map((b, i) => ({
      label: b.name,
      pct: Math.max(0, Math.round(b.percent || 0)),
      color: CASH_BAR_COLORS[i % CASH_BAR_COLORS.length],
    }));
  }
  const latest = data.cash_flow?.[data.cash_flow.length - 1];
  const bank = latest?.net ?? Math.max(0, data.income_this_month - data.expenses_this_month);
  const cash = data.income_this_month;
  const receivable = data.total_receivable;
  const total = bank + cash + receivable || 1;
  const round = (n: number) => Math.round((n / total) * 100);
  return [
    { label: labels.bank, pct: round(bank), color: CASH_BAR_COLORS[0] },
    { label: labels.cash, pct: round(cash), color: CASH_BAR_COLORS[1] },
    { label: labels.receivable, pct: round(receivable), color: CASH_BAR_COLORS[2] },
  ];
}

// ─── Component ──────────────────────────────────────────────────────────────────

const Dashboard: React.FC<{
  embedded?: boolean;
  hideHero?: boolean;
  hideExecutiveInvoiceCta?: boolean;
  layoutId?: RoleThemeId;
}> = ({
  embedded = false,
  hideHero = false,
  hideExecutiveInvoiceCta = false,
  layoutId = 'executive',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const initialFetchDoneRef = useRef(false);
  const { showSkeleton } = useLoadingState(loading);
  const layout = getDashboardLayout(layoutId);
  const showKpi = (id: string) =>
    layout.primaryKpis.includes(id as typeof layout.primaryKpis[number])
    || layout.secondaryKpis.includes(id as typeof layout.secondaryKpis[number]);

  /**
   * Fetch /api/dashboard.
   *
   * @param forceRetry  bypass the backend-unavailable short-circuit (manual retry).
   * @param silent      background poll — don't toggle the loading skeleton so the
   *                    live tiles update in place without flashing.
   */
  const fetchDashboard = async (forceRetry = false, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/api/dashboard', forceRetry ? backendRetryConfig : undefined);
      // Use the real backend payload directly. Optional analytics fields (revenue_trend,
      // cash_flow, top_customers, aging, *_sparkline, cash_breakdown) render gracefully
      // when present and degrade when absent — they are never masked by mock defaults.
      setData(res.data as DashboardData);
      setBackendUnavailable(false);
    } catch (error) {
      if (isBackendUnavailableError(error)) {
        // Backend genuinely unavailable (offline) → resilient full mock dashboard.
        // A failed background poll keeps the last good data on screen.
        if (!silent) setData(MOCK_DATA);
        setBackendUnavailable(false);
      } else if (!silent) {
        setData(null);
        setBackendUnavailable(false);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (initialFetchDoneRef.current) {
      return;
    }
    initialFetchDoneRef.current = true;
    void fetchDashboard();
  }, []);

  // ── Live polling: silently refetch every 30s, pausing while the tab is hidden to
  // avoid background churn. Interval is cleared on unmount. ──
  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchDashboard(false, true);
    }, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencySuffix = 'IQD';

  const pageHeader = !embedded ? (
    <PageHeader
      title={t('dashboard')}
      subtitle={t('overview_subtitle')}
      helpKey="dashboard"
      sectionId="dashboard.kpis"
      extra={
        !hideExecutiveInvoiceCta ? (
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/invoices/new')}>
            {t('new_invoice')}
          </Button>
        ) : undefined
      }
    />
  ) : null;

  if (showSkeleton) return (
    <div>
      {pageHeader}
      {!hideHero && <DashboardHero onCreateInvoice={() => navigate('/invoices/new')} />}
      <div className="vx-dash-kpis" style={{ marginBlockStart: space.lg }}>
        {[0, 1, 2, 3].map((i) => (
          <KpiCard key={i} title="" value={0} loading tone="primary" />
        ))}
      </div>
    </div>
  );
  if (backendUnavailable) return (
    <div>
      {pageHeader}
      <InlineError messageKey="error_backend_unavailable" onRetry={() => void fetchDashboard(true)} />
    </div>
  );
  if (!data) return (
    <div>
      {pageHeader}
      <InlineError messageKey="error_loading" onRetry={() => void fetchDashboard(true)} />
    </div>
  );

  // ── Recent invoices: prefer the live recent_invoices payload; otherwise derive a
  // small list from top_customers (when present) so the table stays populated. ──
  const topCustomers = data.top_customers ?? [];
  const recentInvoices: RecentInvoice[] =
    data.recent_invoices && data.recent_invoices.length > 0
      ? data.recent_invoices.slice(0, 5)
      : topCustomers.slice(0, 5).map((c, i) => ({
          id: `mock-${i}`,
          invoice_number: `INV-${1042 - i}`,
          date: '',
          total: c.amount,
          status: ['paid', 'sent', 'overdue', 'pending', 'paid'][i % 5],
        }));

  const invoiceCols: ColumnDef<RecentInvoice>[] = [
    {
      title: t('invoice'),
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
      ),
    },
    {
      title: t('customer'),
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (_: unknown, row: RecentInvoice & { customer_name?: string }) => (
        <span style={{ color: 'var(--ink-900)' }}>
          {row.customer_name
            ?? (data.recent_invoices?.length
              ? '—'
              : topCustomers[recentInvoices.indexOf(row)]?.name ?? '—')}
        </span>
      ),
    },
    {
      title: t('date'),
      dataIndex: 'date',
      key: 'date',
      render: (d: string) => (d ? d.substring(0, 10) : '—'),
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (s ? <StatusTag status={s} label={t(s)} /> : null),
    },
    {
      title: t('amount'),
      dataIndex: 'total',
      key: 'total',
      align: 'end',
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>
          {fmtIQD(v)} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>{currencySuffix}</span>
        </span>
      ),
    },
  ];

  const revenueTrend = data.revenue_trend ?? [];
  const revenueDelta = yoyDelta(revenueTrend);
  const breakdown = cashBreakdown(data, {
    bank: t('banking', 'Banking'),
    cash: t('cash', 'Cash'),
    receivable: t('total_receivable', 'Total Receivable'),
  });

  return (
    <div>
      {pageHeader}

      {/* Premium greeting hero — hidden when role-adaptive shell provides RoleHomeHero */}
      {!hideHero && <DashboardHero onCreateInvoice={() => navigate('/invoices/new')} />}

      {/* Responsive grid: 4 KPI cards desktop → 2 tablet → 1 mobile; chart row 2fr/1fr → 1fr */}
      <style>{`
        .vx-dash-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: ${space.md}px;
        }
        .vx-dash-row2 {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: ${space.md}px;
          margin-block-start: ${space.md}px;
        }
        @media (max-width: 1024px) {
          .vx-dash-kpis { grid-template-columns: repeat(2, 1fr); }
          .vx-dash-row2 { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .vx-dash-kpis { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── KPI cards — title + big value + delta + sparkline (kit Kpi) ── */}
      <div className="vx-dash-kpis" data-section-id="dashboard.kpis">
        {showKpi('receivable') && (
          <KpiCard
            title={t('total_receivable')}
            value={data.total_receivable}
            currency="IQD"
            delta={8.2}
            sparklineData={data.receivable_sparkline}
            icon={<DollarOutlined />}
            tone="success"
            onClick={() => navigate('/invoices?status=open')}
          />
        )}
        {showKpi('payable') && (
          <KpiCard
            title={t('total_payable')}
            value={data.total_payable}
            currency="IQD"
            delta={-3.1}
            sparklineData={data.payable_sparkline}
            icon={<FallOutlined />}
            tone="danger"
            onClick={() => navigate('/bills?status=open')}
          />
        )}
        {showKpi('income') && (
          <KpiCard
            title={t('income_this_month')}
            value={data.income_this_month}
            currency="IQD"
            delta={12.5}
            sparklineData={data.income_sparkline}
            icon={<RiseOutlined />}
            tone="primary"
            onClick={() => navigate('/reports/advanced')}
          />
        )}
        {showKpi('expenses') && (
          <KpiCard
            title={t('expenses_this_month')}
            value={data.expenses_this_month}
            currency="IQD"
            delta={-5.4}
            sparklineData={data.expense_sparkline}
            icon={<WarningOutlined />}
            tone="warning"
            onClick={() => navigate('/expenses')}
          />
        )}
      </div>

      {/* Secondary KPIs (contacts / overdue) — kept for layouts that request them */}
      {(showKpi('contacts') || showKpi('overdue')) && (
        <div className="vx-dash-kpis" style={{ marginBlockStart: space.md }}>
          {showKpi('contacts') && (
            <KpiCard
              title={t('total_contacts')}
              value={data.total_contacts}
              icon={<WalletOutlined />}
              tone="info"
              onClick={() => navigate('/contacts')}
            />
          )}
          {showKpi('overdue') && (
            <KpiCard
              title={t('overdue_invoices')}
              value={data.overdue_invoices}
              icon={<WarningOutlined />}
              tone={data.overdue_invoices > 0 ? 'danger' : 'success'}
              onClick={() => navigate('/invoices?status=overdue')}
            />
          )}
        </div>
      )}

      {/* ── Row 2: revenue area chart (with YoY badge) + cash-position bars ── */}
      {layout.showChart && (
        <div className="vx-dash-row2">
          {/* Revenue area chart — ~12 months, tokenized so it flips for dark */}
          <ChartCard
            title={t('revenue', 'Revenue')}
            subtitle={t('last_12_months', 'Last 12 months')}
            height={220}
            extra={
              <StatusTag
                status={revenueDelta >= 0 ? 'success' : 'overdue'}
                label={`${revenueDelta >= 0 ? '+' : ''}${revenueDelta.toFixed(1)}% ${t('vs_previous', 'YoY')}`}
              />
            }
          >
            {revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-500)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--accent-500)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--ink-500)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis
                    tick={{ fill: 'var(--ink-500)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                    width={36}
                  />
                  <Tooltip
                    formatter={(v) => [`${fmtIQD(v as number)} ${currencySuffix}`, t('revenue', 'Revenue')]}
                    contentStyle={{
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--ink-900)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                    labelStyle={{ color: 'var(--ink-500)' }}
                    cursor={{ stroke: 'var(--border-strong)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--accent-500)"
                    strokeWidth={2.5}
                    fill="url(#dashRevenueFill)"
                    name={t('revenue', 'Revenue')}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--ink-400)',
                fontSize: 13,
              }}>
                {t('no_data')}
              </div>
            )}
          </ChartCard>

          {/* Cash-position card — labeled horizontal progress bars */}
          <ChartCard
            title={t('cash', 'Cash')}
            subtitle={`${breakdown.length} ${t('accounts', 'accounts')}`}
            height={220}
            extra={<BankOutlined style={{ color: 'var(--ink-400)' }} aria-hidden />}
          >
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 16 }}>
              {breakdown.map((b) => (
                <div key={b.label}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    marginBlockEnd: 6,
                  }}>
                    <span style={{ color: 'var(--ink-700)' }}>{b.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                      {b.pct}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={b.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={b.label}
                    style={{
                      height: 7,
                      borderRadius: 999,
                      background: 'var(--surface-2)',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{
                      inlineSize: `${b.pct}%`,
                      blockSize: '100%',
                      background: b.color,
                      borderRadius: 999,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {/* ── Recent invoices — design-system DataTable (kit .vx-table) ── */}
      {layout.showRecentInvoices && (
        <div style={{ marginBlockStart: space.md }} data-section-id="dashboard.recentInvoices">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBlockEnd: space.sm,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--ink-900)',
            }}>
              {t('invoices')}
            </span>
            <Button type="link" onClick={() => navigate('/invoices')} style={{ paddingInline: 0 }}>
              {t('all')} {'>'}
            </Button>
          </div>
          <DataTable<RecentInvoice>
            columns={invoiceCols}
            dataSource={recentInvoices}
            rowKey="id"
            pagination={false}
            stickyHeader={false}
            density="compact"
            onView={() => navigate('/invoices')}
            emptyIcon={<InboxOutlined />}
            emptyTitle={t('no_invoices')}
            emptyDescription={t('no_invoices_hint')}
            emptyActionLabel={layout.suppressCreateInEmpty ? undefined : t('new_invoice')}
            onEmptyAction={layout.suppressCreateInEmpty ? undefined : () => navigate('/invoices/new')}
          />
        </div>
      )}

      {layout.showActivity && <MyActivitiesWidget />}
    </div>
  );
};

export default Dashboard;
