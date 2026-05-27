#!/usr/bin/env node
// @ts-check
/**
 * adr-compliance.mjs (T-V.7, V-LM.12)
 *
 * Ensures significant PRs land with an ADR. A PR is "significant" if it
 * touches > 20 files OR > 1000 LOC (additions + deletions). For each merged
 * PR in the last 30 days we check whether at least one file under `docs/adr/`
 * was added or modified.
 *
 * Env vars:
 *   - GH_TOKEN   GitHub PAT (required; graceful skip otherwise)
 *   - GH_REPO    owner/repo (default: derived from git remote)
 *
 * Output:
 *   - JSON to stdout (default), `--markdown` for a markdown summary.
 *   - `--write` writes both to `audit/maintainability/adr-{ISO-DATE}.{json,md}`.
 *
 * Threshold (V-LM.12): < 10% of "significant" PRs without an ADR
 *                      (i.e., compliance ≥ 90%).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..');

const MS_PER_DAY = 86_400_000;
const WINDOW_DAYS = 30;
const SIGNIFICANT_FILES = 20;
const SIGNIFICANT_LOC = 1000;

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
 * @param {string} repo
 * @param {string} token
 * @param {Date} since
 * @returns {Promise<any[]>}
 */
async function fetchMergedPrsSince(repo, token, since) {
  /** @type {any[]} */
  const all = [];
  const sinceIso = since.toISOString().slice(0, 10);
  const q = `repo:${repo}+is:pr+is:merged+merged:>=${sinceIso}`;
  for (let page = 1; page <= 10; page++) {
    const url = `https://api.github.com/search/issues?q=${q}&per_page=100&page=${page}`;
    /** @type {any} */
    const data = await ghJson(url, token);
    const items = data.items ?? [];
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

/**
 * @param {string} repo
 * @param {string} token
 * @param {number} number
 */
async function fetchPrFiles(repo, token, number) {
  /** @type {any[]} */
  const files = [];
  for (let page = 1; page <= 10; page++) {
    const url = `https://api.github.com/repos/${repo}/pulls/${number}/files?per_page=100&page=${page}`;
    /** @type {any} */
    const data = await ghJson(url, token);
    files.push(...data);
    if (data.length < 100) break;
  }
  return files;
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

  const since = new Date(Date.now() - WINDOW_DAYS * MS_PER_DAY);
  let prs;
  try {
    prs = await fetchMergedPrsSince(repo, token, since);
  } catch (e) {
    return {
      generated: new Date().toISOString(),
      skipped: true,
      reason: `GitHub API error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  /** @type {{ number: number; title: string; url: string; files: number; loc: number; reason: string }[]} */
  const flagged = [];
  /** @type {{ number: number; title: string; url: string; files: number; loc: number }[]} */
  const compliant = [];
  let significantCount = 0;
  let errorCount = 0;

  // Concurrency limit: 4 file-list calls in flight to be polite.
  const queue = prs.slice();
  /**
   * @param {any} pr
   */
  async function processPr(pr) {
    try {
      const files = await fetchPrFiles(repo, token, pr.number);
      const fileCount = files.length;
      const loc = files.reduce((sum, f) => sum + (f.additions ?? 0) + (f.deletions ?? 0), 0);
      const isSignificant = fileCount > SIGNIFICANT_FILES || loc > SIGNIFICANT_LOC;
      if (!isSignificant) return;
      significantCount += 1;
      const hasAdr = files.some((f) => String(f.filename || '').startsWith('docs/adr/'));
      const summary = {
        number: pr.number,
        title: pr.title,
        url: pr.html_url ?? `https://github.com/${repo}/pull/${pr.number}`,
        files: fileCount,
        loc,
      };
      if (hasAdr) {
        compliant.push(summary);
      } else {
        flagged.push({
          ...summary,
          reason: fileCount > SIGNIFICANT_FILES && loc > SIGNIFICANT_LOC
            ? `${fileCount} files + ${loc} LOC, no ADR`
            : fileCount > SIGNIFICANT_FILES
              ? `${fileCount} files, no ADR`
              : `${loc} LOC, no ADR`,
        });
      }
    } catch {
      errorCount += 1;
    }
  }

  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length > 0) {
      const pr = queue.shift();
      if (pr) await processPr(pr);
    }
  });
  await Promise.all(workers);

  const totalSig = compliant.length + flagged.length;
  const compliancePct = totalSig === 0 ? 100 : Math.round((compliant.length / totalSig) * 1000) / 10;

  /** @type {'green' | 'yellow' | 'red'} */
  let status = 'green';
  if (compliancePct < 80) status = 'red';
  else if (compliancePct < 90) status = 'yellow';

  return {
    generated: new Date().toISOString(),
    repo,
    window_days: WINDOW_DAYS,
    prs_inspected: prs.length,
    api_errors: errorCount,
    significant_prs: significantCount,
    compliant_count: compliant.length,
    flagged_count: flagged.length,
    compliance_percent: compliancePct,
    target_percent: 90,
    status,
    flagged,
    compliant,
  };
}

/**
 * @param {Awaited<ReturnType<typeof buildReport>>} r
 */
function toMarkdown(r) {
  const L = [];
  L.push('# ADR Compliance Report');
  L.push('');
  L.push(`- Generated: \`${r.generated}\``);
  if (r.skipped) {
    L.push('');
    L.push(`> _Skipped_: ${r.reason}`);
    L.push('');
    return L.join('\n');
  }
  L.push(`- Repo: \`${r.repo}\``);
  L.push(`- Window: last **${r.window_days}** days`);
  L.push(`- Significant threshold: > ${SIGNIFICANT_FILES} files OR > ${SIGNIFICANT_LOC} LOC`);
  L.push(`- Target (V-LM.12): ≥ **${r.target_percent}%** compliance`);
  L.push('');
  L.push('## Summary');
  L.push('');
  L.push(`| Metric | Value |`);
  L.push(`| --- | --- |`);
  L.push(`| PRs inspected | ${r.prs_inspected} |`);
  L.push(`| Significant PRs | ${r.significant_prs} |`);
  L.push(`| Compliant | ${r.compliant_count} |`);
  L.push(`| Flagged | ${r.flagged_count} |`);
  L.push(`| Compliance % | **${r.compliance_percent}%** |`);
  L.push(`| Status | ${r.status === 'green' ? '🟢' : r.status === 'yellow' ? '🟡' : '🔴'} ${r.status.toUpperCase()} |`);
  L.push('');
  if (r.flagged.length > 0) {
    L.push('## Flagged PRs (significant, no ADR)');
    L.push('');
    L.push('| # | Title | Files | LOC | Reason |');
    L.push('| --- | --- | ---: | ---: | --- |');
    for (const p of r.flagged) {
      L.push(`| [${p.number}](${p.url}) | ${p.title.replace(/\|/g, '\\|')} | ${p.files} | ${p.loc} | ${p.reason} |`);
    }
  } else {
    L.push('_All significant PRs included an ADR — full compliance for the window._');
  }
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
    await writeFile(resolve(dir, `adr-${today}.json`), JSON.stringify(r, null, 2));
    await writeFile(resolve(dir, `adr-${today}.md`), toMarkdown(r));
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
    console.error('[adr-compliance] error:', err?.stack || err);
    process.exit(1);
  });
}
