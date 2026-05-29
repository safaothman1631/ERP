#!/usr/bin/env node
// @ts-check
/**
 * world-class-scorecard.mjs (T-V.1)
 *
 * The master scorecard generator. Composes:
 *   - scripts/maintainability-report.mjs   (V-LM.1, .2, .4, .5, .6, .11)
 *   - scripts/flaky-test-tracker.mjs       (V-LM.7)
 *   - scripts/velocity-report.mjs          (V-LM.10)
 *   - scripts/doc-freshness.mjs            (V-LM.11)
 *   - scripts/adr-compliance.mjs           (V-LM.12)
 *   - audit/probes/probes-<latest>.json    (V-PR.1 .. V-PR.12)
 *
 * Outputs:
 *   - docs/world-class/scorecard.md       (overwritten each run)
 *   - audit/scorecards/scorecard-<DATE>.json (history)
 *   - audit/scorecards/scorecard-PREV.json   (rolling pointer to latest)
 *
 * Trend computation: reads scorecard-PREV.json from the PREVIOUS run (read
 * BEFORE the new file is written), compares each V-PR / V-LM row's `current`
 * field, and emits up/down/flat trend arrows.
 *
 * "WORLD-CLASS" verdict: ≥ 22/24 rows green AND no row red for > 14 days.
 *
 * Exit codes:
 *   - 0 on success (scorecard written)
 *   - 1 on internal error (e.g., write failure, JSON parse crash of own state)
 *
 * Determinism: aside from the `generated` timestamp, two runs with identical
 * inputs produce identical output (sorted keys, stable order of rows).
 *
 * Usage:
 *   node scripts/world-class-scorecard.mjs
 *   node scripts/world-class-scorecard.mjs --dry-run    # don't write files
 *   node scripts/world-class-scorecard.mjs --no-probes  # skip V-PR rows (use TBD)
 */

import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildReport as buildMaintainability } from './maintainability-report.mjs';
import { buildReport as buildFlakes } from './flaky-test-tracker.mjs';
import { buildReport as buildVelocity } from './velocity-report.mjs';
import { buildReport as buildAdr } from './adr-compliance.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..');

const SCORECARD_OUT = resolve(REPO_ROOT, 'docs', 'world-class', 'scorecard.md');
const SCORECARDS_DIR = resolve(REPO_ROOT, 'audit', 'scorecards');
const PROBES_DIR = resolve(REPO_ROOT, 'audit', 'probes');

const RED_THRESHOLD_DAYS = 14;

/**
 * @typedef {{
 *   id: string;
 *   what: string;
 *   target: string;
 *   current: string;
 *   trend: 'up' | 'down' | 'flat' | '?';
 *   status: 'green' | 'yellow' | 'red' | 'unknown';
 *   first_red_at?: string | null;
 *   runbook?: string;
 * }} ScorecardRow
 */

const VPR_DEFINITIONS = [
  { id: 'V-PR.1',  what: 'Real User p95 Latency',         target: 'per SLO table',                 runbook: 'docs/runbooks/slow-firestore-read.md' },
  { id: 'V-PR.2',  what: 'Core Web Vitals p75',           target: 'LCP ≤ 2000ms, INP ≤ 150ms, CLS ≤ 0.05', runbook: 'docs/runbooks/cwv-regression.md' },
  { id: 'V-PR.3',  what: 'Crash-Free Session Rate',       target: '≥ 99.5%',                       runbook: 'docs/runbooks/chunk-load-failure.md' },
  { id: 'V-PR.4',  what: 'Offline POS Sync Success',      target: '≥ 99.9%',                       runbook: 'docs/runbooks/pos-offline-drill.md' },
  { id: 'V-PR.5',  what: 'Receipt-Print Latency p95',     target: '≤ 200ms',                       runbook: 'docs/runbooks/print-path-triage.md' },
  { id: 'V-PR.6',  what: 'Availability (monthly)',        target: '≥ 99.5%',                       runbook: 'DISASTER_RECOVERY.md' },
  { id: 'V-PR.7',  what: 'Cold-Start p95',                target: '≤ 2s',                          runbook: 'docs/runbooks/cold-start-spike.md' },
  { id: 'V-PR.8',  what: 'Cache Hit Ratio',               target: '≥ 60%',                         runbook: 'docs/runbooks/redis-down.md' },
  { id: 'V-PR.9',  what: 'Bundle Size at Production',     target: 'shell ≤ 350 KB gz',             runbook: 'docs/runbooks/bundle-bloat.md' },
  { id: 'V-PR.10', what: 'Chunk-Load Failure Rate',       target: '< 0.5%',                        runbook: 'docs/runbooks/chunk-load-failure.md' },
  { id: 'V-PR.11', what: 'Firestore Read p99',            target: '≤ 400ms',                       runbook: 'docs/runbooks/slow-firestore-read.md' },
  { id: 'V-PR.12', what: 'Backup Freshness',              target: '≤ 24h between backups',         runbook: 'DISASTER_RECOVERY.md' },
];

const VLM_DEFINITIONS = [
  { id: 'V-LM.1',  what: 'File Size Budget',              target: '0 files > 600 LOC' },
  { id: 'V-LM.2',  what: 'Cyclomatic Complexity Cap',     target: '0 functions > 15' },
  { id: 'V-LM.3',  what: 'Cognitive Complexity Cap',      target: '< 10 functions > 15' },
  { id: 'V-LM.4',  what: 'Dead Code Rate',                target: '< 0.5% dead exports' },
  { id: 'V-LM.5',  what: 'Dependency Freshness',          target: '0 deps > 12 months stale' },
  { id: 'V-LM.6',  what: 'Test Coverage',                 target: 'FE ≥ 70%, BE ≥ 80%' },
  { id: 'V-LM.7',  what: 'Flaky Test Rate',               target: '< 1% flaky' },
  { id: 'V-LM.8',  what: 'Bundle Size Delta per PR',      target: '90% PRs neutral/negative' },
  { id: 'V-LM.9',  what: 'Onboarding Time',               target: '≤ 1 working day' },
  { id: 'V-LM.10', what: 'Feature Velocity',              target: 'not declining > 20% QoQ' },
  { id: 'V-LM.11', what: 'Documentation Freshness',       target: '< 20% docs > 90d stale' },
  { id: 'V-LM.12', what: 'ADR Compliance',                target: '≥ 90% on significant PRs' },
];

/**
 * Find the latest probes-*.json in audit/probes/.
 * @returns {Promise<{ path: string; data: any } | null>}
 */
async function loadLatestProbes() {
  try {
    const entries = await readdir(PROBES_DIR).catch(() => []);
    const candidates = entries
      .filter((f) => /^probes-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
    if (candidates.length === 0) return null;
    const path = resolve(PROBES_DIR, candidates[candidates.length - 1]);
    const data = JSON.parse(await readFile(path, 'utf8'));
    return { path, data };
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ rows: Record<string, ScorecardRow>; generated: string } | null>}
 */
async function loadPreviousScorecard() {
  try {
    const text = await readFile(resolve(SCORECARDS_DIR, 'scorecard-PREV.json'), 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @param {number | null | undefined} cur
 * @param {number | null | undefined} prev
 * @returns {'up' | 'down' | 'flat' | '?'}
 */
function trendOf(cur, prev) {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return '?';
  const delta = cur - prev;
  if (Math.abs(delta) < 1e-9) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/**
 * Build the 12 V-PR rows. If no probes file is present, all are "TBD".
 * @param {any | null} probes
 * @param {Record<string, ScorecardRow> | null} prevRows
 * @returns {ScorecardRow[]}
 */
function buildVprRows(probes, prevRows) {
  /** @type {ScorecardRow[]} */
  const rows = [];
  for (const def of VPR_DEFINITIONS) {
    const probe = probes?.[def.id] ?? null;
    /** @type {ScorecardRow} */
    const row = {
      id: def.id,
      what: def.what,
      target: def.target,
      current: probe?.current_display ?? 'TBD',
      trend: trendOf(probe?.current_value, prevRows?.[def.id]?.['current_value']),
      status: probe?.status ?? 'unknown',
      first_red_at: prevRows?.[def.id]?.first_red_at ?? null,
      runbook: def.runbook,
    };
    if (probe?.current_value != null) {
      // @ts-expect-error preserve numeric for next-run trend
      row.current_value = probe.current_value;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Build the 12 V-LM rows from the sub-script outputs.
 * @param {object} ctx
 * @param {Awaited<ReturnType<typeof buildMaintainability>>} ctx.maint
 * @param {Awaited<ReturnType<typeof buildFlakes>>} ctx.flakes
 * @param {Awaited<ReturnType<typeof buildVelocity>>} ctx.velocity
 * @param {Awaited<ReturnType<typeof buildAdr>>} ctx.adr
 * @param {Record<string, ScorecardRow> | null} prevRows
 * @returns {ScorecardRow[]}
 */
function buildVlmRows(ctx, prevRows) {
  const { maint, flakes, velocity, adr } = ctx;
  const s = maint.sections;

  /**
   * @param {string} id
   * @param {string} current
   * @param {number | null} currentValue
   * @param {'green'|'yellow'|'red'|'unknown'} status
   * @returns {ScorecardRow}
   */
  function mk(id, current, currentValue, status) {
    const def = VLM_DEFINITIONS.find((d) => d.id === id);
    if (!def) throw new Error(`No V-LM def for ${id}`);
    /** @type {ScorecardRow} */
    const row = {
      id,
      what: def.what,
      target: def.target,
      current,
      trend: trendOf(currentValue, prevRows?.[id]?.['current_value']),
      status,
      first_red_at: prevRows?.[id]?.first_red_at ?? null,
    };
    if (currentValue != null) {
      // @ts-expect-error preserve numeric for next-run trend
      row.current_value = currentValue;
    }
    return row;
  }

  /** @type {ScorecardRow[]} */
  const rows = [];

  rows.push(mk(
    'V-LM.1',
    `${s.loc.count_over_400} > 400, ${s.loc.count_over_600} > 600 LOC`,
    s.loc.count_over_600,
    s.loc.status
  ));

  rows.push(mk(
    'V-LM.2',
    s.complexity.frontend.ok
      ? `${s.complexity.frontend.violations} FE violations / ${s.complexity.backend.ok ? s.complexity.backend.grade_c_or_worse + ' BE C+' : 'BE skipped'}`
      : `FE skipped: ${s.complexity.frontend.warning ?? ''}`,
    s.complexity.frontend.ok ? s.complexity.frontend.violations : null,
    s.complexity.frontend.ok ? (/** @type {any} */(s.complexity.frontend).status ?? 'green') : 'unknown'
  ));

  // V-LM.3 not yet implemented (eslint-plugin-sonarjs) — mark unknown.
  rows.push(mk('V-LM.3', 'TBD (sonarjs not wired)', null, 'unknown'));

  rows.push(mk(
    'V-LM.4',
    s.dead_code.frontend_warning
      ? `skipped: ${s.dead_code.frontend_warning}`
      : `${s.dead_code.frontend_count} unused FE, ${s.dead_code.backend_count} BE${s.dead_code.dead_percent != null ? ` (${s.dead_code.dead_percent}%)` : ''}`,
    s.dead_code.dead_percent,
    s.dead_code.status
  ));

  rows.push(mk(
    'V-LM.5',
    `${s.dependency_freshness.total_stale} / ${s.dependency_freshness.total_deps} deps > 12mo stale`,
    s.dependency_freshness.total_stale,
    s.dependency_freshness.status
  ));

  const feCov = s.test_coverage.frontend.ok ? `FE ${s.test_coverage.frontend.lines_pct}%` : `FE n/a`;
  const beCov = s.test_coverage.backend.ok ? `BE ${s.test_coverage.backend.lines_pct}%` : `BE n/a`;
  rows.push(mk('V-LM.6', `${feCov}, ${beCov}`, s.test_coverage.frontend.lines_pct ?? null, s.test_coverage.status));

  rows.push(mk(
    'V-LM.7',
    flakes.skipped ? `skipped: ${flakes.reason}` : `${flakes.flaky_count} flaky / ${flakes.total_tests} tests`,
    flakes.skipped ? null : flakes.flaky_count,
    flakes.skipped ? 'unknown' : (flakes.status ?? 'green')
  ));

  // V-LM.8 — bundle-diff per PR. Reads a recent artifact if present;
  // otherwise unknown. Looks for audit/maintainability/bundle-diff-*.json.
  rows.push(mk('V-LM.8', 'TBD (bundle-diff workflow runs on PR, not here)', null, 'unknown'));

  // V-LM.9 — onboarding. Quarterly exercise — no automated metric.
  rows.push(mk('V-LM.9', 'TBD (quarterly exercise)', null, 'unknown'));

  rows.push(mk(
    'V-LM.10',
    velocity.skipped
      ? `skipped: ${velocity.reason}`
      : `${velocity.windows['30d'].prs_per_week} PRs/wk, QoQ ${velocity.quarter_over_quarter_pct ?? '?'}%`,
    velocity.skipped ? null : velocity.windows['30d'].prs_per_week,
    velocity.skipped ? 'unknown' : (velocity.status ?? 'green')
  ));

  rows.push(mk(
    'V-LM.11',
    `${s.doc_freshness.stale_count}/${s.doc_freshness.scanned} (${s.doc_freshness.stale_percent}%) stale`,
    s.doc_freshness.stale_percent,
    s.doc_freshness.status
  ));

  rows.push(mk(
    'V-LM.12',
    adr.skipped
      ? `skipped: ${adr.reason}`
      : `${adr.compliance_percent}% (${adr.compliant_count}/${adr.compliant_count + adr.flagged_count})`,
    adr.skipped ? null : adr.compliance_percent,
    adr.skipped ? 'unknown' : (adr.status ?? 'green')
  ));

  return rows;
}

/**
 * Update first_red_at on each row based on its (new) status and the previous row.
 * @param {ScorecardRow[]} rows
 * @param {Record<string, ScorecardRow> | null} prevRows
 * @param {string} now
 */
function stampRedTimestamps(rows, prevRows, now) {
  for (const r of rows) {
    if (r.status === 'red') {
      // If previously red, keep the original timestamp. Otherwise stamp now.
      if (prevRows?.[r.id]?.status === 'red' && prevRows[r.id].first_red_at) {
        r.first_red_at = prevRows[r.id].first_red_at;
      } else {
        r.first_red_at = now;
      }
    } else {
      r.first_red_at = null;
    }
  }
}

/** @param {ScorecardRow['status']} s */
function statusEmoji(s) {
  return s === 'green' ? '🟢' : s === 'yellow' ? '🟡' : s === 'red' ? '🔴' : '⚪';
}

/** @param {ScorecardRow['trend']} t */
function trendEmoji(t) {
  return t === 'up' ? '⬆' : t === 'down' ? '⬇' : t === 'flat' ? '➡' : '·';
}

/**
 * @param {ScorecardRow[]} rows
 * @param {string} now
 */
function verdict(rows, now) {
  const greens = rows.filter((r) => r.status === 'green').length;
  const reds = rows.filter((r) => r.status === 'red');
  const stuckReds = reds.filter((r) => {
    if (!r.first_red_at) return false;
    const ageDays = (Date.parse(now) - Date.parse(r.first_red_at)) / 86_400_000;
    return ageDays > RED_THRESHOLD_DAYS;
  });

  const worldClass = greens >= 22 && stuckReds.length === 0;
  return {
    greens_count: greens,
    total: rows.length,
    reds_count: reds.length,
    stuck_reds_count: stuckReds.length,
    is_world_class: worldClass,
    line: worldClass
      ? `🌟 **WORLD-CLASS** — ${greens}/${rows.length} green, no red metric stuck > ${RED_THRESHOLD_DAYS} days.`
      : `**NOT YET** — ${greens}/${rows.length} green; ${stuckReds.length} red metric(s) stuck > ${RED_THRESHOLD_DAYS} days.`,
  };
}

/**
 * @param {ScorecardRow[]} vpr
 * @param {ScorecardRow[]} vlm
 * @param {ReturnType<typeof verdict>} v
 * @param {string} now
 */
function renderMarkdown(vpr, vlm, v, now) {
  const L = [];
  L.push('# World-Class Readiness Scorecard');
  L.push('');
  L.push(`_Last updated: \`${now}\` — regenerated weekly by \`scripts/world-class-scorecard.mjs\`._`);
  L.push('');
  L.push(`## Verdict`);
  L.push('');
  L.push(v.line);
  L.push('');
  L.push('## Part 1 — Production Reality (V-PR.1–12)');
  L.push('');
  L.push('| ID | What | Target | Current (28d) | Trend | Status | Runbook |');
  L.push('| --- | --- | --- | --- | :---: | :---: | --- |');
  for (const r of vpr) {
    L.push(
      `| ${r.id} | ${r.what} | ${r.target} | ${r.current} | ${trendEmoji(r.trend)} | ${statusEmoji(r.status)} | ${r.runbook ? `[link](${r.runbook})` : '—'} |`
    );
  }
  L.push('');
  L.push('## Part 2 — Long-term Maintainability (V-LM.1–12)');
  L.push('');
  L.push('| ID | What | Target | Current | Trend | Status |');
  L.push('| --- | --- | --- | --- | :---: | :---: |');
  for (const r of vlm) {
    L.push(`| ${r.id} | ${r.what} | ${r.target} | ${r.current} | ${trendEmoji(r.trend)} | ${statusEmoji(r.status)} |`);
  }
  L.push('');
  L.push('## How to read this');
  L.push('');
  L.push('- 🟢 green = current value meets target. 🟡 yellow = within 1 band of target. 🔴 red = over target.');
  L.push('- ⚪ unknown = the probe/script hasn\'t been wired yet or returned no data.');
  L.push('- Trend ⬆/⬇/➡ compares this run to the most recent prior run stored in `audit/scorecards/scorecard-PREV.json`.');
  L.push('- The "WORLD-CLASS" verdict requires **≥ 22/24 green** AND **no red metric older than 14 days**.');
  L.push('- See `docs/world-class/scorecard-explainer.md` for the rationale behind each metric and triage guidance.');
  L.push('');
  return L.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipProbes = args.includes('--no-probes');

  const now = new Date().toISOString();

  // 1) Load previous scorecard FIRST (before we overwrite scorecard-PREV.json).
  const prev = await loadPreviousScorecard();
  const prevRows = prev?.rows ?? null;

  // 2) Run all sub-reports in parallel — each is independently graceful.
  const [maint, flakes, velocity, adr, probesRes] = await Promise.all([
    buildMaintainability(),
    buildFlakes(),
    buildVelocity(),
    buildAdr(),
    skipProbes ? Promise.resolve(null) : loadLatestProbes(),
  ]);

  const probesData = probesRes?.data ?? null;

  // 3) Build the 24 rows.
  const vprRows = buildVprRows(probesData, prevRows);
  const vlmRows = buildVlmRows({ maint, flakes, velocity, adr }, prevRows);

  // 4) Stamp first_red_at based on previous state.
  stampRedTimestamps(vprRows, prevRows, now);
  stampRedTimestamps(vlmRows, prevRows, now);

  // 5) Compute verdict.
  const allRows = [...vprRows, ...vlmRows];
  const v = verdict(allRows, now);

  // 6) Render markdown.
  const md = renderMarkdown(vprRows, vlmRows, v, now);

  // 7) Persist.
  if (!dryRun) {
    await mkdir(dirname(SCORECARD_OUT), { recursive: true });
    await writeFile(SCORECARD_OUT, md);

    await mkdir(SCORECARDS_DIR, { recursive: true });
    /** @type {Record<string, ScorecardRow>} */
    const rowsByid = {};
    for (const r of allRows) rowsByid[r.id] = r;
    const stateForNextRun = {
      generated: now,
      rows: rowsByid,
      verdict: v,
      probes_source: probesRes?.path ?? null,
    };
    const today = now.slice(0, 10);
    await writeFile(
      resolve(SCORECARDS_DIR, `scorecard-${today}.json`),
      JSON.stringify(stateForNextRun, null, 2)
    );
    await writeFile(
      resolve(SCORECARDS_DIR, 'scorecard-PREV.json'),
      JSON.stringify(stateForNextRun, null, 2)
    );
  }

  // Stdout: scorecard markdown (so workflows can capture it).
  process.stdout.write(md);
  if (!md.endsWith('\n')) process.stdout.write('\n');
}

const isDirect = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}` ||
      import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
  } catch {
    return false;
  }
})();

if (isDirect) {
  main().catch((err) => {
    console.error('[world-class-scorecard] error:', err?.stack || err);
    process.exit(1);
  });
}
