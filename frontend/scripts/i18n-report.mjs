#!/usr/bin/env node
/**
 * i18n report — non-blocking, human-readable summary of `en.json` and
 * `ku.json` for the umbrella spec `system-wide-ux-overhaul` (task 7.5).
 *
 * For each locale, prints:
 *   - Total Translation_Key count
 *   - Empty values (`""`, `null`, `"TODO"`, `"[missing]"`)
 *   - Values longer than 240 characters (truncation candidates)
 *   - Top 10 overlong examples (key + value truncated to 80 chars)
 *
 * This is a **reporting** script, not a gating one. It always exits 0 and
 * prints a table to stdout so editors can spot truncation candidates and
 * track parity drift over time. The blocking job is `npm run i18n:coverage`
 * (task 7.4); this script is the editor-facing report referenced by
 * Requirement 16.2 of `system-wide-ux-overhaul/requirements.md`.
 *
 * Usage:
 *   npm run i18n:report
 *   node scripts/i18n-report.mjs
 *
 * _Validates: Requirements 16.2_
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(dirname, '..');

const LOCALES = [
  { code: 'en', file: path.join(repo, 'src', 'locales', 'en.json') },
  { code: 'ku', file: path.join(repo, 'src', 'locales', 'ku.json') },
];

const OVERLONG_THRESHOLD = 240;
const PREVIEW_LIMIT = 10;
const TRUNCATE_AT = 80;
const EMPTY_TOKENS = new Set(['', 'TODO', '[missing]']);

/**
 * Recursively flatten a nested object/array tree into a `Map<dottedKey, value>`.
 *
 * The locale JSONs in this repo are mostly flat (dotted keys at the top
 * level), but we flatten defensively so a future nested-object refactor
 * does not silently undercount.
 */
function flatten(node, prefix, out) {
  if (node === null || node === undefined) {
    out.set(prefix, node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      flatten(v, prefix === '' ? String(i) : `${prefix}.${i}`, out);
    });
    return out;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      flatten(v, prefix === '' ? k : `${prefix}.${k}`, out);
    }
    return out;
  }
  out.set(prefix, node);
  return out;
}

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  return EMPTY_TOKENS.has(value);
}

function isOverlong(value) {
  return typeof value === 'string' && value.length > OVERLONG_THRESHOLD;
}

function truncate(s, max) {
  if (typeof s !== 'string') return String(s);
  // collapse internal whitespace so the preview stays on one line
  const collapsed = s.replace(/\s+/g, ' ');
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}

function summarize(localeCode, filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const flat = flatten(parsed, '', new Map());

  const empty = [];
  const overlong = [];
  for (const [key, value] of flat) {
    if (isEmpty(value)) empty.push(key);
    if (isOverlong(value)) overlong.push({ key, length: value.length, value });
  }

  // Show the longest overlong values first — those are the highest-priority
  // truncation candidates.
  overlong.sort((a, b) => b.length - a.length);

  return {
    locale: localeCode,
    total: flat.size,
    empty: empty.length,
    overlong: overlong.length,
    overlongPreview: overlong.slice(0, PREVIEW_LIMIT),
  };
}

function pad(value, width) {
  const s = String(value);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function padLeft(value, width) {
  const s = String(value);
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

function printTable(reports) {
  const cols = [
    { label: 'Locale',   width: 8,  align: 'left'  },
    { label: 'Total',    width: 8,  align: 'right' },
    { label: 'Empty',    width: 8,  align: 'right' },
    { label: '> 240ch',  width: 8,  align: 'right' },
  ];
  const header = cols
    .map((c) => (c.align === 'right' ? padLeft(c.label, c.width) : pad(c.label, c.width)))
    .join('  ');
  const rule = cols.map((c) => '─'.repeat(c.width)).join('  ');

  console.log('i18n_Report — translation key inventory');
  console.log(`Threshold for "overlong" values: > ${OVERLONG_THRESHOLD} characters`);
  console.log(`Empty tokens: "", null, "TODO", "[missing]"`);
  console.log('');
  console.log(header);
  console.log(rule);
  for (const r of reports) {
    const row = [
      pad(r.locale, cols[0].width),
      padLeft(r.total, cols[1].width),
      padLeft(r.empty, cols[2].width),
      padLeft(r.overlong, cols[3].width),
    ].join('  ');
    console.log(row);
  }
}

function printOverlongPreviews(reports) {
  for (const r of reports) {
    if (r.overlongPreview.length === 0) continue;
    console.log('');
    console.log(`Top ${r.overlongPreview.length} overlong values in ${r.locale}.json (length, key → value preview):`);
    for (const item of r.overlongPreview) {
      const lengthCol = padLeft(`${item.length}ch`, 6);
      console.log(`  ${lengthCol}  ${item.key}`);
      console.log(`          ${truncate(item.value, TRUNCATE_AT)}`);
    }
  }
}

function main() {
  const reports = LOCALES.map(({ code, file }) => summarize(code, file));
  printTable(reports);
  printOverlongPreviews(reports);
  // This is a reporting script — never gate CI from here. The blocking job
  // is `i18n:coverage` (task 7.4).
  process.exit(0);
}

main();
