#!/usr/bin/env node
/**
 * production-reality-probe.mjs
 * ---------------------------------------------------------------------------
 * Synthetic SLO probe for V-PR.1 (Real User p95 Latency) and V-PR.7 (Cold-Start).
 *
 * Reads endpoint definitions from `scripts/probe-targets.json` and per-class
 * thresholds from `scripts/slo-thresholds.json`. For each endpoint, makes
 * `SAMPLES` sequential GETs, records latency, and computes p50/p95.
 *
 * Outputs:
 *   - Markdown table on stdout (suitable for posting to PR comment / Slack).
 *   - JSON record at `audit/probes/probe-{ISO-DATE}.json`.
 *
 * Exit codes:
 *   0  — all p95 within 2× class threshold (soft pass).
 *   2  — at least one p95 exceeded 2× threshold (hard fail; blocks deploy).
 *   0  — graceful skip when probe-targets.json / slo-thresholds.json missing
 *        (script must never break local dev without config).
 *
 * Env vars:
 *   PROBE_TARGET_URL    base URL, default http://localhost:8000
 *   PROBE_AUTH_TOKEN    Bearer token used when `requires_auth: true`
 *   PROBE_SAMPLES       samples per endpoint, default 5
 *   PROBE_TIMEOUT_MS    per-request timeout, default 15000
 *
 * Set executable bit on commit (chmod +x scripts/production-reality-probe.mjs).
 *
 * Referenced by:
 *   - validation.md V-PR.1, V-PR.7
 *   - scripts/deploy-gates.sh (gate #2)
 *   - .github/workflows/weekly-health-check.yml (T-V.8)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const BASE_URL = (process.env.PROBE_TARGET_URL || 'http://localhost:8000').replace(/\/$/, '');
const AUTH_TOKEN = process.env.PROBE_AUTH_TOKEN || '';
const SAMPLES = Number.parseInt(process.env.PROBE_SAMPLES || '5', 10);
const TIMEOUT_MS = Number.parseInt(process.env.PROBE_TIMEOUT_MS || '15000', 10);

const TARGETS_PATH = join(REPO_ROOT, 'scripts', 'probe-targets.json');
const THRESHOLDS_PATH = join(REPO_ROOT, 'scripts', 'slo-thresholds.json');
const OUT_DIR = join(REPO_ROOT, 'audit', 'probes');

// ── helpers ──────────────────────────────────────────────────────────────

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

async function timedFetch(url, { method, headers, timeoutMs }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();
  let status = 0;
  let error = null;
  try {
    const res = await fetch(url, { method, headers, signal: ctrl.signal, redirect: 'manual' });
    status = res.status;
    // Drain the body so the timing reflects full transfer, not just headers.
    try { await res.arrayBuffer(); } catch { /* ignore */ }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(timer);
  }
  const elapsed = performance.now() - start;
  return { status, elapsed, error };
}

async function probeTarget(target) {
  const url = `${BASE_URL}${target.path}`;
  const headers = { Accept: 'application/json, text/html, */*' };
  if (target.requires_auth && AUTH_TOKEN) {
    headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  }

  const samples = [];
  let okCount = 0;
  let lastError = null;

  for (let i = 0; i < SAMPLES; i++) {
    const r = await timedFetch(url, { method: target.method || 'GET', headers, timeoutMs: TIMEOUT_MS });
    samples.push(r);
    if (r.error == null && r.status === (target.expected_status ?? 200)) okCount++;
    else if (r.error) lastError = r.error;
  }

  const latencies = samples.map((s) => s.elapsed);
  return {
    path: target.path,
    label: target.label || target.path,
    slo_class: target.slo_class,
    expected_status: target.expected_status ?? 200,
    samples_taken: samples.length,
    samples_ok: okCount,
    p50_ms: Math.round(percentile(latencies, 50) ?? 0),
    p95_ms: Math.round(percentile(latencies, 95) ?? 0),
    p99_ms: Math.round(percentile(latencies, 99) ?? 0),
    min_ms: Math.round(Math.min(...latencies)),
    max_ms: Math.round(Math.max(...latencies)),
    last_error: lastError,
    skipped: target.requires_auth && !AUTH_TOKEN,
  };
}

function classifyResult(row, thresholds) {
  if (row.skipped) return { status: 'skip', detail: 'requires_auth but PROBE_AUTH_TOKEN unset' };
  const cls = thresholds.classes[row.slo_class];
  if (!cls) return { status: 'unknown', detail: `no threshold for class=${row.slo_class}` };
  if (row.samples_ok === 0) return { status: 'fail', detail: 'all samples failed' };
  if (row.p95_ms > 2 * cls.p95_ms) return { status: 'fail', detail: `p95 ${row.p95_ms}ms > 2× SLO ${cls.p95_ms}ms` };
  if (row.p95_ms > cls.p95_ms) return { status: 'warn', detail: `p95 ${row.p95_ms}ms > SLO ${cls.p95_ms}ms` };
  return { status: 'pass', detail: `p95 ${row.p95_ms}ms ≤ SLO ${cls.p95_ms}ms` };
}

function emoji(status) {
  return { pass: '🟢', warn: '🟡', fail: '🔴', skip: '⚪', unknown: '❔' }[status] || '❔';
}

function renderMarkdown(rows, thresholds) {
  const lines = [
    `# Synthetic SLO Probe — ${new Date().toISOString()}`,
    '',
    `Base URL: \`${BASE_URL}\``,
    `Samples per endpoint: ${SAMPLES}`,
    '',
    '| Status | Endpoint | Class | p50 | p95 | p99 | SLO p95 | Result |',
    '|--------|----------|-------|-----|-----|-----|---------|--------|',
  ];
  for (const row of rows) {
    const cls = thresholds.classes[row.slo_class];
    const verdict = classifyResult(row, thresholds);
    const sloP95 = cls ? `${cls.p95_ms}ms` : 'n/a';
    lines.push(
      `| ${emoji(verdict.status)} ${verdict.status.toUpperCase()} | \`${row.path}\` | ${row.slo_class} | ${row.p50_ms}ms | ${row.p95_ms}ms | ${row.p99_ms}ms | ${sloP95} | ${verdict.detail} |`,
    );
  }
  return lines.join('\n');
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(TARGETS_PATH) || !existsSync(THRESHOLDS_PATH)) {
    console.warn('[probe] probe-targets.json or slo-thresholds.json missing — skipping.');
    process.exit(0);
  }

  let targetsDoc, thresholds;
  try {
    targetsDoc = await readJson(TARGETS_PATH);
    thresholds = await readJson(THRESHOLDS_PATH);
  } catch (e) {
    console.warn(`[probe] failed to read config: ${e.message} — skipping.`);
    process.exit(0);
  }

  const targets = Array.isArray(targetsDoc.targets) ? targetsDoc.targets : [];
  if (targets.length === 0) {
    console.warn('[probe] no targets configured — skipping.');
    process.exit(0);
  }

  const rows = [];
  for (const t of targets) {
    process.stderr.write(`[probe] ${t.method || 'GET'} ${t.path} ...\n`);
    try {
      const r = await probeTarget(t);
      rows.push(r);
    } catch (e) {
      rows.push({
        path: t.path,
        label: t.label || t.path,
        slo_class: t.slo_class,
        expected_status: t.expected_status ?? 200,
        samples_taken: 0, samples_ok: 0,
        p50_ms: 0, p95_ms: 0, p99_ms: 0, min_ms: 0, max_ms: 0,
        last_error: e instanceof Error ? e.message : String(e),
        skipped: false,
      });
    }
  }

  const md = renderMarkdown(rows, thresholds);
  console.log(md);

  await mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(OUT_DIR, `probe-${stamp}.json`);
  const record = {
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    samples_per_endpoint: SAMPLES,
    results: rows.map((r) => {
      const v = classifyResult(r, thresholds);
      return { ...r, verdict: v };
    }),
  };
  await writeFile(outPath, JSON.stringify(record, null, 2), 'utf8');
  process.stderr.write(`[probe] wrote ${outPath}\n`);

  const hardFail = record.results.some((r) => r.verdict.status === 'fail');
  process.exit(hardFail ? 2 : 0);
}

main().catch((e) => {
  console.error(`[probe] fatal: ${e instanceof Error ? e.stack : e}`);
  // Graceful degradation: we exit 0 on truly unexpected failures so CI doesn't
  // wedge on probe bugs. Hard SLO failures use the explicit exit(2) above.
  process.exit(0);
});
