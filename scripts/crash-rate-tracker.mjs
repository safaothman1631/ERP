#!/usr/bin/env node
/**
 * crash-rate-tracker.mjs
 * ---------------------------------------------------------------------------
 * V-PR.3 (Crash-Free Session Rate) — pulls last 7 days of crash-free session
 * data from the Sentry API and emits a markdown table to stdout.
 *
 * Sentry API reference:
 *   GET /api/0/organizations/{org}/sessions/?project={proj}&statsPeriod=7d
 *     &interval=1d&field=sum(session)&field=crash_free_rate(session)
 *     &groupBy=release
 *
 * Env vars (all required for live data; missing → graceful skip):
 *   SENTRY_AUTH_TOKEN     auth token with `org:read` + `project:read`
 *   SENTRY_ORG_SLUG       organisation slug
 *   SENTRY_PROJECT_SLUG   project slug (or numeric id)
 *   SENTRY_API_BASE       override (default https://sentry.io)
 *
 * Exit codes:
 *   0  — report rendered (whether all green or some red — this script reports,
 *        it does not fail builds; deploy-gates.sh is the enforcement layer).
 *   1  — unrecoverable error reaching Sentry that is NOT a missing credential.
 *
 * Set executable bit on commit (chmod +x scripts/crash-rate-tracker.mjs).
 *
 * Referenced by validation.md V-PR.3.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const TOKEN = process.env.SENTRY_AUTH_TOKEN || '';
const ORG = process.env.SENTRY_ORG_SLUG || '';
const PROJECT = process.env.SENTRY_PROJECT_SLUG || '';
const BASE = (process.env.SENTRY_API_BASE || 'https://sentry.io').replace(/\/$/, '');
const CRASH_FREE_FLOOR = Number.parseFloat(process.env.CRASH_FREE_FLOOR || '99.5'); // % per V-PR.3

function emoji(pct) {
  if (pct == null || Number.isNaN(pct)) return '❔';
  if (pct >= CRASH_FREE_FLOOR) return '🟢';
  if (pct >= 99.0) return '🟡';
  return '🔴';
}

function trend(curr, prev) {
  if (curr == null || prev == null) return '—';
  const d = curr - prev;
  if (Math.abs(d) < 0.05) return '→';
  return d > 0 ? `↑ +${d.toFixed(2)}` : `↓ ${d.toFixed(2)}`;
}

async function fetchSentry(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sentry API ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Calls the Sentry "sessions" stats endpoint, which returns per-release
 * crash-free session rate for the requested interval.
 */
async function fetchCrashRate({ statsPeriod, interval }) {
  const qs = new URLSearchParams({
    project: PROJECT,
    statsPeriod,
    interval,
    field: 'sum(session)',
    groupBy: 'release',
  });
  // crash_free_rate is a separate field — append manually to keep duplicate keys
  const url =
    `/api/0/organizations/${encodeURIComponent(ORG)}/sessions/?${qs.toString()}` +
    `&field=${encodeURIComponent('crash_free_rate(session)')}`;
  return fetchSentry(url);
}

/**
 * Parses a Sentry sessions response into rows keyed by release.
 * Sentry returns: { groups: [ { by: {release}, totals: { 'sum(session)':N, 'crash_free_rate(session)':0.99x } } ] }
 */
function parseRows(payload) {
  const groups = Array.isArray(payload?.groups) ? payload.groups : [];
  return groups.map((g) => {
    const release = g?.by?.release ?? 'unknown';
    const totals = g?.totals || {};
    const sessions = Number(totals['sum(session)'] ?? 0);
    const cfRaw = totals['crash_free_rate(session)'];
    const crashFreePct = cfRaw == null ? null : Number(cfRaw) * 100;
    return { release, sessions, crashFreePct };
  });
}

function renderMarkdown(curr, prevByRelease) {
  const lines = [
    `# Crash-Free Session Rate (V-PR.3) — ${new Date().toISOString()}`,
    '',
    `Threshold: ≥ ${CRASH_FREE_FLOOR}% sessions crash-free.`,
    '',
    '| Status | Release | Sessions (7d) | Crash-free % | Trend vs prior 7d |',
    '|--------|---------|---------------|--------------|-------------------|',
  ];
  const sorted = [...curr].sort((a, b) => (b.sessions || 0) - (a.sessions || 0));
  for (const row of sorted) {
    const prev = prevByRelease.get(row.release)?.crashFreePct ?? null;
    const cf = row.crashFreePct;
    const cfStr = cf == null ? 'n/a' : `${cf.toFixed(3)}%`;
    lines.push(
      `| ${emoji(cf)} | \`${row.release}\` | ${row.sessions.toLocaleString()} | ${cfStr} | ${trend(cf, prev)} |`,
    );
  }
  const anyRed = sorted.some((r) => r.crashFreePct != null && r.crashFreePct < CRASH_FREE_FLOOR);
  lines.push('');
  lines.push(anyRed
    ? `🔴 At least one release is below the ${CRASH_FREE_FLOOR}% crash-free floor.`
    : `🟢 All releases meet the ${CRASH_FREE_FLOOR}% crash-free floor.`);
  return lines.join('\n');
}

async function writeJsonAudit(curr) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(REPO_ROOT, 'audit', 'probes');
  await mkdir(dir, { recursive: true });
  const path = join(dir, `crash-rate-${stamp}.json`);
  await writeFile(path, JSON.stringify({
    generated_at: new Date().toISOString(),
    org: ORG, project: PROJECT,
    threshold_pct: CRASH_FREE_FLOOR,
    releases: curr,
  }, null, 2), 'utf8');
  process.stderr.write(`[crash-rate] wrote ${path}\n`);
}

async function main() {
  if (!TOKEN || !ORG || !PROJECT) {
    console.warn('[crash-rate] SENTRY_AUTH_TOKEN / SENTRY_ORG_SLUG / SENTRY_PROJECT_SLUG missing — skipping.');
    console.log(`# Crash-Free Session Rate (V-PR.3)\n\n_Skipped: Sentry credentials not configured._`);
    process.exit(0);
  }

  let currPayload, prevPayload;
  try {
    [currPayload, prevPayload] = await Promise.all([
      fetchCrashRate({ statsPeriod: '7d', interval: '1d' }),
      fetchCrashRate({ statsPeriod: '14d', interval: '7d' }),
    ]);
  } catch (e) {
    console.error(`[crash-rate] Sentry API error: ${e instanceof Error ? e.message : e}`);
    console.log(`# Crash-Free Session Rate (V-PR.3)\n\n_Sentry API unreachable; see CI logs._`);
    process.exit(1);
  }

  const curr = parseRows(currPayload);
  const prev = parseRows(prevPayload);
  const prevByRelease = new Map(prev.map((r) => [r.release, r]));

  const md = renderMarkdown(curr, prevByRelease);
  console.log(md);

  try { await writeJsonAudit(curr); } catch (e) {
    process.stderr.write(`[crash-rate] failed to write audit JSON: ${e.message}\n`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(`[crash-rate] fatal: ${e instanceof Error ? e.stack : e}`);
  process.exit(0); // graceful — never wedge CI on unexpected errors
});
