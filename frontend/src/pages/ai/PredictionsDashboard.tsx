/**
 * PredictionsDashboard — surfaces the new `/api/ai/inventory/*` and
 * `/api/ai/predict/*` forecasting layer.
 *
 * Like the AI / analytics layers, every prediction endpoint answers HTTP 200
 * with a `status` discriminator instead of an error status, so the page never
 * sees a thrown response for a "not provisioned" case:
 *
 *   - "ok"                       → data present, render it.
 *   - "warehouse_not_configured" → the analytics store is not provisioned.
 *   - "insufficient_data"        → not enough history to forecast.
 *   - "error"                    → a soft backend error.
 *
 * Each section owns its own loading/empty/error state and **soft-fails
 * independently** — one section being off (warehouse disabled, not enough
 * history, network down) never blocks or crashes the rest of the page.
 * Network-level failures (404/offline) are folded into a soft
 * "warehouse_not_configured" via `isBackendUnavailableError`, matching
 * AnalyticsDashboard and AIInsightsDashboard.
 *
 * Styling is token-only (theme/tokens.ts) and RTL-safe (logical properties);
 * chart colours come from the `palette` / `dataViz` token palettes — no
 * hardcoded colours/spacing — mirroring AnalyticsDashboard.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Space } from 'antd';
import {
  ReloadOutlined,
  ShoppingCartOutlined,
  HourglassOutlined,
  LineChartOutlined,
  GoldOutlined,
  DeleteOutlined,
  FundOutlined,
  ScheduleOutlined,
  ApiOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';

import api, { isBackendUnavailableError } from '../../api';
import {
  PageHeader,
  SectionCard,
  ChartCard,
  StatusTag,
  EmptyState,
  LoadingSkeleton,
} from '../../design-system';
import type { StatusKind } from '../../design-system';
import { ResponsiveChart } from '../../components/responsive/ResponsiveChart';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { palette, radius, shadow, space } from '../../theme/tokens';
import { asTranslationKey } from '../../i18n/types';

// ─── API contract types (mirror backend /api/ai/inventory + /api/ai/predict) ──

/** Shared status discriminator returned by every prediction endpoint. */
type PredictStatus =
  | 'ok'
  | 'warehouse_not_configured'
  | 'insufficient_data'
  | 'error'
  | string;

interface DemandRow {
  item_id: string;
  description: string;
  forecast_qty: number;
  period: string;
}

interface ReorderRow {
  item_id: string;
  name: string;
  stock_on_hand: number;
  reorder_point: number;
  monthly_demand: number;
  suggested_qty: number;
  urgency: string;
}

interface StockoutRow {
  item_id: string;
  name: string;
  stock_on_hand: number;
  daily_rate: number;
  days_until_stockout: number;
  predicted_stockout_date: string;
}

interface AbcRow {
  item_id: string;
  name: string;
  revenue: number;
  abc_class: string;
}

interface DeadStockRow {
  item_id: string;
  name: string;
  stock_on_hand: number;
  value: number;
  last_sold: string | null;
}

interface MarginRow {
  period: string;
  revenue: number;
  expense: number;
  margin: number;
}

interface ExpensePoint {
  period: string;
  forecast: number;
  lower: number;
  upper: number;
}

interface PaymentDateRow {
  invoice_id: string;
  customer: string;
  balance_due: number;
  predicted_payment_date: string;
  days_overdue: number;
}

/** `{ rows, status }` shaped response (most endpoints). */
interface RowsResponse<T> {
  rows: T[];
  status: PredictStatus;
}

/** `{ points, status }` shaped response (expense forecast). */
interface PointsResponse<T> {
  points: T[];
  status: PredictStatus;
}

/** Per-section fetch outcome: rows + the resolved status + loading flag. */
interface SectionState<T> {
  rows: T[];
  status: PredictStatus;
  loading: boolean;
}

const idleSection = <T,>(): SectionState<T> => ({ rows: [], status: 'ok', loading: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

const numberFmt = new Intl.NumberFormat('en-US');
const fmtNum = (v: number): string => numberFmt.format(Math.round(v || 0));
const fmtIQD = (v: number): string => numberFmt.format(Math.round(v || 0));
const date10 = (v: string | null | undefined): string => (v ? String(v).slice(0, 10) : '—');

/** A status that means "this surface is intentionally off / unavailable". */
function isOffStatus(status: PredictStatus): boolean {
  return status === 'warehouse_not_configured' || status === 'error';
}

/** Map a reorder urgency word to a StatusTag kind (semantic, never color-only). */
function urgencyKind(urgency: string): StatusKind {
  const u = (urgency || '').toLowerCase();
  if (u.includes('critical') || u.includes('high') || u.includes('بەرز') || u.includes('گرنگ')) return 'error';
  if (u.includes('medium') || u.includes('mid') || u.includes('soon') || u.includes('ناوەند')) return 'warning';
  if (u.includes('low') || u.includes('ok') || u.includes('نزم')) return 'success';
  return 'info';
}

/** Map an ABC class letter to a StatusTag kind. */
function abcKind(cls: string): StatusKind {
  const c = (cls || '').trim().toUpperCase();
  if (c === 'A') return 'success';
  if (c === 'B') return 'info';
  if (c === 'C') return 'warning';
  return 'default';
}

// ─── Page ────────────────────────────────────────────────────────────────────

const PredictionsDashboard: React.FC = () => {
  const { t } = useTranslation();

  const [reorder, setReorder] = useState<SectionState<ReorderRow>>(idleSection<ReorderRow>());
  const [stockout, setStockout] = useState<SectionState<StockoutRow>>(idleSection<StockoutRow>());
  const [demand, setDemand] = useState<SectionState<DemandRow>>(idleSection<DemandRow>());
  const [abc, setAbc] = useState<SectionState<AbcRow>>(idleSection<AbcRow>());
  const [deadStock, setDeadStock] = useState<SectionState<DeadStockRow>>(idleSection<DeadStockRow>());
  const [margin, setMargin] = useState<SectionState<MarginRow>>(idleSection<MarginRow>());
  const [expense, setExpense] = useState<SectionState<ExpensePoint>>(idleSection<ExpensePoint>());
  const [payments, setPayments] = useState<SectionState<PaymentDateRow>>(idleSection<PaymentDateRow>());

  // ─── Generic loader for a `{ rows, status }` GET endpoint ──────────────────
  const loadRows = useCallback(
    async <T,>(
      path: string,
      signal: AbortSignal,
      setState: React.Dispatch<React.SetStateAction<SectionState<T>>>,
    ): Promise<void> => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await api.get(path, { signal });
        const data = res.data as RowsResponse<T>;
        if (signal.aborted) return;
        setState({
          rows: Array.isArray(data?.rows) ? data.rows : [],
          status: data?.status ?? 'ok',
          loading: false,
        });
      } catch (err) {
        if (signal.aborted) return;
        // A missing endpoint / offline backend is a soft "not enabled" signal.
        if (isBackendUnavailableError(err)) {
          setState({ rows: [], status: 'warehouse_not_configured', loading: false });
          return;
        }
        setState({ rows: [], status: 'error', loading: false });
      }
    },
    [],
  );

  // ─── Loader for the `{ points, status }` expense-forecast endpoint ─────────
  const loadExpense = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      setExpense((s) => ({ ...s, loading: true }));
      try {
        const res = await api.get('/api/ai/predict/expenses', {
          params: { periods: 6 },
          signal,
        });
        const data = res.data as PointsResponse<ExpensePoint>;
        if (signal.aborted) return;
        setExpense({
          rows: Array.isArray(data?.points) ? data.points : [],
          status: data?.status ?? 'ok',
          loading: false,
        });
      } catch (err) {
        if (signal.aborted) return;
        if (isBackendUnavailableError(err)) {
          setExpense({ rows: [], status: 'warehouse_not_configured', loading: false });
          return;
        }
        setExpense({ rows: [], status: 'error', loading: false });
      }
    },
    [],
  );

  const loadAll = useCallback(
    (signal: AbortSignal) => {
      void loadRows<ReorderRow>('/api/ai/inventory/reorder', signal, setReorder);
      void loadRows<StockoutRow>('/api/ai/inventory/stockout', signal, setStockout);
      void loadRows<DemandRow>('/api/ai/inventory/demand-forecast?periods=3', signal, setDemand);
      void loadRows<AbcRow>('/api/ai/inventory/abc', signal, setAbc);
      void loadRows<DeadStockRow>('/api/ai/inventory/dead-stock', signal, setDeadStock);
      void loadRows<MarginRow>('/api/ai/predict/margin?periods=6', signal, setMargin);
      void loadExpense(signal);
      void loadRows<PaymentDateRow>('/api/ai/predict/payment-dates', signal, setPayments);
    },
    [loadRows, loadExpense],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAll(controller.signal);
    return () => controller.abort();
  }, [loadAll]);

  const reload = useCallback(() => {
    const controller = new AbortController();
    loadAll(controller.signal);
  }, [loadAll]);

  const anyLoading =
    reorder.loading ||
    stockout.loading ||
    demand.loading ||
    abc.loading ||
    deadStock.loading ||
    margin.loading ||
    expense.loading ||
    payments.loading;

  // ─── Margin chart rows (revenue / expense / margin lines over periods) ─────
  const marginChartData = useMemo(
    () =>
      margin.rows.map((r) => ({
        period: r.period,
        revenue: Number(r.revenue) || 0,
        expense: Number(r.expense) || 0,
        margin: Number(r.margin) || 0,
      })),
    [margin.rows],
  );

  // ─── Expense forecast band rows (lower transparent base + band thickness) ──
  const expenseChartData = useMemo(
    () =>
      expense.rows.map((p) => ({
        period: p.period,
        forecast: Number(p.forecast) || 0,
        lower: Number(p.lower) || 0,
        band: Math.max(0, (Number(p.upper) || 0) - (Number(p.lower) || 0)),
        upper: Number(p.upper) || 0,
      })),
    [expense.rows],
  );

  const tooltipMoneyFormatter = (value: number): [string, string] => [`${fmtIQD(value)} IQD`, ''];

  // Shared cell renderers (token-only, RTL-safe, tabular numerals for money/qty)
  const renderName = (v: string) => (
    <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v || '—'}</span>
  );
  const renderNum = (v: number) => (
    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontVariantNumeric: 'tabular-nums' }}>
      {fmtNum(v)}
    </span>
  );
  const renderMoney = (v: number) => (
    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      {fmtIQD(v)}
    </span>
  );
  const renderDate = (v: string | null) => (
    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>
      {date10(v)}
    </span>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title={t('predictions.title', 'پێشبینییەکان')}
        subtitle={t('predictions.subtitle', 'پێشنیاری دووبارە داواکردن، پێشبینی تەواوبوونی کاڵا، داواکاری، شیکاری ABC، کاڵای مردوو و پێشبینی داهات و قازانج')}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={reload} loading={anyLoading}>
              {t('refresh', 'نوێکردنەوە')}
            </Button>
          </Space>
        }
      />

      {/* ── 📦 Reorder suggestions (headline list) ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <SectionCard
          title={
            <Space size={8}>
              <ShoppingCartOutlined />
              {t('predictions.reorderTitle', 'پێشنیاری دووبارە داواکردن')}
            </Space>
          }
          subtitle={t('predictions.reorderSubtitle', 'کاڵاکانی نزیک لە تەواوبوون کە پێویستە دووبارە داوا بکرێن')}
          padded={false}
        >
          {reorder.loading ? (
            <div style={{ padding: space.lg }}>
              <LoadingSkeleton variant="table" rows={5} />
            </div>
          ) : isOffStatus(reorder.status) ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('predictions.warehouseOff', 'کۆگای ئامار هێشتا چالاک نەکراوە')}
              description={t('predictions.warehouseOffDesc', 'ئەم بەشە پێویستی بە کۆگای ئامارە. دوای چالاککردنی، پێشبینییەکان لێرە دەردەکەون.')}
            />
          ) : reorder.status === 'insufficient_data' ? (
            <EmptyState
              icon={<FundOutlined />}
              title={t('predictions.insufficient', 'داتای پێشبینی پێویست نییە')}
              description={t('predictions.insufficientDesc', 'بۆ پێشبینی، پێویست بە مێژووی فرۆشتن و کۆگای زیاترە.')}
            />
          ) : reorder.rows.length === 0 ? (
            <EmptyState
              icon={<ShoppingCartOutlined />}
              title={t('predictions.reorderEmpty', 'هیچ کاڵایەک پێویستی بە دووبارە داواکردن نییە')}
              description={t('predictions.reorderEmptyDesc', 'هەموو کاڵاکان لە ئاستی تەندروستن. کاتێک ئاستی کۆگا دادەبەزێت، پێشنیارەکان لێرە دەردەکەون.')}
            />
          ) : (
            <ResponsiveTableAdapter
              rowKey={(r: ReorderRow, i?: number) => `${r.item_id}-${i}`}
              dataSource={reorder.rows}
              pagination={reorder.rows.length > 10 ? { pageSize: 10 } : false}
              columns={[
                { title: t('predictions.item', 'کاڵا'), dataIndex: 'name', key: 'name', render: renderName },
                {
                  title: t('predictions.urgency', 'پەلەیی'),
                  dataIndex: 'urgency',
                  key: 'urgency',
                  render: (v: string) => <StatusTag status={urgencyKind(v)} label={v || '—'} />,
                },
                { title: t('predictions.stockOnHand', 'کۆگای بەردەست'), dataIndex: 'stock_on_hand', key: 'stock_on_hand', align: 'end' as const, render: renderNum },
                { title: t('predictions.reorderPoint', 'خاڵی دووبارە داواکردن'), dataIndex: 'reorder_point', key: 'reorder_point', align: 'end' as const, render: renderNum },
                { title: t('predictions.monthlyDemand', 'داواکاری مانگانە'), dataIndex: 'monthly_demand', key: 'monthly_demand', align: 'end' as const, render: renderNum },
                {
                  title: t('predictions.suggestedQty', 'بڕی پێشنیارکراو'),
                  dataIndex: 'suggested_qty',
                  key: 'suggested_qty',
                  align: 'end' as const,
                  render: renderMoney,
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {/* ── ⏳ Stockout predictions ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <SectionCard
          title={
            <Space size={8}>
              <HourglassOutlined />
              {t('predictions.stockoutTitle', 'پێشبینی تەواوبوونی کاڵا')}
            </Space>
          }
          subtitle={t('predictions.stockoutSubtitle', 'کاتی خەمڵێنراوی تەواوبوونی هەر کاڵایەک بەپێی ڕێژەی فرۆشتنی ڕۆژانە')}
          padded={false}
        >
          {stockout.loading ? (
            <div style={{ padding: space.lg }}>
              <LoadingSkeleton variant="table" rows={5} />
            </div>
          ) : isOffStatus(stockout.status) ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('predictions.warehouseOff', 'کۆگای ئامار هێشتا چالاک نەکراوە')}
              description={t('predictions.warehouseOffDesc', 'ئەم بەشە پێویستی بە کۆگای ئامارە. دوای چالاککردنی، پێشبینییەکان لێرە دەردەکەون.')}
            />
          ) : stockout.status === 'insufficient_data' ? (
            <EmptyState
              icon={<FundOutlined />}
              title={t('predictions.insufficient', 'داتای پێشبینی پێویست نییە')}
              description={t('predictions.insufficientDesc', 'بۆ پێشبینی، پێویست بە مێژووی فرۆشتن و کۆگای زیاترە.')}
            />
          ) : stockout.rows.length === 0 ? (
            <EmptyState
              icon={<HourglassOutlined />}
              title={t('predictions.stockoutEmpty', 'هیچ کاڵایەک لە مەترسی تەواوبووندا نییە')}
              description={t('predictions.stockoutEmptyDesc', 'هیچ کاڵایەک لە ئێستادا ڕووبەڕووی تەواوبوونی خێرا نابێتەوە.')}
            />
          ) : (
            <ResponsiveTableAdapter
              rowKey={(r: StockoutRow, i?: number) => `${r.item_id}-${i}`}
              dataSource={stockout.rows}
              pagination={stockout.rows.length > 10 ? { pageSize: 10 } : false}
              columns={[
                { title: t('predictions.item', 'کاڵا'), dataIndex: 'name', key: 'name', render: renderName },
                { title: t('predictions.stockOnHand', 'کۆگای بەردەست'), dataIndex: 'stock_on_hand', key: 'stock_on_hand', align: 'end' as const, render: renderNum },
                { title: t('predictions.dailyRate', 'ڕێژەی ڕۆژانە'), dataIndex: 'daily_rate', key: 'daily_rate', align: 'end' as const, render: renderNum },
                {
                  title: t('predictions.daysUntilStockout', 'ڕۆژ تا تەواوبوون'),
                  dataIndex: 'days_until_stockout',
                  key: 'days_until_stockout',
                  align: 'end' as const,
                  // Red StatusTag when stockout is imminent (< 14 days).
                  render: (v: number) => {
                    const d = Number(v) || 0;
                    const kind: StatusKind = d < 14 ? 'error' : d < 30 ? 'warning' : 'success';
                    return <StatusTag status={kind} label={fmtNum(d)} />;
                  },
                },
                {
                  title: t('predictions.predictedStockoutDate', 'بەرواری خەمڵێنراو'),
                  dataIndex: 'predicted_stockout_date',
                  key: 'predicted_stockout_date',
                  render: renderDate,
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {/* ── 📈 Demand forecast ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <SectionCard
          title={
            <Space size={8}>
              <LineChartOutlined />
              {t('predictions.demandTitle', 'پێشبینی داواکاری')}
            </Space>
          }
          subtitle={t('predictions.demandSubtitle', 'بڕی خەمڵێنراوی داواکاری بۆ هەر کاڵایەک لە ماوەکانی داهاتوودا')}
          padded={false}
        >
          {demand.loading ? (
            <div style={{ padding: space.lg }}>
              <LoadingSkeleton variant="table" rows={5} />
            </div>
          ) : isOffStatus(demand.status) ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('predictions.warehouseOff', 'کۆگای ئامار هێشتا چالاک نەکراوە')}
              description={t('predictions.warehouseOffDesc', 'ئەم بەشە پێویستی بە کۆگای ئامارە. دوای چالاککردنی، پێشبینییەکان لێرە دەردەکەون.')}
            />
          ) : demand.status === 'insufficient_data' ? (
            <EmptyState
              icon={<FundOutlined />}
              title={t('predictions.insufficient', 'داتای پێشبینی پێویست نییە')}
              description={t('predictions.insufficientDesc', 'بۆ پێشبینی، پێویست بە مێژووی فرۆشتن و کۆگای زیاترە.')}
            />
          ) : demand.rows.length === 0 ? (
            <EmptyState
              icon={<LineChartOutlined />}
              title={t('predictions.demandEmpty', 'هیچ پێشبینییەکی داواکاری نییە')}
              description={t('predictions.demandEmptyDesc', 'کاتێک مێژووی فرۆشتن کۆدەبێتەوە، پێشبینی داواکاری لێرە دەردەکەوێت.')}
            />
          ) : (
            <ResponsiveTableAdapter
              rowKey={(r: DemandRow, i?: number) => `${r.item_id}-${r.period}-${i}`}
              dataSource={demand.rows}
              pagination={demand.rows.length > 10 ? { pageSize: 10 } : false}
              columns={[
                { title: t('predictions.item', 'کاڵا'), dataIndex: 'description', key: 'description', render: renderName },
                {
                  title: t('predictions.period', 'ماوە'),
                  dataIndex: 'period',
                  key: 'period',
                  render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
                },
                {
                  title: t('predictions.forecastQty', 'بڕی پێشبینیکراو'),
                  dataIndex: 'forecast_qty',
                  key: 'forecast_qty',
                  align: 'end' as const,
                  render: renderMoney,
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {/* ── 🅰️ ABC analysis ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <SectionCard
          title={
            <Space size={8}>
              <GoldOutlined />
              {t('predictions.abcTitle', 'شیکاری ABC')}
            </Space>
          }
          subtitle={t('predictions.abcSubtitle', 'پۆلێنکردنی کاڵاکان بەپێی بەشدارییان لە داهات (A لە هەمووی گرنگتر)')}
          padded={false}
        >
          {abc.loading ? (
            <div style={{ padding: space.lg }}>
              <LoadingSkeleton variant="table" rows={5} />
            </div>
          ) : isOffStatus(abc.status) ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('predictions.warehouseOff', 'کۆگای ئامار هێشتا چالاک نەکراوە')}
              description={t('predictions.warehouseOffDesc', 'ئەم بەشە پێویستی بە کۆگای ئامارە. دوای چالاککردنی، پێشبینییەکان لێرە دەردەکەون.')}
            />
          ) : abc.status === 'insufficient_data' ? (
            <EmptyState
              icon={<FundOutlined />}
              title={t('predictions.insufficient', 'داتای پێشبینی پێویست نییە')}
              description={t('predictions.insufficientDesc', 'بۆ پێشبینی، پێویست بە مێژووی فرۆشتن و کۆگای زیاترە.')}
            />
          ) : abc.rows.length === 0 ? (
            <EmptyState
              icon={<GoldOutlined />}
              title={t('predictions.abcEmpty', 'هیچ داتایەکی شیکاری ABC نییە')}
              description={t('predictions.abcEmptyDesc', 'کاتێک داتای داهاتی کاڵا کۆدەبێتەوە، پۆلێنی ABC لێرە دەردەکەوێت.')}
            />
          ) : (
            <ResponsiveTableAdapter
              rowKey={(r: AbcRow, i?: number) => `${r.item_id}-${i}`}
              dataSource={abc.rows}
              pagination={abc.rows.length > 10 ? { pageSize: 10 } : false}
              columns={[
                { title: t('predictions.item', 'کاڵا'), dataIndex: 'name', key: 'name', render: renderName },
                {
                  title: t('predictions.abcClass', 'پۆل'),
                  dataIndex: 'abc_class',
                  key: 'abc_class',
                  render: (v: string) => <StatusTag status={abcKind(v)} label={v || '—'} />,
                },
                {
                  title: t('predictions.revenue', 'داهات'),
                  dataIndex: 'revenue',
                  key: 'revenue',
                  align: 'end' as const,
                  render: renderMoney,
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {/* ── 🪦 Dead stock ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <SectionCard
          title={
            <Space size={8}>
              <DeleteOutlined />
              {t('predictions.deadStockTitle', 'کاڵای مردوو')}
            </Space>
          }
          subtitle={t('predictions.deadStockSubtitle', 'کاڵا کۆگاکراوەکان کە ماوەیەکی درێژە نەفرۆشراون')}
          padded={false}
        >
          {deadStock.loading ? (
            <div style={{ padding: space.lg }}>
              <LoadingSkeleton variant="table" rows={5} />
            </div>
          ) : isOffStatus(deadStock.status) ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('predictions.warehouseOff', 'کۆگای ئامار هێشتا چالاک نەکراوە')}
              description={t('predictions.warehouseOffDesc', 'ئەم بەشە پێویستی بە کۆگای ئامارە. دوای چالاککردنی، پێشبینییەکان لێرە دەردەکەون.')}
            />
          ) : deadStock.status === 'insufficient_data' ? (
            <EmptyState
              icon={<FundOutlined />}
              title={t('predictions.insufficient', 'داتای پێشبینی پێویست نییە')}
              description={t('predictions.insufficientDesc', 'بۆ پێشبینی، پێویست بە مێژووی فرۆشتن و کۆگای زیاترە.')}
            />
          ) : deadStock.rows.length === 0 ? (
            <EmptyState
              icon={<InboxOutlined />}
              title={t('predictions.deadStockEmpty', 'هیچ کاڵایەکی مردوو نییە')}
              description={t('predictions.deadStockEmptyDesc', 'هەموو کاڵاکانت لە سووڕانەوەدان — هیچ کۆگایەکی بێجووڵە نییە.')}
            />
          ) : (
            <ResponsiveTableAdapter
              rowKey={(r: DeadStockRow, i?: number) => `${r.item_id}-${i}`}
              dataSource={deadStock.rows}
              pagination={deadStock.rows.length > 10 ? { pageSize: 10 } : false}
              columns={[
                { title: t('predictions.item', 'کاڵا'), dataIndex: 'name', key: 'name', render: renderName },
                { title: t('predictions.stockOnHand', 'کۆگای بەردەست'), dataIndex: 'stock_on_hand', key: 'stock_on_hand', align: 'end' as const, render: renderNum },
                {
                  title: t('predictions.value', 'نرخ'),
                  dataIndex: 'value',
                  key: 'value',
                  align: 'end' as const,
                  render: renderMoney,
                },
                {
                  title: t('predictions.lastSold', 'دواهەمین فرۆشتن'),
                  dataIndex: 'last_sold',
                  key: 'last_sold',
                  render: renderDate,
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {/* ── 💸 Margin forecast (revenue / expense / margin lines) ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <ChartCard
          title={t('predictions.marginTitle', 'پێشبینی داهات و قازانج')}
          subtitle={t('predictions.marginSubtitle', 'داهات، خەرجی و قازانج بەسەر ماوەکانی پێشبینیدا')}
          loading={margin.loading}
          height={300}
        >
          {isOffStatus(margin.status) ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('predictions.warehouseOff', 'کۆگای ئامار هێشتا چالاک نەکراوە')}
              description={t('predictions.warehouseOffDesc', 'ئەم بەشە پێویستی بە کۆگای ئامارە. دوای چالاککردنی، پێشبینییەکان لێرە دەردەکەون.')}
            />
          ) : margin.status === 'insufficient_data' ? (
            <EmptyState
              icon={<FundOutlined />}
              title={t('predictions.insufficient', 'داتای پێشبینی پێویست نییە')}
              description={t('predictions.insufficientDesc', 'بۆ پێشبینی، پێویست بە مێژووی فرۆشتن و کۆگای زیاترە.')}
            />
          ) : marginChartData.length === 0 ? (
            <EmptyState
              icon={<FundOutlined />}
              title={t('predictions.marginEmpty', 'هیچ پێشبینییەکی قازانج نییە')}
              description={t('predictions.marginEmptyDesc', 'کاتێک مێژووی داهات و خەرجی کۆدەبێتەوە، پێشبینی قازانج لێرە دەردەکەوێت.')}
            />
          ) : (
            <ResponsiveChart
              legendItems={[
                { id: 'revenue', labelKey: asTranslationKey('predictions.revenue'), color: palette.primary500 },
                { id: 'expense', labelKey: asTranslationKey('predictions.expense'), color: palette.warning500 },
                { id: 'margin', labelKey: asTranslationKey('predictions.margin'), color: palette.success500 },
              ]}
              minMobileBlockSize={260}
            >
              <ComposedChart data={marginChartData}>
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
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={palette.primary500}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name={t('predictions.revenue', 'داهات')}
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  stroke={palette.warning500}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name={t('predictions.expense', 'خەرجی')}
                />
                <Line
                  type="monotone"
                  dataKey="margin"
                  stroke={palette.success500}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name={t('predictions.margin', 'قازانج')}
                />
              </ComposedChart>
            </ResponsiveChart>
          )}
        </ChartCard>
      </div>

      {/* ── 💸 Expense forecast (with confidence band) ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <ChartCard
          title={t('predictions.expenseTitle', 'پێشبینی خەرجی')}
          subtitle={t('predictions.expenseSubtitle', 'پێشبینی خەرجی لەگەڵ مەودای متمانە')}
          loading={expense.loading}
          height={280}
        >
          {isOffStatus(expense.status) ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('predictions.warehouseOff', 'کۆگای ئامار هێشتا چالاک نەکراوە')}
              description={t('predictions.warehouseOffDesc', 'ئەم بەشە پێویستی بە کۆگای ئامارە. دوای چالاککردنی، پێشبینییەکان لێرە دەردەکەون.')}
            />
          ) : expense.status === 'insufficient_data' ? (
            <EmptyState
              icon={<FundOutlined />}
              title={t('predictions.insufficient', 'داتای پێشبینی پێویست نییە')}
              description={t('predictions.insufficientDesc', 'بۆ پێشبینی، پێویست بە مێژووی خەرجی زیاترە.')}
            />
          ) : expenseChartData.length === 0 ? (
            <EmptyState
              icon={<FundOutlined />}
              title={t('predictions.expenseEmpty', 'هیچ پێشبینییەکی خەرجی نییە')}
              description={t('predictions.expenseEmptyDesc', 'کاتێک مێژووی خەرجی کۆدەبێتەوە، پێشبینی خەرجی لێرە دەردەکەوێت.')}
            />
          ) : (
            <ResponsiveChart
              legendItems={[
                { id: 'forecast', labelKey: asTranslationKey('predictions.expenseForecast'), color: palette.primary500 },
                { id: 'band', labelKey: asTranslationKey('predictions.confidenceBand'), color: palette.primary400 },
              ]}
              minMobileBlockSize={240}
            >
              <ComposedChart data={expenseChartData}>
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
                  name={t('predictions.lower', 'کەمترین')}
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey="band"
                  stackId="band"
                  stroke="none"
                  fill={palette.primary400}
                  fillOpacity={0.25}
                  isAnimationActive={false}
                  name={t('predictions.confidenceBand', 'مەودای متمانە')}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke={palette.primary500}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name={t('predictions.expenseForecast', 'پێشبینی خەرجی')}
                />
              </ComposedChart>
            </ResponsiveChart>
          )}
        </ChartCard>
      </div>

      {/* ── 📅 Payment-date predictions ── */}
      <SectionCard
        title={
          <Space size={8}>
            <ScheduleOutlined />
            {t('predictions.paymentsTitle', 'پێشبینی بەرواری پارەدان')}
          </Space>
        }
        subtitle={t('predictions.paymentsSubtitle', 'پسوڵە کراوەکان لەگەڵ بەرواری خەمڵێنراوی پارەدان و ڕۆژانی دواکەوتن')}
        padded={false}
      >
        {payments.loading ? (
          <div style={{ padding: space.lg }}>
            <LoadingSkeleton variant="table" rows={5} />
          </div>
        ) : isOffStatus(payments.status) ? (
          <EmptyState
            icon={<ApiOutlined />}
            title={t('predictions.warehouseOff', 'کۆگای ئامار هێشتا چالاک نەکراوە')}
            description={t('predictions.warehouseOffDesc', 'ئەم بەشە پێویستی بە کۆگای ئامارە. دوای چالاککردنی، پێشبینییەکان لێرە دەردەکەون.')}
          />
        ) : payments.status === 'insufficient_data' ? (
          <EmptyState
            icon={<FundOutlined />}
            title={t('predictions.insufficient', 'داتای پێشبینی پێویست نییە')}
            description={t('predictions.insufficientDesc', 'بۆ پێشبینی، پێویست بە مێژووی پارەدانی کڕیار زیاترە.')}
          />
        ) : payments.rows.length === 0 ? (
          <EmptyState
            icon={<ScheduleOutlined />}
            title={t('predictions.paymentsEmpty', 'هیچ پسوڵەیەکی کراوە نییە')}
            description={t('predictions.paymentsEmptyDesc', 'هیچ پسوڵەیەکی پارەنەدراو نییە کە پێشبینی بۆ بکرێت.')}
          />
        ) : (
          <ResponsiveTableAdapter
            rowKey={(r: PaymentDateRow, i?: number) => `${r.invoice_id}-${i}`}
            dataSource={payments.rows}
            pagination={payments.rows.length > 10 ? { pageSize: 10 } : false}
            columns={[
              { title: t('predictions.customer', 'کڕیار'), dataIndex: 'customer', key: 'customer', render: renderName },
              {
                title: t('predictions.balanceDue', 'بڕی ماوە'),
                dataIndex: 'balance_due',
                key: 'balance_due',
                align: 'end' as const,
                render: renderMoney,
              },
              {
                title: t('predictions.predictedPaymentDate', 'بەرواری خەمڵێنراوی پارەدان'),
                dataIndex: 'predicted_payment_date',
                key: 'predicted_payment_date',
                render: renderDate,
              },
              {
                title: t('predictions.daysOverdue', 'ڕۆژانی دواکەوتن'),
                dataIndex: 'days_overdue',
                key: 'days_overdue',
                align: 'end' as const,
                render: (v: number) => {
                  const d = Number(v) || 0;
                  const kind: StatusKind = d > 30 ? 'error' : d > 0 ? 'warning' : 'success';
                  return <StatusTag status={kind} label={fmtNum(d)} />;
                },
              },
            ]}
          />
        )}
      </SectionCard>
    </div>
  );
};

export default PredictionsDashboard;
