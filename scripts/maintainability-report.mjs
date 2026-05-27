#!/usr/bin/env node
// @ts-check
/**
 * maintainability-report.mjs (T-V.3, V-LM.1 / V-LM.2 / V-LM.4 / V-LM.5 / V-LM.6 / V-LM.11)
 *
 * Multi-section maintainability analysis. Each section is independent and
 * gracefully degrades — missing tools log a warning but never break the
 * report.
 *
 * Sections:
 *   1. LOC (V-LM.1) — wraps scripts/audit-loc.mjs to count files > 400 / > 600.
 *   2. Complexity (V-LM.2) — frontend ESLint complexity rule (≤ 15), backend radon.
 *   3. Dead code (V-LM.4) — ts-prune + vulture (graceful skip).
 *   4. Doc freshness (V-LM.11) — delegates to scripts/doc-freshness.mjs.
 *   5. Dependency freshness (V-LM.5) — `npm outdated` + delegates to dependency-age-audit.
 *   6. Test coverage (V-LM.6) — reads coverage/coverage-summary.json (Vitest) +
 *      backend/coverage.xml (pytest-cov).
 *
 * Output:
 *   - JSON to stdout (default) — the scorecard consumes this.
 *   - `--markdown` prints markdown to stdout instead.
 *   - Always also writes `audit/maintainability/report-{ISO-DATE}.md` and
 *     `audit/maintainability/report-{ISO-DATE}.json`.
 *
 * Exit code: 0 unless an internal error occurs. This is observability,
 * not a gate.
 */

import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildReport as buildDocFreshness } from './doc-freshness.mjs';
import { buildReport as buildDeadCode } from './dead-code-report.mjs';
import { buildReport as buildDepAge } from './dependency-age-audit.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..');

/**
 * Section 1 — LOC. Re-imports audit-loc.mjs's watchlist JSON if it exists,
 * otherwise runs audit-loc.mjs and re-reads it.
 */
async function locSection() {
  const watchlistPath = resolve(REPO_ROOT, 'docs', 'audit', 'monolith-watchlist.json');
  /** @type {{ count_over_400: number; count_over_600: number; worst: { path: string; loc: number }[]; status: 'green'|'yellow'|'red'; warning?: string }} */
  let result = { count_over_400: 0, count_over_600: 0, worst: [], status: 'green' };
  try {
    let raw;
    try {
      raw = await readFile(watchlistPath, 'utf8');
    } catch {
      // Run audit-loc to regenerate.
      const r = spawnSync(process.execPath, [resolve(REPO_ROOT, 'scripts', 'audit-loc.mjs')], {
        cwd: REPO_ROOT, encoding: 'utf8',
      });
      if (r.status !== 0) {
        return { ...result, warning: `audit-loc.mjs exit ${r.status}` };
      }
      raw = await readFile(watchlistPath, 'utf8');
    }
    const data = JSON.parse(raw);
    /** @type {{ path: string; loc: number; exempt?: boolean }[]} */
    // audit-loc.mjs writes { generatedAt, thresholds, totalFilesScanned, watchlist: [...] }
    // — accept all known shapes (array | {files} | {watchlist}).
    const files = Array.isArray(data)
      ? data
      : (data.watchlist ?? data.files ?? []);
    // Filter out files explicitly marked exempt via the monolith-budget-exempt marker.
    const nonExempt = files.filter((f) => !f.exempt);
    const over400 = nonExempt.filter((f) => f.loc > 400).length;
    const over600 = nonExempt.filter((f) => f.loc > 600).length;
    const worst = nonExempt
      .slice()
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 10)
      .map((f) => ({ path: f.path, loc: f.loc }));

    /** @type {'green'|'yellow'|'red'} */
    let status = 'green';
    if (over600 > 20) status = 'red';
    else if (over600 > 0) status = 'yellow';

    result = { count_over_400: over400, count_over_600: over600, worst, status };
  } catch (e) {
    result.warning = e instanceof Error ? e.message : String(e);
  }
  return result;
}

/**
 * Section 2a — Frontend cyclomatic complexity via ESLint built-in rule.
 */
async function frontendComplexitySection() {
  const r = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      '-y', '--no-install',
      'eslint',
      '--no-eslintrc',
      '--rule', '{"complexity":["error",15]}',
      '--format', 'json',
      'frontend/src/**/*.{ts,tsx}',
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (r.error && /ENOENT/.test(r.error.message)) {
    return { ok: false, violations: 0, warning: 'eslint not available' };
  }
  try {
    const data = JSON.parse(r.stdout || '[]');
    /** @type {{ filePath: string; messages: { ruleId: string; line: number; message: string }[] }[]} */
    const files = data;
    /** @type {{ file: string; line: number; message: string }[]} */
    const violations = [];
    for (const f of files) {
      for (const m of f.messages || []) {
        if (m.ruleId === 'complexity') {
          violations.push({ file: f.filePath, line: m.line, message: m.message });
        }
      }
    }
    /** @type {'green'|'yellow'|'red'} */
    let status = 'green';
    if (violations.length > 20) status = 'red';
    else if (violations.length > 5) status = 'yellow';
    return {
      ok: true,
      violations: violations.length,
      sample: violations.slice(0, 20),
      status,
    };
  } catch (e) {
    return {
      ok: false,
      violations: 0,
      warning: `ESLint parse failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Section 2b — Backend complexity via radon.
 */
async function backendComplexitySection() {
  const r = spawnSync('radon', ['cc', 'backend/app', '-a', '-nc'], {
    cwd: REPO_ROOT, encoding: 'utf8',
  });
  if (r.error && /ENOENT/.test(r.error.message)) {
    return { ok: false, warning: 'radon not installed — `pip install radon`' };
  }
  const out = r.stdout || '';
  // radon's `-a` summary line: "Average complexity: A (3.21)"
  const avgMatch = out.match(/Average complexity:\s+([A-F])\s+\(([\d.]+)\)/);
  // -nc filters to functions of grade C or worse; count those lines.
  const lines = out.split(/\r?\n/).filter((l) => /^\s+[A-Z]\s+\d+:\d+/.test(l));
  return {
    ok: true,
    average_grade: avgMatch?.[1] ?? null,
    average_score: avgMatch ? Number(avgMatch[2]) : null,
    grade_c_or_worse: lines.length,
    sample: lines.slice(0, 20),
    status: lines.length > 10 ? 'yellow' : lines.length > 0 ? 'green' : 'green',
  };
}

/**
 * Section 6 — Test coverage. Reads Vitest c8 + pytest-cov.
 */
async function coverageSection() {
  /** @type {{ frontend: { ok: boolean; lines_pct?: number; branches_pct?: number; warning?: string }; backend: { ok: boolean; lines_pct?: number; warning?: string }; status: 'green'|'yellow'|'red' }} */
  const result = {
    frontend: { ok: false, warning: 'coverage/coverage-summary.json not found' },
    backend: { ok: false, warning: 'backend/coverage.xml not found' },
    status: 'red',
  };

  // Frontend — c8/Vitest writes coverage-summary.json
  for (const candidate of [
    resolve(REPO_ROOT, 'frontend', 'coverage', 'coverage-summary.json'),
    resolve(REPO_ROOT, 'coverage', 'coverage-summary.json'),
  ]) {
    try {
      const text = await readFile(candidate, 'utf8');
      const data = JSON.parse(text);
      const total = data.total ?? {};
      result.frontend = {
        ok: true,
        lines_pct: Number(total.lines?.pct ?? total.statements?.pct ?? 0),
        branches_pct: Number(total.branches?.pct ?? 0),
      };
      break;
    } catch { /* keep going */ }
  }

  // Backend — pytest-cov writes coverage.xml
  for (const candidate of [
    resolve(REPO_ROOT, 'backend', 'coverage.xml'),
    resolve(REPO_ROOT, 'coverage.xml'),
  ]) {
    try {
      const text = await readFile(candidate, 'utf8');
      // <coverage ... line-rate="0.834" ...>
      const m = text.match(/<coverage[^>]+line-rate="([\d.]+)"/);
      if (m) {
        result.backend = { ok: true, lines_pct: Math.round(Number(m[1]) * 1000) / 10 };
        break;
      }
    } catch { /* keep going */ }
  }

  const feOk = result.frontend.ok && (result.frontend.lines_pct ?? 0) >= 70;
  const beOk = result.backend.ok && (result.backend.lines_pct ?? 0) >= 80;
  if (feOk && beOk) result.status = 'green';
  else if (feOk || beOk) result.status = 'yellow';
  else result.status = 'red';

  return result;
}

/**
 * Section 5 — `npm outdated --json` summary (one-shot, all-deps).
 * Used in addition to dependency-age-audit for a quick top-level number.
 */
async function npmOutdatedSection() {
  const r = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['outdated', '--json'],
    { cwd: resolve(REPO_ROOT, 'frontend'), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  if (r.error && /ENOENT/.test(r.error.message)) {
    return { ok: false, warning: 'npm not installed' };
  }
  // npm outdated exits 1 when there are outdated deps — that's normal.
  try {
    const data = JSON.parse(r.stdout || '{}');
    const total = Object.keys(data).length;
    return { ok: true, total_outdated: total };
  } catch {
    return { ok: true, total_outdated: 0 };
  }
}

async function buildReport() {
  const [loc, feComplex, beComplex, dead, depAge, docs, coverage, npmOut] = await Promise.all([
    locSection(),
    frontendComplexitySection(),
    backendComplexitySection(),
    buildDeadCode(),
    buildDepAge({ offline: process.env.MAINTAINABILITY_OFFLINE === '1' }),
    buildDocFreshness(),
    coverageSection(),
    npmOutdatedSection(),
  ]);

  return {
    generated: new Date().toISOString(),
    sections: {
      loc,
      complexity: { frontend: feComplex, backend: beComplex },
      dead_code: {
        frontend_count: dead.frontend.count,
        backend_count: dead.backend.count,
        dead_percent: dead.dead_percent,
        status: dead.status,
        frontend_warning: dead.frontend.warning,
        backend_warning: dead.backend.warning,
      },
      doc_freshness: {
        scanned: docs.scanned,
        stale_count: docs.stale_count,
        stale_percent: docs.stale_percent,
        status: docs.status,
        oldest: docs.oldest,
      },
      dependency_freshness: {
        npm_outdated_total: npmOut.ok ? npmOut.total_outdated : null,
        npm_outdated_warning: npmOut.ok ? undefined : npmOut.warning,
        total_deps: depAge.total_deps,
        total_stale: depAge.total_stale,
        status: depAge.status,
      },
      test_coverage: coverage,
    },
  };
}

/**
 * @param {Awaited<ReturnType<typeof buildReport>>} r
 */
function toMarkdown(r) {
  const s = r.sections;
  const L = [];
  L.push('# Maintainability Report');
  L.push('');
  L.push(`- Generated: \`${r.generated}\``);
  L.push('');
  L.push('## V-LM.1 — File Size (LOC)');
  L.push('');
  L.push(`- Files > 400 LOC: **${s.loc.count_over_400}**`);
  L.push(`- Files > 600 LOC: **${s.loc.count_over_600}**`);
  L.push(`- Status: ${emoji(s.loc.status)} ${s.loc.status}`);
  if (s.loc.worst.length > 0) {
    L.push('');
    L.push('Worst 10:');
    L.push('');
    L.push('| LOC | Path |');
    L.push('| ---: | --- |');
    for (const w of s.loc.worst) L.push(`| ${w.loc} | \`${w.path}\` |`);
  }
  L.push('');
  L.push('## V-LM.2 — Cyclomatic Complexity');
  L.push('');
  L.push('### Frontend (ESLint, threshold 15)');
  if (s.complexity.frontend.ok) {
    L.push(`- Violations: **${s.complexity.frontend.violations}**`);
    L.push(`- Status: ${emoji(s.complexity.frontend.status ?? 'green')}`);
  } else {
    L.push(`- _Skipped_: ${s.complexity.frontend.warning}`);
  }
  L.push('');
  L.push('### Backend (radon, grade C+)');
  if (s.complexity.backend.ok) {
    L.push(`- Average grade: ${s.complexity.backend.average_grade ?? '?'} (${s.complexity.backend.average_score ?? '?'})`);
    L.push(`- Functions ≥ grade C: **${s.complexity.backend.grade_c_or_worse}**`);
  } else {
    L.push(`- _Skipped_: ${s.complexity.backend.warning}`);
  }
  L.push('');
  L.push('## V-LM.4 — Dead Code');
  L.push('');
  L.push(`- Frontend (ts-prune): ${s.dead_code.frontend_warning ? `_skipped: ${s.dead_code.frontend_warning}_` : `**${s.dead_code.frontend_count}** unused exports`}`);
  L.push(`- Backend (vulture): ${s.dead_code.backend_warning ? `_skipped: ${s.dead_code.backend_warning}_` : `**${s.dead_code.backend_count}** findings`}`);
  if (s.dead_code.dead_percent != null) L.push(`- Dead %: **${s.dead_code.dead_percent}%**`);
  L.push(`- Status: ${emoji(s.dead_code.status)}`);
  L.push('');
  L.push('## V-LM.5 — Dependency Freshness');
  L.push('');
  L.push(`- Total tracked deps: ${s.dependency_freshness.total_deps}`);
  L.push(`- Stale (> 365d): **${s.dependency_freshness.total_stale}**`);
  if (s.dependency_freshness.npm_outdated_total != null)
    L.push(`- npm outdated: ${s.dependency_freshness.npm_outdated_total}`);
  L.push(`- Status: ${emoji(s.dependency_freshness.status)}`);
  L.push('');
  L.push('## V-LM.6 — Test Coverage');
  L.push('');
  L.push(`- Frontend (Vitest): ${s.test_coverage.frontend.ok ? `**${s.test_coverage.frontend.lines_pct}%** lines / ${s.test_coverage.frontend.branches_pct}% branches` : `_${s.test_coverage.frontend.warning}_`}`);
  L.push(`- Backend (pytest-cov): ${s.test_coverage.backend.ok ? `**${s.test_coverage.backend.lines_pct}%** lines` : `_${s.test_coverage.backend.warning}_`}`);
  L.push(`- Status: ${emoji(s.test_coverage.status)}`);
  L.push('');
  L.push('## V-LM.11 — Doc Freshness');
  L.push('');
  L.push(`- Docs scanned: ${s.doc_freshness.scanned}`);
  L.push(`- Stale (> 90d): **${s.doc_freshness.stale_count}** (${s.doc_freshness.stale_percent}%)`);
  L.push(`- Status: ${emoji(s.doc_freshness.status)}`);
  L.push('');
  return L.join('\n');
}

/** @param {string} s */
function emoji(s) {
  return s === 'green' ? '🟢' : s === 'yellow' ? '🟡' : s === 'red' ? '🔴' : '⚪';
}

async function main() {
  const args = process.argv.slice(2);
  const wantMarkdown = args.includes('--markdown');
  const skipWrite = args.includes('--no-write');

  const r = await buildReport();

  if (!skipWrite) {
    const today = new Date().toISOString().slice(0, 10);
    const dir = resolve(REPO_ROOT, 'audit', 'maintainability');
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `report-${today}.md`), toMarkdown(r));
    await writeFile(resolve(dir, `report-${today}.json`), JSON.stringify(r, null, 2));
  }

  if (wantMarkdown) process.stdout.write(toMarkdown(r) + '\n');
  else process.stdout.write(JSON.stringify(r, null, 2) + '\n');
}

export { buildReport, toMarkdown };

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
    console.error('[maintainability-report] error:', err?.stack || err);
    process.exit(1);
  });
}
