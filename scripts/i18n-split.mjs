#!/usr/bin/env node
/**
 * i18n-split — Phase P5.
 *
 * Splits the monolithic per-language JSON files
 *   frontend/src/locales/<lang>.json
 * into per-namespace JSON files
 *   frontend/public/locales/<lang>/<ns>.json
 *
 * Each top-level key is routed to a namespace based on a prefix table.
 * Unrecognized keys land in `common.json` so nothing is silently dropped.
 *
 * Idempotent: re-running with no source changes produces byte-identical
 * output. Run via `npm run i18n:split` (script entry to be added in package.json —
 * see _deltas/P5-deps.md).
 *
 * Validates R9.3 (per-module bundles).
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..');
const SRC_DIR = path.join(repoRoot, 'frontend', 'src', 'locales');
const OUT_DIR = path.join(repoRoot, 'frontend', 'public', 'locales');

const LANGS = ['ku', 'en', 'ar'];

/**
 * Recognized namespaces — must stay in sync with
 * `frontend/src/i18n.config.ts → NAMESPACES`.
 *
 * The order matters: the first matching prefix wins. Put more specific
 * prefixes (e.g. `pos.kitchen`) BEFORE shorter ones (`pos`).
 */
const NAMESPACES = [
  'common',
  'auth',
  'nav',
  'dashboard',
  'sales',
  'purchases',
  'inventory',
  'accounting',
  'banking',
  'crm',
  'pos',
  'hr',
  'payroll',
  'manufacturing',
  'projects',
  'reports',
  'settings',
  'errors',
  'validation',
  'iraq',
];

/**
 * Slugs for the 30+ ext modules (Wave B/C/D). Each becomes its own
 * `ext.<slug>` namespace. Keep in sync with
 * `frontend/src/pages/modules/moduleConfigs.ts`.
 */
const EXT_SLUGS = [
  // Wave B
  'livechat', 'social', 'comms', 'engagement', 'elearning',
  // Wave C
  'rental', 'ai', 'mobile', 'iot', 'studio',
  // Wave D
  'healthcare', 'hospital', 'pharmacy', 'hotel', 'restaurant',
  'construction', 'real-estate', 'education', 'logistics',
  'agriculture', 'ngo', 'government',
  // Extras
  'quality', 'maintenance', 'plm', 'repairs', 'hr-extended',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Decide which namespace a flat translation key belongs to. */
function routeKey(key) {
  // Ext modules: `ext.healthcare.*` → namespace `ext.healthcare`
  if (key.startsWith('ext.')) {
    const parts = key.split('.');
    if (parts.length >= 2 && EXT_SLUGS.includes(parts[1])) {
      return `ext.${parts[1]}`;
    }
    return 'ext.common';
  }
  // Core namespaces: prefix match.
  for (const ns of NAMESPACES) {
    if (key === ns) return ns;
    if (key.startsWith(`${ns}.`) || key.startsWith(`${ns}_`)) return ns;
  }
  return 'common';
}

/**
 * Flatten a nested object into dot-keys for prefix matching, then return both
 * the flat form (for routing decisions) and the original structure.
 *
 * We keep the original (non-flat) values intact when emitting so consumers
 * don't see structural surprises.
 */
function* iterateTopLevel(obj) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      yield [k, v];
    }
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSONIfChanged(file, obj) {
  const next = JSON.stringify(obj, Object.keys(obj).sort(), 2) + '\n';
  let prev = '';
  try {
    prev = fs.readFileSync(file, 'utf8');
  } catch {
    /* file doesn't exist yet */
  }
  if (prev === next) return false;
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function splitLang(lang) {
  const srcFile = path.join(SRC_DIR, `${lang}.json`);
  if (!fs.existsSync(srcFile)) {
    console.warn(`[i18n-split] ${lang}.json not found at ${srcFile} — skipping`);
    return { lang, written: 0, namespaces: {} };
  }
  const data = readJSON(srcFile);

  // Bucket top-level keys by namespace.
  const buckets = new Map();
  let totalKeys = 0;
  for (const [key, value] of iterateTopLevel(data)) {
    totalKeys++;
    const ns = routeKey(key);
    if (!buckets.has(ns)) buckets.set(ns, {});
    buckets.get(ns)[key] = value;
  }

  // Always emit the core namespaces even if empty, so the HTTP backend
  // doesn't 404 in dev.
  for (const ns of NAMESPACES) {
    if (!buckets.has(ns)) buckets.set(ns, {});
  }

  // Write per-namespace files.
  let written = 0;
  const stats = {};
  for (const [ns, bucket] of buckets.entries()) {
    const outFile = path.join(OUT_DIR, lang, `${ns}.json`);
    const changed = writeJSONIfChanged(outFile, bucket);
    if (changed) written++;
    stats[ns] = Object.keys(bucket).length;
  }

  return { lang, totalKeys, written, namespaces: stats };
}

function main() {
  ensureDir(OUT_DIR);

  console.log('i18n-split — splitting per-language JSON into per-namespace bundles');
  console.log(`  source: ${SRC_DIR}`);
  console.log(`  output: ${OUT_DIR}`);
  console.log('');

  const results = LANGS.map(splitLang);

  // Report
  console.log('Per-language summary:');
  for (const r of results) {
    const nsCount = Object.keys(r.namespaces ?? {}).length;
    console.log(
      `  ${r.lang.padEnd(3)} — ${String(r.totalKeys ?? 0).padStart(5)} keys, ` +
        `${nsCount} namespaces, ${r.written} files updated`,
    );
  }

  // Cross-language missing-namespace report.
  console.log('\nCoverage matrix (keys per namespace):');
  const header = `  ns`.padEnd(28) + LANGS.map((l) => l.padStart(8)).join('');
  console.log(header);
  console.log('  ' + '─'.repeat(header.length - 2));
  const allNs = new Set();
  for (const r of results) {
    Object.keys(r.namespaces ?? {}).forEach((ns) => allNs.add(ns));
  }
  const sortedNs = [...allNs].sort();
  const missing = [];
  for (const ns of sortedNs) {
    const row = LANGS.map((lang) => {
      const r = results.find((x) => x.lang === lang);
      return r?.namespaces?.[ns] ?? 0;
    });
    if (row.some((n) => n === 0)) missing.push({ ns, row });
    console.log(`  ${ns.padEnd(26)}` + row.map((n) => String(n).padStart(8)).join(''));
  }

  if (missing.length > 0) {
    console.log(`\n[i18n-split] Heads-up: ${missing.length} namespace(s) have 0 keys in at least one language.`);
  }

  console.log('\n[i18n-split] done.');
}

main();
