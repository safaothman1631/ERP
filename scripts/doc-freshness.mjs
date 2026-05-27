#!/usr/bin/env node
// @ts-check
/**
 * doc-freshness.mjs (T-V.6, V-LM.11)
 *
 * Walks `docs/` and `.kiro/specs/` (and `.kiro/` more generally), looks at
 * every `.md` file, asks `git log -1 --format=%ct -- <path>` for its
 * last-touched epoch, and reports:
 *
 *   - total Markdown docs scanned
 *   - count + percentage > 90 days stale
 *   - the 10 oldest docs (path + days-since-touch)
 *
 * Output:
 *   - stdout: JSON (default) — `{ generated, scanned, stale_count,
 *             stale_percent, oldest: [{ path, age_days, last_touched }] }`
 *   - `--markdown` flag prints a human-readable summary instead.
 *   - `--write` flag writes both JSON and markdown to
 *     `audit/maintainability/doc-freshness-{ISO-DATE}.{json,md}`.
 *
 * Threshold (per validation V-LM.11): < 20% of docs > 90 days stale.
 *
 * Graceful: if not in a git repository (git command fails for any file),
 * falls back to filesystem mtime.
 *
 * Usage:
 *   node scripts/doc-freshness.mjs                 # JSON to stdout
 *   node scripts/doc-freshness.mjs --markdown      # MD to stdout
 *   node scripts/doc-freshness.mjs --write         # writes both to audit/
 *   node scripts/doc-freshness.mjs --quiet         # only summary line
 */

import { readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..');

const SCAN_DIRS = [
  resolve(REPO_ROOT, 'docs'),
  resolve(REPO_ROOT, '.kiro'),
];

const IGNORE_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '__pycache__', 'venv', '.venv',
  'coverage', 'test-results', 'playwright-report',
]);

const STALE_DAYS = 90;
const SECONDS_PER_DAY = 86_400;

/**
 * @typedef {{ path: string; abs: string; last_touched: number; age_days: number }} DocEntry
 */

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walkMd(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (IGNORE_DIRS.has(ent.name)) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkMd(full)));
    } else if (ent.isFile() && ent.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Returns epoch seconds of last commit touching `abs`, or null if not in git.
 * @param {string} abs
 * @returns {number | null}
 */
function gitLastTouched(abs) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', abs], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    if (!out) return null;
    const n = Number(out);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  } catch {
    return null;
  }
}

/**
 * @param {string} abs
 * @returns {Promise<number>}
 */
async function fsMtime(abs) {
  try {
    const s = await stat(abs);
    return Math.floor(s.mtimeMs / 1000);
  } catch {
    return 0;
  }
}

/**
 * @returns {Promise<{
 *   generated: string;
 *   scanned: number;
 *   stale_count: number;
 *   stale_percent: number;
 *   oldest: { path: string; age_days: number; last_touched: string }[];
 *   threshold_days: number;
 *   target_stale_percent: number;
 *   status: 'green' | 'yellow' | 'red';
 *   docs: DocEntry[];
 * }>}
 */
async function buildReport() {
  /** @type {string[]} */
  let allMd = [];
  for (const dir of SCAN_DIRS) {
    allMd = allMd.concat(await walkMd(dir));
  }

  const now = Math.floor(Date.now() / 1000);
  /** @type {DocEntry[]} */
  const docs = [];

  for (const abs of allMd) {
    let touched = gitLastTouched(abs);
    if (touched == null) touched = await fsMtime(abs);
    const ageDays = Math.max(0, Math.floor((now - touched) / SECONDS_PER_DAY));
    docs.push({
      path: relative(REPO_ROOT, abs).split('\\').join('/'),
      abs,
      last_touched: touched,
      age_days: ageDays,
    });
  }

  docs.sort((a, b) => b.age_days - a.age_days);

  const staleCount = docs.filter((d) => d.age_days > STALE_DAYS).length;
  const stalePercent = docs.length === 0 ? 0 : (staleCount / docs.length) * 100;

  const oldest = docs.slice(0, 10).map((d) => ({
    path: d.path,
    age_days: d.age_days,
    last_touched: new Date(d.last_touched * 1000).toISOString().slice(0, 10),
  }));

  /** @type {'green' | 'yellow' | 'red'} */
  let status = 'green';
  if (stalePercent >= 20) status = 'red';
  else if (stalePercent >= 15) status = 'yellow';

  return {
    generated: new Date().toISOString(),
    scanned: docs.length,
    stale_count: staleCount,
    stale_percent: Math.round(stalePercent * 10) / 10,
    oldest,
    threshold_days: STALE_DAYS,
    target_stale_percent: 20,
    status,
    docs,
  };
}

/**
 * @param {Awaited<ReturnType<typeof buildReport>>} r
 */
function toMarkdown(r) {
  const lines = [];
  lines.push(`# Documentation Freshness Report`);
  lines.push('');
  lines.push(`- Generated: \`${r.generated}\``);
  lines.push(`- Scope: \`docs/\` and \`.kiro/\``);
  lines.push(`- Threshold: docs not touched in **${r.threshold_days} days** are "stale"`);
  lines.push(`- Target (V-LM.11): **< ${r.target_stale_percent}%** stale`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Docs scanned | ${r.scanned} |`);
  lines.push(`| Stale ( > ${r.threshold_days} days ) | ${r.stale_count} |`);
  lines.push(`| Stale % | ${r.stale_percent}% |`);
  lines.push(`| Status | ${statusEmoji(r.status)} ${r.status.toUpperCase()} |`);
  lines.push('');
  lines.push(`## Oldest 10 docs`);
  lines.push('');
  if (r.oldest.length === 0) {
    lines.push(`_No docs found._`);
  } else {
    lines.push(`| Age (days) | Last touched | Path |`);
    lines.push(`| ---: | --- | --- |`);
    for (const d of r.oldest) {
      lines.push(`| ${d.age_days} | ${d.last_touched} | \`${d.path}\` |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/** @param {'green'|'yellow'|'red'} s */
function statusEmoji(s) {
  return s === 'green' ? '🟢' : s === 'yellow' ? '🟡' : '🔴';
}

async function main() {
  const args = process.argv.slice(2);
  const wantMarkdown = args.includes('--markdown');
  const wantWrite = args.includes('--write');
  const quiet = args.includes('--quiet');

  const r = await buildReport();

  if (wantWrite) {
    const today = new Date().toISOString().slice(0, 10);
    const dir = resolve(REPO_ROOT, 'audit', 'maintainability');
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `doc-freshness-${today}.json`), JSON.stringify(r, null, 2));
    await writeFile(resolve(dir, `doc-freshness-${today}.md`), toMarkdown(r));
  }

  if (quiet) {
    process.stdout.write(
      `doc-freshness: ${r.scanned} docs, ${r.stale_count} stale (${r.stale_percent}%) — ${r.status}\n`
    );
    return;
  }

  if (wantMarkdown) {
    process.stdout.write(toMarkdown(r) + '\n');
  } else {
    // Don't dump the full docs[] array to stdout — keep JSON readable.
    const { docs: _omit, ...summary } = r;
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  }
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
    console.error('[doc-freshness] error:', err?.stack || err);
    process.exit(1);
  });
}
