#!/usr/bin/env node
// @ts-check
/**
 * velocity-report.mjs (T-V.5, V-LM.10)
 *
 * Reports feature velocity over the last 7 / 30 / 90 days using the GitHub
 * Search API (closed PRs merged in the window).
 *
 * Metrics:
 *   - PRs/week (each window normalized to a per-week rate)
 *   - time-to-merge p50 / p95 (created_at → merged_at)
 *   - mean review comments per PR
 *   - % PRs with ≥ 1 review comment
 *   - quarter-over-quarter trend (current 90d vs previous 90d)
 *
 * Env vars:
 *   - GH_TOKEN   GitHub PAT (required for non-public rate limits)
 *   - GH_REPO    owner/repo (default: derived from git remote.origin.url)
 *
 * Graceful: missing GH_TOKEN → emits a structured "skipped" result and exit 0.
 *
 * Output:
 *   - JSON to stdout (default), `--markdown` for a markdown summary.
 *   - `--write` writes both to `audit/maintainability/velocity-{ISO-DATE}.{json,md}`.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..');

const MS_PER_DAY = 86_400_000;
const WINDOWS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

function deriveRepo() {
  if (process.env.GH_REPO) return process.env.GH_REPO;
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const m = url.match(/github\.com[:/]([^/]+\/[^.]+?)(?:\.git)?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @param {string} token
 */
async function ghJson(url, token) {
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
 * @param {number[]} arr
 * @param {number} q
 */
function quantile(arr, q) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Fetch merged PRs in window via the search API.
 * @param {string} repo
 * @param {string} token
 * @param {Date} since
 * @param {Date} until
 */
async function fetchMergedPrs(repo, token, since, until) {
  /** @type {any[]} */
  const all = [];
  const q = `repo:${repo}+is:pr+is:merged+merged:${since.toISOString().slice(0, 10)}..${until.toISOString().slice(0, 10)}`;
  let page = 1;
  // GitHub Search API caps at 1000 results — pull up to 10 pages of 100.
  while (page <= 10) {
    const url = `https://api.github.com/search/issues?q=${q}&per_page=100&page=${page}`;
    /** @type {any} */
    const data = await ghJson(url, token);
    const items = data.items ?? [];
    all.push(...items);
    if (items.length < 100) break;
    page += 1;
  }
  return all;
}

/**
 * Compute window stats.
 * @param {any[]} prs
 * @param {number} days
 */
function statsForWindow(prs, days) {
  /** @type {number[]} */
  const ttmHours = [];
  let withReview = 0;
  let reviewComments = 0;
  for (const pr of prs) {
    // search results lack merged_at directly — use closed_at as proxy when
    // is:merged is in the query. created_at is reliable.
    const created = Date.parse(pr.created_at);
    const closed = Date.parse(pr.closed_at ?? pr.updated_at);
    if (Number.isFinite(created) && Number.isFinite(closed) && closed > created) {
      ttmHours.push((closed - created) / 3_600_000);
    }
    const cc = Number(pr.comments ?? 0);
    reviewComments += cc;
    if (cc > 0) withReview += 1;
  }
  const weeks = days / 7;
  return {
    count: prs.length,
    prs_per_week: Math.round((prs.length / weeks) * 100) / 100,
    time_to_merge_p50_hours: Math.round(quantile(ttmHours, 0.5) * 10) / 10,
    time_to_merge_p95_hours: Math.round(quantile(ttmHours, 0.95) * 10) / 10,
    mean_review_comments: prs.length === 0 ? 0 : Math.round((reviewComments / prs.length) * 100) / 100,
    pct_with_review: prs.length === 0 ? 0 : Math.round((withReview / prs.length) * 1000) / 10,
  };
}

async function buildReport() {
  const token = process.env.GH_TOKEN;
  const repo = deriveRepo();
  if (!token) {
    return {
      generated: new Date().toISOString(),
      skipped: true,
      reason: 'GH_TOKEN not set',
    };
  }
  if (!repo) {
    return {
      generated: new Date().toISOString(),
      skipped: true,
      reason: 'Could not derive GH_REPO',
    };
  }

  const now = new Date();
  /** @type {Record<string, any>} */
  const windows = {};
  try {
    for (const w of WINDOWS) {
      const since = new Date(now.getTime() - w.days * MS_PER_DAY);
      const prs = await fetchMergedPrs(repo, token, since, now);
      windows[w.label] = { ...statsForWindow(prs, w.days), since: since.toISOString() };
    }
    // Quarter-over-quarter
    const prevSince = new Date(now.getTime() - 180 * MS_PER_DAY);
    const prevUntil = new Date(now.getTime() - 90 * MS_PER_DAY);
    const prevPrs = await fetchMergedPrs(repo, token, prevSince, prevUntil);
    const prevStats = statsForWindow(prevPrs, 90);
    const curStats = windows['90d'];
    const qoq =
      prevStats.prs_per_week === 0
        ? null
        : Math.round(((curStats.prs_per_week - prevStats.prs_per_week) / prevStats.prs_per_week) * 1000) / 10;

    /** @type {'green' | 'yellow' | 'red'} */
    let status = 'green';
    if (qoq != null && qoq < -20) status = 'red';
    else if (qoq != null && qoq < -10) status = 'yellow';
    if (curStats.time_to_merge_p95_hours > 120) status = 'yellow';

    return {
      generated: new Date().toISOString(),
      repo,
      windows,
      previous_quarter: { ...prevStats, since: prevSince.toISOString(), until: prevUntil.toISOString() },
      quarter_over_quarter_pct: qoq,
      status,
    };
  } catch (e) {
    return {
      generated: new Date().toISOString(),
      skipped: true,
      reason: `GitHub API error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * @param {Awaited<ReturnType<typeof buildReport>>} r
 */
function toMarkdown(r) {
  const L = [];
  L.push('# Feature Velocity Report');
  L.push('');
  L.push(`- Generated: \`${r.generated}\``);
  if (r.skipped) {
    L.push('');
    L.push(`> _Skipped_: ${r.reason}`);
    L.push('');
    return L.join('\n');
  }
  L.push(`- Repo: \`${r.repo}\``);
  L.push('');
  L.push('| Window | PRs | PRs/week | TTM p50 (h) | TTM p95 (h) | Mean review comments | % w/ review |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const w of WINDOWS) {
    const s = r.windows[w.label];
    L.push(`| ${w.label} | ${s.count} | ${s.prs_per_week} | ${s.time_to_merge_p50_hours} | ${s.time_to_merge_p95_hours} | ${s.mean_review_comments} | ${s.pct_with_review}% |`);
  }
  L.push('');
  L.push(`- Quarter-over-quarter Δ PRs/week: **${r.quarter_over_quarter_pct ?? '?'}%**`);
  L.push(`- Status: ${r.status === 'green' ? '🟢' : r.status === 'yellow' ? '🟡' : '🔴'} ${r.status.toUpperCase()}`);
  L.push('');
  return L.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const wantMarkdown = args.includes('--markdown');
  const wantWrite = args.includes('--write');

  const r = await buildReport();

  if (wantWrite) {
    const today = new Date().toISOString().slice(0, 10);
    const dir = resolve(REPO_ROOT, 'audit', 'maintainability');
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `velocity-${today}.json`), JSON.stringify(r, null, 2));
    await writeFile(resolve(dir, `velocity-${today}.md`), toMarkdown(r));
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
    console.error('[velocity-report] error:', err?.stack || err);
    process.exit(1);
  });
}
