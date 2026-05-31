#!/usr/bin/env node
/**
 * i18n-purity.mjs - Language-purity guard (ku <-> en)
 * Spec: .kiro/specs/premium-glass-rtl-experience (Requirement 5)
 *
 * A. MISSING-KU-KEYS  - every t('key','English fallback') referenced in code must
 *    exist in Kurdish, else i18next falls back to English and the ku UI shows EN.
 * B. ARABIC-IN-CODE   - Arabic-script literals in render positions leak Kurdish
 *    into the en UI. (Heuristic, report-only.)
 * C. LATIN-IN-KU      - Latin words inside ku.json values surface English in ku.
 *
 * Usage (from frontend/):
 *   node scripts/i18n-purity.mjs
 *   node scripts/i18n-purity.mjs --scope=foundation
 *   node scripts/i18n-purity.mjs --strict
 *   node scripts/i18n-purity.mjs --json
 * Pure Node, no deps. Frontend-only. Heuristic by design.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(dirname, '..');
const SRC = path.join(FRONTEND, 'src');
const KU_MONO = path.join(SRC, 'locales', 'ku.json');
const EN_MONO = path.join(SRC, 'locales', 'en.json');
const KU_NS_DIR = path.join(FRONTEND, 'public', 'locales', 'ku');

const ARGS = new Set(process.argv.slice(2));
const STRICT = ARGS.has('--strict');
const JSON_MODE = ARGS.has('--json');
const scopeArg = [...ARGS].find((a) => a.startsWith('--scope='));
const SCOPE = scopeArg ? scopeArg.split('=')[1] : 'all';

const FOUNDATION_GLOBS = [
  '/components/role/', '/components/glass/', '/pages/dashboard/', '/layouts/',
  '/design-system/', '/theme/', '/personas/', '/hooks/useRoleUx',
];

const LATIN_ALLOW = new Set([
  'IQD','USD','EUR','VAT','PDF','CSV','XLSX','URL','ID','SMS','OTP','PIN','API','POS',
  'CRM','HR','KPI','QR','SKU','IBAN','SWIFT','CBI','MoF','WhatsApp','Zoho','Stripe',
  'FastPay','Qi','Zain','Asia','Google','Apple','KB','MB','GB','PWA','GPS','OK','AM',
  'PM','CEO','CFO','B2B','B2C',
]);

function readJsonSafe(p) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    return JSON.parse(clean);
  } catch { return null; }
}

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '__generators__', 'dev-gallery'].includes(e.name)) continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec|vitest|stories)\./.test(e.name)) {
      yield full;
    }
  }
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const rel = (p) => p.replace(FRONTEND + path.sep, '').replace(/\\/g, '/');
const inFoundation = (p) => FOUNDATION_GLOBS.some((g) => ('/' + rel(p)).includes(g));

const kuKeys = new Set();
flatten(readJsonSafe(KU_MONO) || {}, '', kuKeys);
const nsKeys = {};
if (fs.existsSync(KU_NS_DIR)) {
  for (const f of fs.readdirSync(KU_NS_DIR)) {
    if (!f.endsWith('.json')) continue;
    const ns = f.replace(/\.json$/, '');
    const set = flatten(readJsonSafe(path.join(KU_NS_DIR, f)) || {});
    nsKeys[ns] = set;
    for (const k of set) { kuKeys.add(k); kuKeys.add(ns + '.' + k); }
  }
}

function keyCovered(rawKey, fileDefaultNs) {
  if (!rawKey) return true;
  let ns = fileDefaultNs || 'common';
  let key = rawKey;
  if (rawKey.includes(':')) { const i = rawKey.indexOf(':'); ns = rawKey.slice(0, i); key = rawKey.slice(i + 1); }
  if (kuKeys.has(key)) return true;
  if (kuKeys.has(ns + '.' + key)) return true;
  if (nsKeys[ns] && nsKeys[ns].has(key)) return true;
  return false;
}

const T_CALL = /(?:\bt|\bi18n\.t)\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*(,\s*(['"])((?:\\.|(?!\4).)*)\4)?/g;
const USE_NS = /useTranslation\(\s*['"]([a-zA-Z_]+)['"]/;

const missing = [];
const arabicLeaks = [];
let filesScanned = 0;

for (const file of walk(SRC)) {
  const r = rel(file);
  if (r.includes('/locales/') || r.includes('/i18n')) continue;
  filesScanned++;
  const text = fs.readFileSync(file, 'utf8');
  const nsMatch = text.match(USE_NS);
  const defaultNs = nsMatch ? nsMatch[1] : 'common';

  let m;
  T_CALL.lastIndex = 0;
  while ((m = T_CALL.exec(text)) !== null) {
    const key = m[2];
    const fallback = m[5];
    if (!key || /[`${}]/.test(key)) continue;
    if (!keyCovered(key, defaultNs)) {
      missing.push({ file: r, key, fallback: fallback || '', foundation: inFoundation(r) });
    }
  }

  // Print/receipt templates carry intentional per-language label dicts - skip Check B.
  const skipArabicScan = /\/(print|receipts?)\//i.test(r) || /(PrintTemplate|Receipt)/.test(r);
  const lines = skipArabicScan ? [] : text.split('\n');
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (inBlockComment) { if (trimmed.includes('*/')) inBlockComment = false; continue; }
    if (trimmed.startsWith('/*')) { if (!trimmed.includes('*/')) inBlockComment = true; continue; }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    if (!ARABIC.test(line)) continue;
    if (/\bt\(\s*['"][^'"]+['"]\s*,/.test(line)) continue;
    if (/^['"].*['"],?$/.test(trimmed)) continue;
    if (/fallback(Label|Title|Text)?\s*[:=]/.test(line)) continue;
    if (/console\.(log|warn|error|info)/.test(line)) continue;
    if (/isRTL\s*\?/.test(line)) continue;  // direction-gated bilingual literal (language-correct)
    arabicLeaks.push({ file: r, line: i + 1, text: trimmed.slice(0, 100), foundation: inFoundation(r) });
  }
}

const latinInKu = [];
function scanKuValues(obj, src, prefix = '') {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object') { scanKuValues(v, src, key); continue; }
    if (typeof v !== 'string') continue;
    const words = v.match(/[A-Za-z][A-Za-z]{2,}/g) || [];
    const bad = words.filter((w) => !LATIN_ALLOW.has(w) && !LATIN_ALLOW.has(w.toUpperCase()));
    if (bad.length) latinInKu.push({ src, key, value: v.slice(0, 80), words: [...new Set(bad)] });
  }
}
scanKuValues(readJsonSafe(KU_MONO) || {}, 'src/locales/ku.json');
if (fs.existsSync(KU_NS_DIR)) {
  for (const f of fs.readdirSync(KU_NS_DIR)) {
    if (f.endsWith('.json')) scanKuValues(readJsonSafe(path.join(KU_NS_DIR, f)) || {}, 'public/locales/ku/' + f);
  }
}

const missScope = SCOPE === 'foundation' ? missing.filter((x) => x.foundation) : missing;
const summary = {
  filesScanned,
  missingKuKeys: missing.length,
  missingKuKeysInScope: missScope.length,
  arabicLeaks: arabicLeaks.length,
  arabicLeaksInScope: arabicLeaks.filter((x) => x.foundation).length,
  latinInKuValues: latinInKu.length,
  scope: SCOPE,
};

if (JSON_MODE) {
  console.log(JSON.stringify({ summary, missing, arabicLeaks, latinInKu }, null, 2));
} else {
  const bar = '='.repeat(64);
  console.log('\n' + bar + '\n  i18n purity guard (ku <-> en)   scope=' + SCOPE + '\n' + bar);
  console.log('  files scanned ............ ' + filesScanned);
  console.log('  A. t() keys missing in ku  ' + missing.length + '   (in scope: ' + missScope.length + ')');
  console.log('  B. Arabic-script in code . ' + arabicLeaks.length + '   (in scope: ' + arabicLeaks.filter((x) => x.foundation).length + ')');
  console.log('  C. Latin words in ku JSON  ' + latinInKu.length);
  console.log(bar);

  const list = SCOPE === 'foundation' ? missScope : missing;
  const showMiss = list.slice(0, 60);
  if (showMiss.length) {
    console.log('\n  A. Missing Kurdish keys (English would leak into ku UI):');
    for (const x of showMiss) {
      console.log('     ' + x.file + '  ->  "' + x.key + '"' + (x.fallback ? '  [fallback: "' + x.fallback.slice(0, 40) + '"]' : ''));
    }
    if (list.length > showMiss.length) console.log('     ... and ' + (list.length - showMiss.length) + ' more');
  }
  const arList = SCOPE === 'foundation' ? arabicLeaks.filter((x) => x.foundation) : arabicLeaks;
  const showAr = arList.slice(0, 30);
  if (showAr.length) {
    console.log('\n  B. Arabic-script literals (Kurdish could leak into en UI) - review:');
    for (const x of showAr) console.log('     ' + x.file + ':' + x.line + '  ' + x.text);
  }
  if (latinInKu.length) {
    console.log('\n  C. Latin inside Kurdish values (first 25):');
    for (const x of latinInKu.slice(0, 25)) console.log('     ' + x.src + '  "' + x.key + '"  -> ' + x.words.join(', '));
  }
  console.log('');
}

const gateFail = STRICT ? missing.length > 0 : (SCOPE === 'foundation' ? missScope.length > 0 : false);
process.exitCode = gateFail ? 1 : 0;
