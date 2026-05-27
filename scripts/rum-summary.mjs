#!/usr/bin/env node
/**
 * rum-summary.mjs
 * ---------------------------------------------------------------------------
 * V-PR.2 (Core Web Vitals p75) — queries the BigQuery `vitals_raw` table and
 * emits a markdown summary per day × device class for LCP / INP / CLS / TTFB
 * / FCP at p50 / p75 / p95. Compares to thresholds in Requirements R1.1–1.4.
 *
 * Output:  audit/rum/summary-{ISO-DATE}.md
 *
 * Env vars:
 *   RUM_BIGQUERY_PROJECT   GCP project (e.g. zoho-prod)
 *   RUM_BIGQUERY_DATASET   dataset (default: observability)
 *   RUM_BIGQUERY_TABLE     table     (default: vitals_raw)
 *   RUM_WINDOW_DAYS        lookback window (default: 7)
 *   RUM_MIN_EVENTS         min event count to render thresholds (default: 1000)
 *
 * Graceful degradation:
 *   - if `@google-cloud/bigquery` is not installed → warn + emit a stub file
 *   - if the env vars are missing                  → warn + emit a stub file
 *   - if total events < RUM_MIN_EVENTS             → emit "not enough data"
 *
 * Set executable bit on commit (chmod +x scripts/rum-summary.mjs).
 *
 * Referenced by validation.md V-PR.2.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = join(REPO_ROOT, 'audit', 'rum');

const PROJECT = process.env.RUM_BIGQUERY_PROJECT || '';
const DATASET = process.env.RUM_BIGQUERY_DATASET || 'observability';
const TABLE = process.env.RUM_BIGQUERY_TABLE || 'vitals_raw';
const WINDOW_DAYS = Number.parseInt(process.env.RUM_WINDOW_DAYS || '7', 10);
const MIN_EVENTS = Number.parseInt(process.env.RUM_MIN_EVENTS || '1000', 10);

// Thresholds from requirements.md R1.1–1.4 (target p75).
// LCP varies by device class / network; we encode a sensible matrix.
const THRESHOLDS = {
  LCP: { 'mobile-low': 3000, 'mobile-mid': 2500, 'mobile-high': 2000, tablet: 2000, desktop: 1500 },
  INP: { 'mobile-low': 200, 'mobile-mid': 200, 'mobile-high': 150, tablet: 150, desktop: 150 },
  CLS: { 'mobile-low': 0.1, 'mobile-mid': 0.1, 'mobile-high': 0.05, tablet: 0.05, desktop: 0.05 },
  TTFB: { 'mobile-low': 1500, 'mobile-mid': 1000, 'mobile-high': 800, tablet: 800, desktop: 500 },
  FCP: { 'mobile-low': 2500, 'mobile-mid': 2000, 'mobile-high': 1500, tablet: 1500, desktop: 1200 },
};

const METRICS = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'];
const DEVICE_CLASSES = ['mobile-low', 'mobile-mid', 'mobile-high', 'tablet', 'desktop'];

function isoDateOnly(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function fmtMetric(metric, value) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  if (metric === 'CLS') return value.toFixed(3);
  return `${Math.round(value)}ms`;
}

function status(metric, deviceClass, p75) {
  const t = THRESHOLDS[metric]?.[deviceClass];
  if (t == null || p75 == null) return '❔';
  if (p75 <= t) return '🟢';
  if (p75 <= t * 1.25) return '🟡';
  return '🔴';
}

async function writeOut(md) {
  await mkdir(OUT_DIR, { recursive: true });
  const stamp = isoDateOnly();
  const path = join(OUT_DIR, `summary-${stamp}.md`);
  await writeFile(path, md, 'utf8');
  process.stderr.write(`[rum-summary] wrote ${path}\n`);
  return path;
}

function stubMarkdown(reason) {
  return [
    `# RUM Summary — ${isoDateOnly()}`,
    '',
    `_Skipped: ${reason}_`,
    '',
    '## Configuration',
    '',
    '| Env | Value |',
    '|-----|-------|',
    `| RUM_BIGQUERY_PROJECT | ${PROJECT || '_unset_'} |`,
    `| RUM_BIGQUERY_DATASET | ${DATASET} |`,
    `| RUM_BIGQUERY_TABLE   | ${TABLE} |`,
    `| Window | ${WINDOW_DAYS}d |`,
    '',
  ].join('\n');
}

async function loadBigQuery() {
  try {
    const mod = await import('@google-cloud/bigquery');
    return new mod.BigQuery({ projectId: PROJECT });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function buildQuery() {
  // Per-day, per-device_class, per-metric percentiles.
  // Source schema assumption (per Requirement 6.2):
  //   timestamp TIMESTAMP, metric STRING, value FLOAT64,
  //   device_class STRING, network STRING, tenant_id STRING, route STRING,
  //   app_version STRING.
  return `
    WITH q AS (
      SELECT
        DATE(timestamp) AS day,
        device_class,
        metric,
        APPROX_QUANTILES(value, 100) AS quantiles,
        COUNT(*) AS n
      FROM \`${PROJECT}.${DATASET}.${TABLE}\`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${WINDOW_DAYS} DAY)
        AND metric IN ('LCP','INP','CLS','TTFB','FCP')
        AND value IS NOT NULL
      GROUP BY day, device_class, metric
    )
    SELECT
      day, device_class, metric,
      quantiles[OFFSET(50)] AS p50,
      quantiles[OFFSET(75)] AS p75,
      quantiles[OFFSET(95)] AS p95,
      n
    FROM q
    ORDER BY day DESC, device_class, metric
  `;
}

function rowsToMarkdown(rows) {
  // Group rows by day then device_class for a readable layout.
  const byDay = new Map();
  let totalEvents = 0;
  for (const r of rows) {
    totalEvents += Number(r.n || 0);
    const day = String(r.day?.value ?? r.day);
    if (!byDay.has(day)) byDay.set(day, new Map());
    const dayMap = byDay.get(day);
    if (!dayMap.has(r.device_class)) dayMap.set(r.device_class, {});
    dayMap.get(r.device_class)[r.metric] = {
      p50: Number(r.p50), p75: Number(r.p75), p95: Number(r.p95), n: Number(r.n),
    };
  }

  const lines = [
    `# RUM Summary — ${isoDateOnly()}`,
    '',
    `Source: \`${PROJECT}.${DATASET}.${TABLE}\``,
    `Window: last ${WINDOW_DAYS}d`,
    `Total events: ${totalEvents.toLocaleString()}`,
    '',
  ];

  if (totalEvents < MIN_EVENTS) {
    lines.push(`> ⚠️ Not enough data (${totalEvents} < ${MIN_EVENTS}) — proof gates not yet evaluable.`);
    return lines.join('\n');
  }

  const days = [...byDay.keys()].sort().reverse();
  for (const day of days) {
    lines.push(`## ${day}`);
    lines.push('');
    lines.push('| Device class | Metric | p50 | p75 | p95 | n | vs target |');
    lines.push('|--------------|--------|-----|-----|-----|---|-----------|');
    const dayMap = byDay.get(day);
    for (const dc of DEVICE_CLASSES) {
      const m = dayMap.get(dc);
      if (!m) continue;
      for (const metric of METRICS) {
        const cell = m[metric];
        if (!cell) continue;
        const t = THRESHOLDS[metric]?.[dc];
        const targetStr = t == null ? 'n/a' : (metric === 'CLS' ? t.toFixed(2) : `${t}ms`);
        lines.push(
          `| ${dc} | ${metric} | ${fmtMetric(metric, cell.p50)} | ${fmtMetric(metric, cell.p75)} | ${fmtMetric(metric, cell.p95)} | ${cell.n} | ${status(metric, dc, cell.p75)} ${targetStr} |`,
        );
      }
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('Thresholds reference: requirements.md R1.1–1.4 (p75 by device class).');
  return lines.join('\n');
}

async function main() {
  if (!PROJECT) {
    console.warn('[rum-summary] RUM_BIGQUERY_PROJECT unset — emitting stub.');
    await writeOut(stubMarkdown('RUM_BIGQUERY_PROJECT env not set'));
    process.exit(0);
  }

  const bq = await loadBigQuery();
  if (bq && bq.error) {
    console.warn(`[rum-summary] @google-cloud/bigquery missing: ${bq.error}`);
    await writeOut(stubMarkdown(`@google-cloud/bigquery not installed (${bq.error})`));
    process.exit(0);
  }

  let rows;
  try {
    const [r] = await bq.query({ query: buildQuery() });
    rows = r;
  } catch (e) {
    console.warn(`[rum-summary] BigQuery query failed: ${e instanceof Error ? e.message : e}`);
    await writeOut(stubMarkdown(`BigQuery query failed — see CI logs`));
    process.exit(0);
  }

  const md = rowsToMarkdown(rows);
  console.log(md);
  await writeOut(md);
  process.exit(0);
}

main().catch((e) => {
  console.error(`[rum-summary] fatal: ${e instanceof Error ? e.stack : e}`);
  process.exit(0);
});
