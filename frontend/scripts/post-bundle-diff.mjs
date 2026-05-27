#!/usr/bin/env node
// @ts-check
/**
 * post-bundle-diff.mjs (T-0.3, R3.7)
 *
 * Compares two JSON files produced by audit-bundle-size.mjs and emits a
 * markdown table summarizing per-chunk delta.
 *
 * Usage:
 *   node scripts/post-bundle-diff.mjs --base bundle-main.json --head bundle-pr.json
 *
 * The output goes to stdout — the GitHub Action pipes it into a sticky
 * pull-request comment.
 *
 * Highlights chunks whose gzipped size grew by > 10 KB (R3.7) with a flag.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REGRESSION_THRESHOLD_BYTES = 10 * 1024;

/** @typedef {{ name: string, size: number, gzipSize: number }} Chunk */

function parseArgs(argv) {
  const args = { base: '', head: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') args.base = argv[++i];
    else if (a === '--head') args.head = argv[++i];
  }
  if (!args.base || !args.head) {
    process.stderr.write(
      'Usage: post-bundle-diff.mjs --base <main.json> --head <pr.json>\n',
    );
    process.exit(2);
  }
  return args;
}

/** @param {string} p */
async function loadChunks(p) {
  const full = resolve(p);
  if (!existsSync(full)) {
    process.stderr.write(`[post-bundle-diff] file not found: ${full}\n`);
    return /** @type {Chunk[]} */ ([]);
  }
  const raw = await readFile(full, 'utf8');
  const data = JSON.parse(raw);
  return /** @type {Chunk[]} */ (data.chunks || []);
}

/** @param {number} n */
function fmtBytes(n) {
  if (Math.abs(n) >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (Math.abs(n) >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

/** @param {number} n */
function fmtSignedBytes(n) {
  if (n === 0) return '0 B';
  const sign = n > 0 ? '+' : '−';
  return sign + fmtBytes(Math.abs(n));
}

/** @param {Chunk[]} base @param {Chunk[]} head */
function diff(base, head) {
  /** @type {Map<string, Chunk>} */
  const baseMap = new Map();
  for (const c of base) baseMap.set(c.name, c);
  /** @type {Map<string, Chunk>} */
  const headMap = new Map();
  for (const c of head) headMap.set(c.name, c);

  const allNames = new Set([...baseMap.keys(), ...headMap.keys()]);
  const rows = [];
  for (const name of allNames) {
    const b = baseMap.get(name);
    const h = headMap.get(name);
    const baseGz = b?.gzipSize ?? 0;
    const headGz = h?.gzipSize ?? 0;
    const delta = headGz - baseGz;
    if (delta === 0 && b && h) continue; // unchanged — skip
    rows.push({ name, baseGz, headGz, delta, isNew: !b, isRemoved: !h });
  }
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return rows;
}

/** @param {ReturnType<typeof diff>} rows */
function renderMarkdown(rows) {
  if (rows.length === 0) {
    return '### Bundle size diff\n\n_No chunk-size changes._\n';
  }

  const lines = [];
  lines.push('### Bundle size diff');
  lines.push('');
  lines.push('| Chunk | Base (gz) | PR (gz) | Δ | |');
  lines.push('|---|---:|---:|---:|---|');

  let totalBase = 0;
  let totalHead = 0;
  let regressionFlags = 0;

  for (const r of rows) {
    totalBase += r.baseGz;
    totalHead += r.headGz;
    let badge = '';
    if (r.isNew) badge = 'new';
    else if (r.isRemoved) badge = 'removed';
    else if (r.delta > REGRESSION_THRESHOLD_BYTES) {
      badge = `over budget (>${fmtBytes(REGRESSION_THRESHOLD_BYTES)})`;
      regressionFlags++;
    } else if (r.delta < -REGRESSION_THRESHOLD_BYTES) {
      badge = 'big win';
    }
    lines.push(
      `| \`${r.name}\` | ${fmtBytes(r.baseGz)} | ${fmtBytes(r.headGz)} | ${fmtSignedBytes(r.delta)} | ${badge} |`,
    );
  }

  lines.push('');
  lines.push(
    `**Total gzipped:** base ${fmtBytes(totalBase)} → PR ${fmtBytes(totalHead)} (${fmtSignedBytes(totalHead - totalBase)})`,
  );
  if (regressionFlags > 0) {
    lines.push('');
    lines.push(
      `> ${regressionFlags} chunk(s) exceed the per-chunk regression budget (R3.7).`,
    );
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = await loadChunks(args.base);
  const head = await loadChunks(args.head);
  const rows = diff(base, head);
  process.stdout.write(renderMarkdown(rows));
}

main().catch((e) => {
  process.stderr.write(`[post-bundle-diff] fatal: ${e?.stack || e}\n`);
  process.exit(1);
});

export { diff, renderMarkdown, REGRESSION_THRESHOLD_BYTES };
