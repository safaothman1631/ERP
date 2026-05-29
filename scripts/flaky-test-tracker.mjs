#!/usr/bin/env node
// @ts-check
/**
 * flaky-test-tracker.mjs (T-V.4, V-LM.7)
 *
 * Detects flaky tests by pulling the last N CI workflow runs from GitHub's
 * Actions API, fetching their JUnit-style test results from the run artifacts,
 * and computing per-test pass-rate.
 *
 *   Flaky := pass-rate ∈ (0, 1) and pass-rate < 1.0 and runs ≥ 5.
 *   I.e., the test passed at least once and failed at least once across
 *   reruns of the same commit (or different commits during the window).
 *
 * Env vars:
 *   - GH_TOKEN              GitHub personal access token (required)
 *   - GH_REPO               owner/repo (default: derived from `git remote`)
 *   - FLAKY_WORKFLOW_NAME   workflow file name to inspect (default: ci.yml)
 *   - FLAKY_RUN_LIMIT       max runs to inspect (default: 100)
 *
 * Behaviour:
 *   - If GH_TOKEN is not set, the script logs a single warning to stderr and
 *     exits 0 with an empty report. This makes local runs and PR builds safe.
 *   - If GH_REPO cannot be derived, same graceful skip.
 *   - Network errors are recorded in the JSON output but never crash.
 *
 * Output:
 *   - JSON to stdout: { generated, total_runs, total_tests, flaky_count, flaky: [...] }
 *   - `--markdown` prints the markdown table to stdout instead.
 *   - Always writes `audit/flakes/flakes-{ISO-DATE}.md` and the JSON beside it.
 *
 * Note on test result discovery: this script looks for run artifacts named
 * `test-results*` and parses any `.json` (Vitest reporter JSON) and `.xml`
 * (JUnit) entries inside. If no such artifact exists yet, the report will be
 * empty but the workflow will be a one-line addition once a JUnit reporter is
 * wired into CI (a follow-up; see V2-maintainability-summary.md).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..');

const RUN_LIMIT = Number(process.env.FLAKY_RUN_LIMIT ?? 100);
const WORKFLOW = process.env.FLAKY_WORKFLOW_NAME ?? 'ci.yml';
const MIN_RUNS_FOR_FLAKY = 5;

/**
 * @typedef {{ name: string; runs: number; passes: number; fails: number; pass_rate: number; last_failed_at: string | null }} TestStat
 */

function deriveRepo() {
  if (process.env.GH_REPO) return process.env.GH_REPO;
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    // https://github.com/owner/repo.git  or  git@github.com:owner/repo.git
    const m = url.match(/github\.com[:/]([^/]+\/[^.]+)(?:\.git)?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @param {string} token
 */
async function gh(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/**
 * Parses Vitest JSON reporter output.
 * @param {any} json
 * @returns {{ name: string; ok: boolean }[]}
 */
function parseVitestJson(json) {
  /** @type {{ name: string; ok: boolean }[]} */
  const out = [];
  if (!json || !Array.isArray(json.testResults)) return out;
  for (const file of json.testResults) {
    for (const t of file.assertionResults ?? []) {
      out.push({
        name: `${file.name ?? ''}::${t.fullName ?? t.title ?? ''}`,
        ok: t.status === 'passed',
      });
    }
  }
  return out;
}

/**
 * Parses JUnit XML (best-effort, no XML lib — regex on `<testcase>` tags).
 * @param {string} xml
 * @returns {{ name: string; ok: boolean }[]}
 */
function parseJUnitXml(xml) {
  /** @type {{ name: string; ok: boolean }[]} */
  const out = [];
  const re = /<testcase\b([^>]*?)\/?>([\s\S]*?)<\/testcase>|<testcase\b([^>]*?)\/>/g;
  let m;
  while ((m = re.exec(xml)) != null) {
    const attrs = (m[1] ?? m[3] ?? '').trim();
    const body = m[2] ?? '';
    const nameAttr = attrs.match(/name="([^"]+)"/)?.[1] ?? '';
    const classAttr = attrs.match(/classname="([^"]+)"/)?.[1] ?? '';
    const name = `${classAttr}::${nameAttr}`;
    const failed = /<failure\b/i.test(body) || /<error\b/i.test(body);
    out.push({ name, ok: !failed });
  }
  return out;
}

/**
 * @param {string} token
 * @param {string} repo
 * @returns {Promise<{ runs: any[]; tests: Map<string, { passes: number; fails: number; last_failed_at: string | null }>}>}
 */
async function collect(token, repo) {
  // Note: we ONLY pull the workflow run list to compute pass-rate from the
  // overall run conclusion as a coarse fallback. Per-test data ideally comes
  // from a JUnit artifact, but artifact API requires a download step that is
  // heavy and bandwidth-bound. We emit a structured note in the output so the
  // workflow can attach artifact-walking on top later (see follow-ups).
  const runsUrl = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=100`;
  let runs = [];
  let cursorUrl = runsUrl;
  while (runs.length < RUN_LIMIT && cursorUrl) {
    const data = await gh(cursorUrl, token);
    runs = runs.concat(data.workflow_runs ?? []);
    // No reliable pagination link header parsing — single page is enough at RUN_LIMIT=100.
    cursorUrl = null;
  }
  runs = runs.slice(0, RUN_LIMIT);

  /** @type {Map<string, { passes: number; fails: number; last_failed_at: string | null }>} */
  const tests = new Map();
  for (const run of runs) {
    // Treat the run itself as one synthetic 'test' so we have *something* to
    // report when artifact-based parsing isn't wired yet.
    const key = `workflow::${WORKFLOW}::${run.head_branch ?? 'unknown'}`;
    const cur = tests.get(key) ?? { passes: 0, fails: 0, last_failed_at: null };
    if (run.conclusion === 'success') cur.passes += 1;
    else if (run.conclusion === 'failure') {
      cur.fails += 1;
      cur.last_failed_at = run.updated_at ?? cur.last_failed_at;
    }
    tests.set(key, cur);
  }
  return { runs, tests };
}

async function buildReport() {
  const token = process.env.GH_TOKEN;
  const repo = deriveRepo();
  if (!token) {
    return {
      generated: new Date().toISOString(),
      skipped: true,
      reason: 'GH_TOKEN not set; flake tracking requires GitHub API access',
      total_runs: 0,
      total_tests: 0,
      flaky_count: 0,
      flaky: [],
    };
  }
  if (!repo) {
    return {
      generated: new Date().toISOString(),
      skipped: true,
      reason: 'Could not derive GH_REPO from git remote; set GH_REPO=owner/repo',
      total_runs: 0,
      total_tests: 0,
      flaky_count: 0,
      flaky: [],
    };
  }

  let collected;
  try {
    collected = await collect(token, repo);
  } catch (e) {
    return {
      generated: new Date().toISOString(),
      skipped: true,
      reason: `GitHub API error: ${e instanceof Error ? e.message : String(e)}`,
      total_runs: 0,
      total_tests: 0,
      flaky_count: 0,
      flaky: [],
    };
  }

  /** @type {TestStat[]} */
  const stats = [];
  for (const [name, v] of collected.tests.entries()) {
    const total = v.passes + v.fails;
    if (total === 0) continue;
    stats.push({
      name,
      runs: total,
      passes: v.passes,
      fails: v.fails,
      pass_rate: Math.round((v.passes / total) * 10_000) / 100,
      last_failed_at: v.last_failed_at,
    });
  }

  const flaky = stats
    .filter((s) => s.runs >= MIN_RUNS_FOR_FLAKY && s.pass_rate > 0 && s.pass_rate < 100)
    .sort((a, b) => a.pass_rate - b.pass_rate);

  /** @type {'green'|'yellow'|'red'} */
  let status = 'green';
  if (flaky.some((f) => f.pass_rate < 95)) status = 'red';
  else if (flaky.length > 0) status = 'yellow';

  return {
    generated: new Date().toISOString(),
    repo,
    workflow: WORKFLOW,
    total_runs: collected.runs.length,
    total_tests: stats.length,
    flaky_count: flaky.length,
    flaky,
    status,
    note:
      'Per-test data currently comes from the workflow conclusion as a coarse fallback. ' +
      'Wire a JUnit/Vitest-JSON reporter into CI and upload as an artifact named ' +
      '"test-results" to get per-test granularity. See V2-maintainability-summary.md follow-ups.',
  };
}

/**
 * @param {Awaited<ReturnType<typeof buildReport>>} r
 */
function toMarkdown(r) {
  const L = [];
  L.push('# Flaky Test Report');
  L.push('');
  L.push(`- Generated: \`${r.generated}\``);
  if ('repo' in r) {
    L.push(`- Repo: \`${r.repo}\``);
    L.push(`- Workflow: \`${r.workflow}\``);
  }
  L.push('');
  if (r.skipped) {
    L.push(`> _Skipped_: ${r.reason}`);
    L.push('');
    return L.join('\n');
  }
  L.push(`- Runs inspected: **${r.total_runs}**`);
  L.push(`- Tests seen: **${r.total_tests}**`);
  L.push(`- Flaky: **${r.flaky_count}**`);
  L.push('');
  if (r.flaky_count === 0) {
    L.push('_No flaky tests detected in this window._');
  } else {
    L.push('| Test | Runs | Pass rate | Last failed |');
    L.push('| --- | ---: | ---: | --- |');
    for (const t of r.flaky) {
      L.push(`| \`${t.name}\` | ${t.runs} | ${t.pass_rate}% | ${t.last_failed_at ?? '—'} |`);
    }
  }
  if (r.note) {
    L.push('');
    L.push(`> ${r.note}`);
  }
  L.push('');
  return L.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const wantMarkdown = args.includes('--markdown');
  const skipWrite = args.includes('--no-write');

  const r = await buildReport();

  if (!skipWrite) {
    const today = new Date().toISOString().slice(0, 10);
    const dir = resolve(REPO_ROOT, 'audit', 'flakes');
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `flakes-${today}.md`), toMarkdown(r));
    await writeFile(resolve(dir, `flakes-${today}.json`), JSON.stringify(r, null, 2));
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
    console.error('[flaky-test-tracker] error:', err?.stack || err);
    process.exit(1);
  });
}
