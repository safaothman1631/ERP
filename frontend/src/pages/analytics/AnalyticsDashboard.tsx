/**
 * AnalyticsDashboard — warehouse-backed analytics overview (Pool 4.6).
 *
 * Reads the new `/api/analytics` warehouse API:
 *   - POST /api/analytics/query           → KPI tiles + monthly revenue trend
 *   - GET  /api/analytics/forecast/revenue → forward-looking revenue forecast + band
 *
 * The warehouse is optional infrastructure. When it is not provisioned the
 * query endpoint answers from OLTP (`source: "oltp"`) or returns nothing, and
 * the forecast reports `status: "warehouse_not_configured"` /
 * `"insufficient_data"`. In every one of those cases the page degrades to a
 * friendly "not enabled yet" empty state instead of crashing.
 *
 * Styling is token-only (theme/tokens.ts) and RTL-safe (logical properties);
 * chart series colours come from the `palette` / `dataViz` token palettes,
 * never hardcoded hex — matching DashboardPage and the WMS/TMS module pages.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Space } from 'antd';
import {
  ReloadOutlined,
  DollarOutlined,
  FallOutlined,
  ShopOutlined,
  LineChartOutlined,
  FundOutlined,
} from '@ant-design/icons';
import {
  AreaChart,
  Area,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useTranslation } from 'react-i18next';

import api, { isBackendUnavailableError } from '../../api';
import {
  PageHeader,
  KpiCard,
  ChartCard,
  SectionCard,
  StatusTag,
  EmptyState,
} from '../../design-system';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { palette, radius, shadow, space, dataViz } from '../../theme/tokens';
import { asTranslationKey } from '../../i18n/types';

// ─── API contract types (mirror backend /api/analytics) ──────────────────────

type AnalyticsRow = Record<string, string | number | null>;

interface AnalyticsQueryResponse {
  rows: AnalyticsRow[];
  row_count: number;
  /** "warehouse" when served from the analytics store, "oltp" when degraded. */
  source: string;
}

interface ForecastPoint {
  period: string;
  forecast: number;
  lower: number;
  upper: number;
}

type ForecastStatus = 'ok' | 'insufficient_data' | 'warehouse_not_configured' | string;

interface ForecastResponse {
  points: ForecastPoint[];
  status: ForecastStatus;
}

interface AnalyticsQueryBody {
  fact: string;
  measures: string[];
  dimensions?: string[];
  filters?: Record<string, unknown>;
  date_from?: string;
  date_to?: string;
  order_by?: string;
  order_dir?: 'asc' | 'desc';
  limit?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const numberFmt = new Intl.NumberFormat('en-US');
const fmtIQD = (v: number): string => numberFmt.format(Math.round(v || 0));

/** Sum a measure column across all rows (used for single-value KPI queries). */
function sumMeasure(rows: AnalyticsRow[], key: string): number {
  return rows.reduce((acc, r) => acc + (typeof r[key] === 'number' ? (r[key] as number) : Number(r[key]) || 0), 0);
}

/** Month label like "2026-01" → keep as-is; charts read the raw dimension. */
interface TrendDatum {
  month: string;
  total: number;
}

/** A response is "degraded" (warehouse off) when it came from OLTP or is empty. */
function isDegraded(resp: AnalyticsQueryResponse | null): boolean {
  if (!resp) return true;
  return resp.source === 'oltp' || resp.row_count === 0;
}

// ─── Page ────────────────────────────────────────────────────────────────────

const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [invoiceTotal, setInvoiceTotal] = useState<number | null>(null);
  const [billTotal, setBillTotal] = useState<number | null>(null);
  const [posTotal, setPosTotal] = useState<number | null>(null);

  const [trend, setTrend] = useState<TrendDatum[]>([]);
  const [trendSource, setTrendSource] = useState<string>('warehouse');

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);

  /** True when the warehouse appears unprovisioned across the board. */
  const [warehouseOff, setWarehouseOff] = useState(false);

  const runQuery = useCallback(
    async (body: AnalyticsQueryBody, signal: AbortSignal): Promise<AnalyticsQueryResponse | null> => {
      try {
        const res = await api.post('/api/analytics/query', body, { signal });
        return res.data as AnalyticsQueryResponse;
      } catch (err) {
        if (signal.aborted) return null;
        // A missing warehouse endpoint (404 / 5xx / offline) is treated as a
        // soft "not enabled" signal rather than a hard page error.
        if (isBackendUnavailableError(err)) return null;
        // Re-throw genuine errors so the caller can surface a retry banner.
        throw err;
      }
    },
    [],
  );

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [invoiceRes, billRes, posRes, trendRes, forecastRes] = await Promise.all([
        runQuery({ fact: 'fact_invoices', measures: ['total'] }, signal),
        runQuery({ fact: 'fact_bills', measures: ['total'] }, signal),
        runQuery({ fact: 'fact_pos_orders', measures: ['total'] }, signal),
        runQuery(
          {
            fact: 'fact_invoices',
            measures: ['total'],
            dimensions: ['month'],
            order_by: 'month',
            order_dir: 'asc',
            limit: 24,
          },
          signal,
        ),
        (async (): Promise<ForecastResponse | null> => {
          try {
            const res = await api.get('/api/analytics/forecast/revenue', {
              params: { periods: 6 },
              signal,
            });
            return res.data as ForecastResponse;
          } catch (err) {
            if (signal.aborted) return null;
            if (isBackendUnavailableError(err)) {
              return { points: [], status: 'warehouse_not_configured' };
            }
            throw err;
          }
        })(),
      ]);

      if (signal.aborted) return;

      setInvoiceTotal(invoiceRes ? sumMeasure(invoiceRes.rows, 'total') : null);
      setBillTotal(billRes ? sumMeasure(billRes.rows, 'total') : null);
      setPosTotal(posRes ? sumMeasure(posRes.rows, 'total') : null);

      const trendRows: TrendDatum[] = (trendRes?.rows ?? []).map((r) => ({
        month: String(r.month ?? ''),
        total: typeof r.total === 'number' ? r.total : Number(r.total) || 0,
      }));
      setTrend(trendRows);
      setTrendSource(trendRes?.source ?? 'warehouse');

      setForecast(forecastRes);

      // The warehouse is considered "off" only when EVERY analytics surface is
      // degraded — partial data should still render rather than hide behind an
      // empty state.
      const allDegraded =
        isDegraded(invoiceRes) &&
        isDegraded(billRes) &&
        isDegraded(posRes) &&
        isDegraded(trendRes) &&
        (!forecastRes || forecastRes.status !== 'ok');
      setWarehouseOff(allDegraded);
    } catch {
      if (signal.aborted) return;
      setError(t('analytics.loadError', 'نەتوانرا ئامارەکان باربکرێن'));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [runQuery, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
  }, [load]);

  // ─── Forecast chart rows (band rendered as upper/lower areas) ──────────────
  const forecastChartData = useMemo(() => {
    const pts = forecast?.points ?? [];
    return pts.map((p) => ({
      period: p.period,
      forecast: p.forecast,
      lower: p.lower,
      // Stacked area trick: render `lower` (transparent) + the band thickness on
      // top so the visible band spans [lower, upper] without masking the line.
      band: Math.max(0, p.upper - p.lower),
      upper: p.upper,
    }));
  }, [forecast]);

  const forecastReady = (forecast?.status === 'ok') && forecastChartData.length > 0;

  const tooltipMoneyFormatter = (value: number): [string, string] => [`${fmtIQD(value)} IQD`, ''];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title={t('analytics.title', 'ئاماری کۆگا')}
        subtitle={t('analytics.subtitle', 'پوختەی داهات، پسوڵە و فرۆشتنی POS لەسەر بنکەی داتای ئامار')}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
              {t('refresh', 'نوێکردنەوە')}
            </Button>
          </Space>
        }
      />

      {/* Warehouse-not-enabled banner — shown when every surface is degraded */}
      {!loading && warehouseOff && (
        <div style={{ marginBlockEnd: space.lg }}>
          <SectionCard padded>
            <EmptyState
              icon={<FundOutlined />}
              title={t('analytics.notEnabledTitle', 'کۆگای ئامار هێشتا چالاک نەکراوە')}
              description={t(
                'analytics.notEnabledDesc',
                'ئەم پەڕەیە داتای خۆی لە کۆگای ئاماری (warehouse) وەردەگرێت. لە کاتی چالاکنەبوونیدا، پوختەکان لە داتای کارکردنی ڕاستەوخۆ پیشان دەدرێن یان بەتاڵ دەبن.',
              )}
            />
          </SectionCard>
        </div>
      )}

      {/* Degraded-data hint (data shown, but it is OLTP not the warehouse) */}
      {!loading && !warehouseOff && trendSource === 'oltp' && (
        <div style={{ marginBlockEnd: space.md }}>
          <StatusTag
            status="info"
            label={t('analytics.oltpFallback', 'داتا لە کۆگای ئامار نییە — لە سەرچاوەی ڕاستەوخۆوە')}
          />
        </div>
      )}

      {/* Error banner (non-blocking; data may still be partially shown) */}
      {error && (
        <div
          role="alert"
          style={{
            background: palette.dangerBg,
            border: `1px solid ${palette.danger}`,
            borderRadius: radius.md,
            paddingBlock: space.sm,
            paddingInline: space.lg,
            marginBlockEnd: space.lg,
            color: palette.danger,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space.md,
          }}
        >
          <span>{error}</span>
          <Button size="small" onClick={reload}>
            {t('retry', 'هەوڵدانەوە')}
          </Button>
        </div>
      )}

      {/* KPI tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: space.md,
          marginBlockEnd: space.lg,
        }}
      >
        <KpiCard
          title={t('analytics.totalRevenue', 'کۆی داهات')}
          value={invoiceTotal != null ? fmtIQD(invoiceTotal) : '—'}
          currency={invoiceTotal != null ? 'IQD' : undefined}
          icon={<DollarOutlined />}
          tone="success"
          loading={loading}
        />
        <KpiCard
          title={t('analytics.totalBills', 'کۆی پسوڵەکان')}
          value={billTotal != null ? fmtIQD(billTotal) : '—'}
          currency={billTotal != null ? 'IQD' : undefined}
          icon={<FallOutlined />}
          tone="warning"
          loading={loading}
        />
        <KpiCard
          title={t('analytics.posSales', 'فرۆشتنی POS')}
          value={posTotal != null ? fmtIQD(posTotal) : '—'}
          currency={posTotal != null ? 'IQD' : undefined}
          icon={<ShopOutlined />}
          tone="primary"
          loading={loading}
        />
      </div>

      {/* Revenue trend */}
      <div style={{ marginBlockEnd: space.lg }}>
        <ChartCard
          title={t('analytics.revenueTrend', 'ڕەوتی داهات')}
          subtitle={t('analytics.revenueTrendSub', 'کۆی داهات بەپێی مانگ')}
          loading={loading}
          height={260}
        >
          {trend.length === 0 ? (
            <EmptyState
              icon={<LineChartOutlined />}
              title={t('analytics.noTrend', 'هیچ داتایەکی ڕەوت نییە')}
              description={t('analytics.noTrendDesc', 'کاتێک داتای فرۆشتن کۆدەبێتەوە، ڕەوتی داهات لێرە دەردەکەوێت.')}
            />
          ) : (
            <ResponsiveChart
              legendItems={[
                { id: 'total', labelKey: asTranslationKey('analytics.totalRevenue'), color: palette.primary500 },
              ]}
              minMobileBlockSize={240}
            >
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="analyticsRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={palette.primary500} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={palette.primary500} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.ink100} />
                <XAxis dataKey="month" tick={{ fill: palette.ink500, fontSize: 11 }} />
                <YAxis
                  tick={{ fill: palette.ink500, fontSize: 11 }}
                  tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={tooltipMoneyFormatter}
                  contentStyle={{
                    borderRadius: radius.md,
                    border: `1px solid ${palette.border}`,
                    boxShadow: shadow.md,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={palette.primary500}
                  strokeWidth={2}
                  fill="url(#analyticsRevenue)"
                  name={t('analytics.totalRevenue', 'کۆی داهات')}
                />
              </AreaChart>
            </ResponsiveChart>
          )}
        </ChartCard>
      </div>

      {/* Revenue forecast */}
      <ChartCard
        title={t('analytics.forecastTitle', 'پێشبینی داهات')}
        subtitle={t('analytics.forecastSub', 'پێشبینی لەگەڵ مەودای متمانە')}
        loading={loading}
        height={280}
      >
        {!forecastReady ? (
          <EmptyState
            icon={<FundOutlined />}
            title={
              forecast?.status === 'insufficient_data'
                ? t('analytics.forecastInsufficient', 'داتای پێشبینی پێویست نییە')
                : t('analytics.forecastNotEnabled', 'کۆگای ئامار هێشتا چالاک نەکراوە')
            }
            description={
              forecast?.status === 'insufficient_data'
                ? t('analytics.forecastInsufficientDesc', 'بۆ پێشبینی، پێویست بە مێژووی فرۆشتنی زیاترە.')
                : t('analytics.forecastNotEnabledDesc', 'دوای چالاککردنی کۆگای ئامار، پێشبینی داهات لێرە دەردەکەوێت.')
            }
          />
        ) : (
          <>
            <ResponsiveChart
              legendItems={[
                { id: 'forecast', labelKey: asTranslationKey('analytics.forecast'), color: palette.primary500 },
                { id: 'band', labelKey: asTranslationKey('analytics.confidenceBand'), color: palette.primary400 },
              ]}
              minMobileBlockSize={240}
            >
              <ComposedChart data={forecastChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.ink100} />
                <XAxis dataKey="period" tick={{ fill: palette.ink500, fontSize: 11 }} />
                <YAxis
                  tick={{ fill: palette.ink500, fontSize: 11 }}
                  tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={tooltipMoneyFormatter}
                  contentStyle={{
                    borderRadius: radius.md,
                    border: `1px solid ${palette.border}`,
                    boxShadow: shadow.md,
                  }}
                />
                {/* Confidence band: invisible base at `lower`, visible band on top. */}
                <Area
                  type="monotone"
                  dataKey="lower"
                  stackId="band"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                  name={t('analytics.lower', 'کەمترین')}
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey="band"
                  stackId="band"
                  stroke="none"
                  fill={dataViz.sequential[2]}
                  fillOpacity={0.35}
                  isAnimationActive={false}
                  name={t('analytics.confidenceBand', 'مەودای متمانە')}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke={palette.primary500}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name={t('analytics.forecast', 'پێشبینی')}
                />
              </ComposedChart>
            </ResponsiveChart>

            <div style={{ marginBlockStart: space.lg }}>
              <SectionCard title={t('analytics.forecastDetail', 'وردەکاری پێشبینی')} padded={false}>
                <ResponsiveTableAdapter
                  rowKey="period"
                  dataSource={forecastChartData}
                  pagination={false}
                  columns={[
                    {
                      title: t('analytics.period', 'ماوە'),
                      dataIndex: 'period',
                      key: 'period',
                      render: (v: string) => (
                        <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
                      ),
                    },
                    {
                      title: t('analytics.forecast', 'پێشبینی'),
                      dataIndex: 'forecast',
                      key: 'forecast',
                      align: 'end' as const,
                      render: (v: number) => (
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtIQD(v)}
                        </span>
                      ),
                    },
                    {
                      title: t('analytics.lower', 'کەمترین'),
                      dataIndex: 'lower',
                      key: 'lower',
                      align: 'end' as const,
                      render: (v: number) => (
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-600)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtIQD(v)}
                        </span>
                      ),
                    },
                    {
                      title: t('analytics.upper', 'زۆرترین'),
                      dataIndex: 'upper',
                      key: 'upper',
                      align: 'end' as const,
                      render: (v: number) => (
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-600)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtIQD(v)}
                        </span>
                      ),
                    },
                  ]}
                />
              </SectionCard>
            </div>
          </>
        )}
      </ChartCard>
    </div>
  );
};

export default AnalyticsDashboard;
