/**
 * AIInsightsDashboard — surfaces the new `/api/ai/*` intelligence layer.
 *
 * The AI layer is optional infrastructure. Every endpoint answers HTTP 200 with
 * a `status` discriminator instead of an error status, so the page never sees a
 * thrown response for a "not configured" case:
 *
 *   - "ok"                       → data present, render it.
 *   - "warehouse_not_configured" → the analytics store is not provisioned.
 *   - "ai_not_configured"        → no Claude/LLM key is set on the backend.
 *   - "could_not_interpret"      → the natural-language question wasn't understood.
 *   - "error"                    → a soft backend error.
 *
 * Each section owns its loading/empty state and **soft-fails independently** —
 * one section being "off" (warehouse/AI disabled, network down) never blocks or
 * crashes the rest of the page. Network-level failures (404/offline) are treated
 * as a soft "not enabled" signal via `isBackendUnavailableError`, matching
 * AnalyticsDashboard.
 *
 * Styling is token-only (theme/tokens.ts) and RTL-safe (logical properties);
 * no hardcoded colours/spacing — mirroring AnalyticsDashboard, WmsPage and the
 * rest of the module pages.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Space } from 'antd';
import {
  ReloadOutlined,
  SendOutlined,
  RobotOutlined,
  BulbOutlined,
  TeamOutlined,
  WarningOutlined,
  AlertOutlined,
  ApiOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import api, { isBackendUnavailableError } from '../../api';
import {
  PageHeader,
  SectionCard,
  StatusTag,
  EmptyState,
  LoadingSkeleton,
} from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { space } from '../../theme/tokens';

// ─── API contract types (mirror backend /api/ai) ─────────────────────────────

/** Shared status discriminator returned by every AI endpoint. */
type AiStatus =
  | 'ok'
  | 'warehouse_not_configured'
  | 'ai_not_configured'
  | 'could_not_interpret'
  | 'error'
  | string;

type AskRow = Record<string, string | number | null>;

interface AskResponse {
  question: string;
  query: string | null;
  rows: AskRow[];
  status: AiStatus;
}

interface InsightsResponse {
  summary: string;
  status: AiStatus;
}

interface SegmentRow {
  customer: string;
  recency: number;
  frequency: number;
  monetary: number;
  segment: string;
}

interface ChurnRow {
  customer: string;
  days_since: number;
  risk: string;
}

interface AnomalyRow {
  id: string;
  date: string;
  amount: number;
  party: string;
  z_score: number;
  reason: string;
}

interface RowsResponse<T> {
  rows: T[];
  status: AiStatus;
}

/** Per-section fetch outcome: the rows plus the resolved status. */
interface SectionState<T> {
  rows: T[];
  status: AiStatus;
  loading: boolean;
}

const idleSection = <T,>(): SectionState<T> => ({ rows: [], status: 'ok', loading: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

const numberFmt = new Intl.NumberFormat('en-US');
const fmtNum = (v: number): string => numberFmt.format(Math.round(v || 0));

/** A status that means "this surface is intentionally off / unavailable". */
function isOffStatus(status: AiStatus): boolean {
  return (
    status === 'ai_not_configured' ||
    status === 'warehouse_not_configured' ||
    status === 'error'
  );
}

/** Map a churn / anomaly risk word to a StatusTag kind. */
function riskKind(risk: string): 'error' | 'warning' | 'success' | 'info' {
  const r = (risk || '').toLowerCase();
  if (r.includes('high') || r.includes('بەرز')) return 'error';
  if (r.includes('medium') || r.includes('mid') || r.includes('ناوەند')) return 'warning';
  if (r.includes('low') || r.includes('نزم')) return 'success';
  return 'info';
}

/** Map an RFM segment label to a StatusTag kind (semantic, never color-only). */
function segmentKind(segment: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const s = (segment || '').toLowerCase();
  if (s.includes('champion') || s.includes('loyal') || s.includes('best')) return 'success';
  if (s.includes('risk') || s.includes('attention') || s.includes('promis')) return 'warning';
  if (s.includes('lost') || s.includes('hibernat') || s.includes('churn')) return 'error';
  if (s.includes('new') || s.includes('potential')) return 'info';
  return 'default';
}

// ─── Page ────────────────────────────────────────────────────────────────────

const AIInsightsDashboard: React.FC = () => {
  const { t } = useTranslation();

  // ── Ask-your-data section ──
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askResult, setAskResult] = useState<AskResponse | null>(null);

  // ── Narrative insights ──
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);

  // ── Customer + anomaly tables ──
  const [segments, setSegments] = useState<SectionState<SegmentRow>>(idleSection<SegmentRow>());
  const [churn, setChurn] = useState<SectionState<ChurnRow>>(idleSection<ChurnRow>());
  const [anomalies, setAnomalies] = useState<SectionState<AnomalyRow>>(idleSection<AnomalyRow>());

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

  const loadInsights = useCallback(async (signal: AbortSignal) => {
    setInsightsLoading(true);
    try {
      const res = await api.get('/api/ai/insights', {
        // Backend renders the narrative in the requested language; default to ku.
        params: { lang: 'ku' },
        signal,
      });
      if (signal.aborted) return;
      setInsights(res.data as InsightsResponse);
    } catch (err) {
      if (signal.aborted) return;
      if (isBackendUnavailableError(err)) {
        setInsights({ summary: '', status: 'ai_not_configured' });
      } else {
        setInsights({ summary: '', status: 'error' });
      }
    } finally {
      if (!signal.aborted) setInsightsLoading(false);
    }
  }, []);

  const loadAll = useCallback(
    (signal: AbortSignal) => {
      void loadInsights(signal);
      void loadRows<SegmentRow>('/api/ai/customers/segments', signal, setSegments);
      void loadRows<ChurnRow>('/api/ai/customers/churn', signal, setChurn);
      void loadRows<AnomalyRow>(
        '/api/ai/anomalies/transactions?fact=fact_invoices',
        signal,
        setAnomalies,
      );
    },
    [loadInsights, loadRows],
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

  // ─── Ask submit ────────────────────────────────────────────────────────────
  const submitQuestion = useCallback(async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskResult(null);
    try {
      const res = await api.post('/api/ai/ask', { question: q });
      setAskResult(res.data as AskResponse);
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        setAskResult({ question: q, query: null, rows: [], status: 'ai_not_configured' });
      } else {
        setAskResult({ question: q, query: null, rows: [], status: 'error' });
      }
    } finally {
      setAsking(false);
    }
  }, [question, asking]);

  const anyLoading =
    insightsLoading || segments.loading || churn.loading || anomalies.loading;

  // ─── Ask: derive table columns from the returned rows ─────────────────────
  const askColumns = useMemo(() => {
    const rows = askResult?.rows ?? [];
    if (rows.length === 0) return [];
    const keys = Object.keys(rows[0] ?? {});
    return keys.map((k) => ({
      title: k,
      dataIndex: k,
      key: k,
      ellipsis: true,
      render: (v: unknown) =>
        typeof v === 'number' ? (
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontVariantNumeric: 'tabular-nums' }}>
            {numberFmt.format(v)}
          </span>
        ) : (
          <span style={{ color: 'var(--ink-700)' }}>{v == null ? '—' : String(v)}</span>
        ),
    }));
  }, [askResult]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title={t('ai.title', 'تێڕوانینە زیرەکەکان (AI)')}
        subtitle={t('ai.subtitle', 'پرسیار لە داتاکەت بکە، پوختەی زیرەک، بەشکردنی کڕیار و دۆزینەوەی ناڕێکی')}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={reload} loading={anyLoading}>
              {t('refresh', 'نوێکردنەوە')}
            </Button>
          </Space>
        }
      />

      {/* ── 🤖 Ask your data ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <SectionCard
          title={
            <Space size={8}>
              <RobotOutlined />
              {t('ai.askTitle', 'پرسیار لە داتاکەت بکە')}
            </Space>
          }
          subtitle={t('ai.askSubtitle', 'بە زمانی ئاسایی پرسیار بنووسە، AI وەڵامەکەی لە داتاکەت دەردەهێنێت')}
        >
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onPressEnter={submitQuestion}
              placeholder={t('ai.askPlaceholder', 'بۆ نموونە: کۆی فرۆشتنی ئەم مانگە چەندە؟')}
              allowClear
              disabled={asking}
              aria-label={t('ai.askTitle', 'پرسیار لە داتاکەت بکە')}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={asking}
              onClick={submitQuestion}
              disabled={!question.trim()}
            >
              {t('ai.send', 'ناردن')}
            </Button>
          </Space.Compact>

          {/* Ask result */}
          <div style={{ marginBlockStart: space.lg }}>
            {asking ? (
              <LoadingSkeleton variant="row" rows={3} />
            ) : !askResult ? null : askResult.status === 'ai_not_configured' ? (
              <EmptyState
                icon={<ApiOutlined />}
                title={t('ai.notConfiguredTitle', 'زیرەکی دەستکرد هێشتا چالاک نەکراوە')}
                description={t(
                  'ai.notConfiguredDesc',
                  'بۆ بەکارهێنانی پرسیاری زیرەک، کلیلی Claude لە ڕێکخستنەکانی سیستەم زیاد بکە.',
                )}
              />
            ) : askResult.status === 'could_not_interpret' ? (
              <EmptyState
                icon={<SearchOutlined />}
                title={t('ai.couldNotInterpret', 'نەتوانرا پرسیارەکە تێبگەیشترێت')}
                description={t(
                  'ai.couldNotInterpretDesc',
                  'تکایە پرسیارەکە بە شێوەیەکی ڕوونتر بنووسەرەوە، یان ناوی ڕێکخراوی داتا (وەک فرۆشتن، کڕیار) بەکاربهێنە.',
                )}
              />
            ) : isOffStatus(askResult.status) ? (
              <EmptyState
                icon={<ApiOutlined />}
                title={t('ai.askUnavailable', 'وەڵامدانەوە بەردەست نییە')}
                description={t('ai.askUnavailableDesc', 'لە ئێستادا ناتوانرا وەڵامی پرسیارەکە بدرێتەوە. دواتر هەوڵبدەرەوە.')}
              />
            ) : (
              <>
                {askResult.query && (
                  <div style={{ marginBlockEnd: space.md }}>
                    <div style={{ color: 'var(--ink-500)', fontSize: 12, marginBlockEnd: space.xs }}>
                      {t('ai.interpretedQuery', 'پرسیاری لێکدراوە')}
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: space.sm,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--ink-700)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        direction: 'ltr',
                        textAlign: 'start',
                      }}
                    >
                      {askResult.query}
                    </pre>
                  </div>
                )}
                {askResult.rows.length === 0 ? (
                  <EmptyState
                    icon={<SearchOutlined />}
                    title={t('ai.noResults', 'هیچ ئەنجامێک نەدۆزرایەوە')}
                    description={t('ai.noResultsDesc', 'پرسیارەکە تێگەیشتراو بوو، بەڵام هیچ داتایەکی گونجاوی نەگەڕاندەوە.')}
                  />
                ) : (
                  <ResponsiveTableAdapter
                    rowKey={(_: AskRow, i?: number) => String(i)}
                    dataSource={askResult.rows}
                    columns={askColumns}
                    pagination={askResult.rows.length > 10 ? { pageSize: 10 } : false}
                    size="small"
                  />
                )}
              </>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── 📝 AI narrative insights ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <SectionCard
          title={
            <Space size={8}>
              <BulbOutlined />
              {t('ai.narrativeTitle', 'پوختەی زیرەکی AI')}
            </Space>
          }
          subtitle={t('ai.narrativeSubtitle', 'پوختەیەکی نووسراو لەسەر دۆخی ئێستای کارەکەت')}
        >
          {insightsLoading ? (
            <LoadingSkeleton variant="row" rows={4} />
          ) : !insights || isOffStatus(insights.status) || !insights.summary ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('ai.notConfiguredTitle', 'زیرەکی دەستکرد هێشتا چالاک نەکراوە')}
              description={t(
                'ai.narrativeNotConfiguredDesc',
                'دوای زیادکردنی کلیلی Claude، پوختەی زیرەکی کارەکەت لێرە دەردەکەوێت.',
              )}
            />
          ) : (
            <p
              style={{
                margin: 0,
                color: 'var(--ink-800)',
                fontSize: 14,
                lineHeight: 1.9,
                whiteSpace: 'pre-wrap',
              }}
            >
              {insights.summary}
            </p>
          )}
        </SectionCard>
      </div>

      {/* ── 🧑‍🤝‍🧑 Customer segments (RFM) ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <SectionCard
          title={
            <Space size={8}>
              <TeamOutlined />
              {t('ai.segmentsTitle', 'بەشکردنی کڕیار (RFM)')}
            </Space>
          }
          subtitle={t('ai.segmentsSubtitle', 'پۆلێنکردنی کڕیار بەپێی دواهەمین کڕین، دووبارەیی و بڕی پارە')}
          padded={false}
        >
          {segments.loading ? (
            <div style={{ padding: space.lg }}>
              <LoadingSkeleton variant="table" rows={5} />
            </div>
          ) : isOffStatus(segments.status) ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('ai.segmentsOff', 'بەشکردنی کڕیار بەردەست نییە')}
              description={t(
                'ai.segmentsOffDesc',
                'ئەم بەشە پێویستی بە کۆگای ئامار و زیرەکی دەستکردە. دوای چالاککردنیان، بەشەکانی کڕیار لێرە دەردەکەون.',
              )}
            />
          ) : segments.rows.length === 0 ? (
            <EmptyState
              icon={<TeamOutlined />}
              title={t('ai.segmentsEmpty', 'هیچ بەشێکی کڕیار نییە')}
              description={t('ai.segmentsEmptyDesc', 'کاتێک داتای فرۆشتنی کڕیار کۆدەبێتەوە، بەشەکان لێرە دەردەکەون.')}
            />
          ) : (
            <ResponsiveTableAdapter
              rowKey={(r: SegmentRow, i?: number) => `${r.customer}-${i}`}
              dataSource={segments.rows}
              pagination={segments.rows.length > 10 ? { pageSize: 10 } : false}
              columns={[
                {
                  title: t('ai.customer', 'کڕیار'),
                  dataIndex: 'customer',
                  key: 'customer',
                  render: (v: string) => (
                    <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
                  ),
                },
                {
                  title: t('ai.segment', 'بەش'),
                  dataIndex: 'segment',
                  key: 'segment',
                  render: (v: string) => <StatusTag status={segmentKind(v)} label={v} />,
                },
                {
                  title: t('ai.recency', 'دواهەمین کڕین'),
                  dataIndex: 'recency',
                  key: 'recency',
                  align: 'end' as const,
                  render: (v: number) => (
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtNum(v)}
                    </span>
                  ),
                },
                {
                  title: t('ai.frequency', 'دووبارەیی'),
                  dataIndex: 'frequency',
                  key: 'frequency',
                  align: 'end' as const,
                  render: (v: number) => (
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtNum(v)}
                    </span>
                  ),
                },
                {
                  title: t('ai.monetary', 'بڕی پارە'),
                  dataIndex: 'monetary',
                  key: 'monetary',
                  align: 'end' as const,
                  render: (v: number) => (
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtNum(v)}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {/* ── ⚠️ Churn risk ── */}
      <div style={{ marginBlockEnd: space.lg }}>
        <SectionCard
          title={
            <Space size={8}>
              <WarningOutlined />
              {t('ai.churnTitle', 'مەترسی لەدەستدانی کڕیار')}
            </Space>
          }
          subtitle={t('ai.churnSubtitle', 'کڕیارانی لەژێر مەترسیدا کە لەوانەیە بڕۆن')}
          padded={false}
        >
          {churn.loading ? (
            <div style={{ padding: space.lg }}>
              <LoadingSkeleton variant="table" rows={5} />
            </div>
          ) : isOffStatus(churn.status) ? (
            <EmptyState
              icon={<ApiOutlined />}
              title={t('ai.churnOff', 'شیکاری مەترسی بەردەست نییە')}
              description={t(
                'ai.churnOffDesc',
                'ئەم بەشە پێویستی بە کۆگای ئامار و زیرەکی دەستکردە. دوای چالاککردنیان، مەترسییەکان لێرە دەردەکەون.',
              )}
            />
          ) : churn.rows.length === 0 ? (
            <EmptyState
              icon={<WarningOutlined />}
              title={t('ai.churnEmpty', 'هیچ کڕیارێکی لەژێر مەترسیدا نییە')}
              description={t('ai.churnEmptyDesc', 'هیچ کڕیارێک لە ئێستادا نیشانەی لەدەستدانی ناخات.')}
            />
          ) : (
            <ResponsiveTableAdapter
              rowKey={(r: ChurnRow, i?: number) => `${r.customer}-${i}`}
              dataSource={churn.rows}
              pagination={churn.rows.length > 10 ? { pageSize: 10 } : false}
              columns={[
                {
                  title: t('ai.customer', 'کڕیار'),
                  dataIndex: 'customer',
                  key: 'customer',
                  render: (v: string) => (
                    <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
                  ),
                },
                {
                  title: t('ai.risk', 'ئاستی مەترسی'),
                  dataIndex: 'risk',
                  key: 'risk',
                  render: (v: string) => <StatusTag status={riskKind(v)} label={v} />,
                },
                {
                  title: t('ai.daysSince', 'ڕۆژ لە دواهەمین چالاکی'),
                  dataIndex: 'days_since',
                  key: 'days_since',
                  align: 'end' as const,
                  render: (v: number) => (
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtNum(v)}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {/* ── 🚨 Anomalies ── */}
      <SectionCard
        title={
          <Space size={8}>
            <AlertOutlined />
            {t('ai.anomaliesTitle', 'دۆزینەوەی ناڕێکی')}
          </Space>
        }
        subtitle={t('ai.anomaliesSubtitle', 'مامەڵە نائاساییەکان کە پێویستیان بە پشکنینە')}
        padded={false}
      >
        {anomalies.loading ? (
          <div style={{ padding: space.lg }}>
            <LoadingSkeleton rows={5} />
          </div>
        ) : isOffStatus(anomalies.status) ? (
          <EmptyState
            icon={<ApiOutlined />}
            title={t('ai.anomaliesOff', 'دۆزینەوەی ناڕێکی بەردەست نییە')}
            description={t(
              'ai.anomaliesOffDesc',
              'ئەم بەشە پێویستی بە کۆگای ئامارە. دوای چالاککردنی، مامەڵە نائاساییەکان لێرە دەردەکەون.',
            )}
          />
        ) : anomalies.rows.length === 0 ? (
          <EmptyState
            icon={<AlertOutlined />}
            title={t('ai.anomaliesEmpty', 'هیچ ناڕێکییەک نەدۆزرایەوە')}
            description={t('ai.anomaliesEmptyDesc', 'هەموو مامەڵەکان لە سنووری ئاسایی دان.')}
          />
        ) : (
          <ResponsiveTableAdapter
            rowKey={(r: AnomalyRow) => r.id}
            dataSource={anomalies.rows}
            pagination={anomalies.rows.length > 10 ? { pageSize: 10 } : false}
            columns={[
              {
                title: t('ai.date', 'بەروار'),
                dataIndex: 'date',
                key: 'date',
                render: (v: string) => (
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>
                    {v ? String(v).slice(0, 10) : '—'}
                  </span>
                ),
              },
              {
                title: t('ai.party', 'لایەن'),
                dataIndex: 'party',
                key: 'party',
                ellipsis: true,
                render: (v: string) => (
                  <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v || '—'}</span>
                ),
              },
              {
                title: t('ai.amount', 'بڕ'),
                dataIndex: 'amount',
                key: 'amount',
                align: 'end' as const,
                render: (v: number) => (
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtNum(v)}
                  </span>
                ),
              },
              {
                title: t('ai.zScore', 'پێوەری ناڕێکی'),
                dataIndex: 'z_score',
                key: 'z_score',
                align: 'end' as const,
                render: (v: number) => {
                  const z = Number(v) || 0;
                  const kind = Math.abs(z) >= 3 ? 'error' : Math.abs(z) >= 2 ? 'warning' : 'info';
                  return <StatusTag status={kind} label={z.toFixed(2)} />;
                },
              },
              {
                title: t('ai.reason', 'هۆکار'),
                dataIndex: 'reason',
                key: 'reason',
                ellipsis: true,
                render: (v: string) => <span style={{ color: 'var(--ink-600)' }}>{v || '—'}</span>,
              },
            ]}
          />
        )}
      </SectionCard>
    </div>
  );
};

export default AIInsightsDashboard;
