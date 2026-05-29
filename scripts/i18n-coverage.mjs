#!/usr/bin/env node
/**
 * i18n-coverage (Phase P5) — translation coverage report.
 *
 * Computes per-language coverage of `ar.json` and `en.json` against the
 * Kurdish baseline (`ku.json`).
 *
 * Usage:
 *   node scripts/i18n-coverage.mjs              # report only
 *   node scripts/i18n-coverage.mjs --strict     # exit 1 if Arabic < 100%
 *   node scripts/i18n-coverage.mjs --json       # machine-readable output
 *
 * The strict mode is ADVISORY until P5 end — `package.json` should NOT wire
 * it into the default CI gate yet. See `_deltas/P5-deps.md`.
 *
 * Validates: R9.1 (Arabic 100% coverage gate).
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..');
const LOCALES_DIR = path.join(repoRoot, 'frontend', 'src', 'locales');

const ARGS = new Set(process.argv.slice(2));
const STRICT = ARGS.has('--strict');
const JSON_MODE = ARGS.has('--json');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

const INVALID = new Set(['', 'TODO', '[missing]', null, undefined]);

function isInvalid(v) {
  if (v == null) return true;
  if (typeof v === 'string' && INVALID.has(v)) return true;
  return false;
}

function loadLocale(lang) {
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Locale file not found: ${file}`);
  }
  return flatten(JSON.parse(fs.readFileSync(file, 'utf8')));
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute coverage
// ─────────────────────────────────────────────────────────────────────────────

const ku = loadLocale('ku');
const en = loadLocale('en');
const ar = loadLocale('ar');

const baseline = new Set(Object.keys(ku));
const baselineSize = baseline.size;

function coverage(other, otherName) {
  const otherKeys = new Set(Object.keys(other));
  const missing = [];
  const invalid = [];
  for (const k of baseline) {
    if (!otherKeys.has(k)) {
      missing.push(k);
    } else if (isInvalid(other[k])) {
      invalid.push(k);
    }
  }
  const covered = baselineSize - missing.length - invalid.length;
  const pct = baselineSize > 0 ? (covered / baselineSize) * 100 : 100;
  return { name: otherName, total: baselineSize, covered, missing, invalid, pct };
}

const enCov = coverage(en, 'en');
const arCov = coverage(ar, 'ar');

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────

if (JSON_MODE) {
  const out = {
    baseline: 'ku',
    baseline_keys: baselineSize,
    languages: {
      en: { coverage_pct: enCov.pct, covered: enCov.covered, missing: enCov.missing.length, invalid: enCov.invalid.length },
      ar: { coverage_pct: arCov.pct, covered: arCov.covered, missing: arCov.missing.length, invalid: arCov.invalid.length },
    },
  };
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              i18n Coverage (P5)                              ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Baseline (ku):           ${String(baselineSize).padStart(6)} keys                  ║`);
  console.log(`║  English coverage:        ${enCov.pct.toFixed(2).padStart(7)}%                       ║`);
  console.log(`║    missing keys:          ${String(enCov.missing.length).padStart(6)}                          ║`);
  console.log(`║    invalid values:        ${String(enCov.invalid.length).padStart(6)}                          ║`);
  console.log(`║  Arabic coverage:         ${arCov.pct.toFixed(2).padStart(7)}%                       ║`);
  console.log(`║    missing keys:          ${String(arCov.missing.length).padStart(6)}                          ║`);
  console.log(`║    invalid values:        ${String(arCov.invalid.length).padStart(6)}                          ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (arCov.missing.length > 0) {
    console.log('\nSample missing Arabic keys (first 20):');
    for (const k of arCov.missing.slice(0, 20)) console.log(`  - ${k}`);
    if (arCov.missing.length > 20) console.log(`  … and ${arCov.missing.length - 20} more`);
  }
  if (enCov.missing.length > 0) {
    console.log('\nSample missing English keys (first 20):');
    for (const k of enCov.missing.slice(0, 20)) console.log(`  - ${k}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Strict gate
// ─────────────────────────────────────────────────────────────────────────────

let exit = 0;
if (STRICT) {
  if (arCov.pct < 100) {
    if (!JSON_MODE) console.error(`\n✗ Arabic coverage ${arCov.pct.toFixed(2)}% < 100% — strict mode FAIL.`);
    exit = 1;
  }
  if (enCov.pct < 100) {
    if (!JSON_MODE) console.error(`✗ English coverage ${enCov.pct.toFixed(2)}% < 100% — strict mode FAIL.`);
    exit = 1;
  }
}
process.exit(exit);
