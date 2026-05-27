#!/usr/bin/env node
// @ts-check
/**
 * dependency-age-audit.mjs (V-LM.5)
 *
 * Audits npm + pip dependency freshness.
 *
 *   Frontend: parses `frontend/package.json`, asks `npm view <pkg> time --json`
 *             for each pinned dep, computes age of the pinned version vs latest
 *             stable.
 *
 *   Backend:  parses `backend/requirements.txt`, fetches
 *             https://pypi.org/pypi/<pkg>/json for each entry, computes age.
 *
 * Threshold (V-LM.5): no dep > 12 months behind latest stable.
 *
 * Output:
 *   - JSON to stdout (default), `--markdown` for markdown summary.
 *   - `--write` writes both to `audit/maintainability/dep-age-{ISO-DATE}.{json,md}`.
 *
 * Graceful: if `npm` is unavailable, frontend section is skipped with a warning.
 *           If the PyPI fetch fails (no network), backend section is skipped.
 *
 * Network: uses Node 18+ global fetch for PyPI, and `npm view` for npm.
 *          For CI without network: pass `--offline` to skip both.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..');

const MS_PER_DAY = 86_400_000;
const STALE_DAYS = 365;
const NPM_TIMEOUT_MS = 15_000;
const PYPI_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT = 6;

/**
 * @typedef {{
 *   name: string;
 *   pinned: string;
 *   latest: string | null;
 *   pinned_published?: string | null;
 *   latest_published?: string | null;
 *   age_days: number | null;
 *   stale: boolean;
 *   error?: string;
 * }} DepEntry
 */

/**
 * @param {string} version
 * @returns {string}
 */
function normalizeVersion(version) {
  return version.replace(/^[\^~>=<\s]+/, '').trim();
}

/**
 * @param {string} pkg
 * @param {string} pinned
 * @param {boolean} offline
 * @returns {Promise<DepEntry>}
 */
async function inspectNpm(pkg, pinned, offline) {
  if (offline) {
    return {
      name: pkg, pinned, latest: null, age_days: null, stale: false,
      error: 'offline',
    };
  }
  try {
    const r = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['view', pkg, 'time', '--json'],
      { cwd: REPO_ROOT, encoding: 'utf8', timeout: NPM_TIMEOUT_MS }
    );
    if (r.error || r.status !== 0 || !r.stdout) {
      return {
        name: pkg, pinned, latest: null, age_days: null, stale: false,
        error: `npm view failed: ${r.error?.message ?? `status ${r.status}`}`,
      };
    }
    const timeMap = JSON.parse(r.stdout);
    // Find latest non-prerelease
    const versions = Object.keys(timeMap).filter(
      (v) => v !== 'created' && v !== 'modified' && !/-/.test(v)
    );
    if (versions.length === 0) {
      return { name: pkg, pinned, latest: null, age_days: null, stale: false };
    }
    versions.sort((a, b) => {
      const ta = Date.parse(timeMap[a]);
      const tb = Date.parse(timeMap[b]);
      return ta - tb;
    });
    const latest = versions[versions.length - 1];
    const pinnedNorm = normalizeVersion(pinned);
    const pinnedPublished = timeMap[pinnedNorm] ?? null;
    const latestPublished = timeMap[latest];
    const ageDays =
      pinnedPublished && latestPublished
        ? Math.max(
            0,
            Math.floor((Date.parse(latestPublished) - Date.parse(pinnedPublished)) / MS_PER_DAY)
          )
        : null;
    return {
      name: pkg,
      pinned,
      latest,
      pinned_published: pinnedPublished,
      latest_published: latestPublished,
      age_days: ageDays,
      stale: ageDays != null && ageDays > STALE_DAYS,
    };
  } catch (e) {
    return {
      name: pkg, pinned, latest: null, age_days: null, stale: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * @param {string} pkg
 * @param {string} pinned
 * @param {boolean} offline
 * @returns {Promise<DepEntry>}
 */
async function inspectPypi(pkg, pinned, offline) {
  if (offline) {
    return {
      name: pkg, pinned, latest: null, age_days: null, stale: false,
      error: 'offline',
    };
  }
  try {
    if (typeof fetch !== 'function') {
      return {
        name: pkg, pinned, latest: null, age_days: null, stale: false,
        error: 'fetch unavailable — Node 18+ required',
      };
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), PYPI_TIMEOUT_MS);
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, {
      signal: ctl.signal,
    }).catch((e) => { throw e; });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        name: pkg, pinned, latest: null, age_days: null, stale: false,
        error: `pypi ${res.status}`,
      };
    }
    /** @type {any} */
    const json = await res.json();
    const latest = json?.info?.version ?? null;
    const releases = json?.releases ?? {};
    const pinnedNorm = normalizeVersion(pinned);
    const pinnedRel = releases[pinnedNorm];
    const latestRel = releases[latest];
    const pinnedPublished = Array.isArray(pinnedRel) && pinnedRel.length > 0
      ? pinnedRel[0]?.upload_time_iso_8601 ?? pinnedRel[0]?.upload_time ?? null
      : null;
    const latestPublished = Array.isArray(latestRel) && latestRel.length > 0
      ? latestRel[0]?.upload_time_iso_8601 ?? latestRel[0]?.upload_time ?? null
      : null;
    const ageDays =
      pinnedPublished && latestPublished
        ? Math.max(
            0,
            Math.floor((Date.parse(latestPublished) - Date.parse(pinnedPublished)) / MS_PER_DAY)
          )
        : null;
    return {
      name: pkg,
      pinned,
      latest,
      pinned_published: pinnedPublished,
      latest_published: latestPublished,
      age_days: ageDays,
      stale: ageDays != null && ageDays > STALE_DAYS,
    };
  } catch (e) {
    return {
      name: pkg, pinned, latest: null, age_days: null, stale: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Run `tasks` with at most `n` in flight at a time.
 * @template T
 * @param {(() => Promise<T>)[]} tasks
 * @param {number} n
 * @returns {Promise<T[]>}
 */
async function pool(tasks, n) {
  /** @type {T[]} */
  const out = new Array(tasks.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, tasks.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= tasks.length) return;
      out[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return out;
}

async function readFrontendDeps() {
  try {
    const pkg = JSON.parse(
      await readFile(resolve(REPO_ROOT, 'frontend', 'package.json'), 'utf8')
    );
    /** @type {Record<string, string>} */
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return Object.entries(all).map(([name, version]) => ({ name, pinned: String(version) }));
  } catch {
    return [];
  }
}

async function readBackendDeps() {
  try {
    const text = await readFile(resolve(REPO_ROOT, 'backend', 'requirements.txt'), 'utf8');
    /** @type {{ name: string; pinned: string }[]} */
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.split('#')[0].trim();
      if (!line) continue;
      // Common forms: pkg==1.2.3, pkg>=1.2,<2, pkg, pkg~=1.2
      const m = line.match(/^([A-Za-z0-9_.\-\[\]]+)\s*([=<>~!]=?\s*[^;]+)?/);
      if (!m) continue;
      const name = m[1].replace(/\[.*?\]/, '');
      const pinned = (m[2] ?? '').trim();
      out.push({ name, pinned });
    }
    return out;
  } catch {
    return [];
  }
}

async function buildReport(opts = { offline: false }) {
  const front = await readFrontendDeps();
  const back = await readBackendDeps();

  /** @type {DepEntry[]} */
  let frontResults = [];
  if (front.length > 0) {
    frontResults = await pool(
      front.map((d) => () => inspectNpm(d.name, d.pinned, opts.offline)),
      MAX_CONCURRENT
    );
  }

  /** @type {DepEntry[]} */
  let backResults = [];
  if (back.length > 0) {
    backResults = await pool(
      back.map((d) => () => inspectPypi(d.name, d.pinned, opts.offline)),
      MAX_CONCURRENT
    );
  }

  const frontStale = frontResults.filter((d) => d.stale);
  const backStale = backResults.filter((d) => d.stale);
  const totalStale = frontStale.length + backStale.length;
  const totalDeps = frontResults.length + backResults.length;

  /** @type {'green' | 'yellow' | 'red'} */
  let status = 'green';
  if (totalStale > 5) status = 'red';
  else if (totalStale > 0) status = 'yellow';

  return {
    generated: new Date().toISOString(),
    threshold_days: STALE_DAYS,
    frontend: {
      total: frontResults.length,
      stale: frontStale.length,
      deps: frontResults,
    },
    backend: {
      total: backResults.length,
      stale: backStale.length,
      deps: backResults,
    },
    total_deps: totalDeps,
    total_stale: totalStale,
    status,
  };
}

/**
 * @param {Awaited<ReturnType<typeof buildReport>>} r
 */
function toMarkdown(r) {
  const lines = [];
  lines.push('# Dependency Freshness Report');
  lines.push('');
  lines.push(`- Generated: \`${r.generated}\``);
  lines.push(`- Threshold (V-LM.5): no dep > **${r.threshold_days}** days stale`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Ecosystem | Total | Stale |`);
  lines.push(`| --- | ---: | ---: |`);
  lines.push(`| Frontend (npm) | ${r.frontend.total} | ${r.frontend.stale} |`);
  lines.push(`| Backend (pip)  | ${r.backend.total} | ${r.backend.stale} |`);
  lines.push(`| **Total**      | **${r.total_deps}** | **${r.total_stale}** |`);
  lines.push('');
  lines.push(`Status: ${r.status === 'green' ? '🟢' : r.status === 'yellow' ? '🟡' : '🔴'} ${r.status.toUpperCase()}`);
  lines.push('');
  const staleList = [
    ...r.frontend.deps.filter((d) => d.stale).map((d) => ({ eco: 'npm', ...d })),
    ...r.backend.deps.filter((d) => d.stale).map((d) => ({ eco: 'pip', ...d })),
  ];
  if (staleList.length > 0) {
    lines.push(`## Stale dependencies (> ${r.threshold_days} days)`);
    lines.push('');
    lines.push(`| Eco | Name | Pinned | Latest | Age (days) |`);
    lines.push(`| --- | --- | --- | --- | ---: |`);
    for (const d of staleList) {
      lines.push(`| ${d.eco} | \`${d.name}\` | \`${d.pinned}\` | \`${d.latest ?? '?'}\` | ${d.age_days ?? '?'} |`);
    }
  } else {
    lines.push(`_No stale deps detected._`);
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const wantMarkdown = args.includes('--markdown');
  const wantWrite = args.includes('--write');
  const offline = args.includes('--offline');

  const r = await buildReport({ offline });

  if (wantWrite) {
    const today = new Date().toISOString().slice(0, 10);
    const dir = resolve(REPO_ROOT, 'audit', 'maintainability');
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `dep-age-${today}.json`), JSON.stringify(r, null, 2));
    await writeFile(resolve(dir, `dep-age-${today}.md`), toMarkdown(r));
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
    console.error('[dependency-age-audit] error:', err?.stack || err);
    process.exit(1);
  });
}
