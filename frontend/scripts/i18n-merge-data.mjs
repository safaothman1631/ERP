#!/usr/bin/env node
/**
 * i18n-merge-data.mjs - merge parallel-agent translation data files
 * (scripts/i18n-data/*.json) into public/locales/{ku,en,ar}/<ns>.json.
 *
 * Placement is driven by the AUTHORITATIVE purity missing list (/tmp/purity.json),
 * not by the agents' grouping. Translations are joined by the English fallback text
 * (primary) and by reconstructed key (secondary). Never overwrites existing keys.
 * Frontend-only. Run: node scripts/i18n-purity.mjs --json > /tmp/purity.json ; node scripts/i18n-merge-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(dirname, '..');
const SRC = path.join(FRONTEND, 'src');
const DATA_DIR = path.join(dirname, 'i18n-data');
const LOCALES = path.join(FRONTEND, 'public', 'locales');

function readJson(p) {
  try { const r = fs.readFileSync(p, 'utf8'); return { obj: JSON.parse(r.charCodeAt(0) === 0xFEFF ? r.slice(1) : r), bom: r.charCodeAt(0) === 0xFEFF }; }
  catch { return { obj: null, bom: false }; }
}
function saveJson(p, obj, bom) {
  fs.writeFileSync(p, (bom ? '﻿' : '') + JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function deepSetIfAbsent(root, dottedPath, value) {
  const parts = dottedPath.split('.');
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (node[k] === undefined) node[k] = {};
    if (typeof node[k] !== 'object' || node[k] === null || Array.isArray(node[k])) return 'conflict';
    node = node[k];
  }
  const leaf = parts[parts.length - 1];
  if (node[leaf] !== undefined) return 'exists';
  node[leaf] = value;
  return 'added';
}

// ---- build translation lookups from agent data files ----
const byEn = new Map();   // en text -> {ku, ar}
const byKey = new Map();  // reconstructed key -> {ku, en, ar}
let dataFiles = [];
try { dataFiles = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')); } catch { dataFiles = []; }
for (const f of dataFiles) {
  const { obj } = readJson(path.join(DATA_DIR, f));
  if (!obj) continue;
  for (const [ns, keys] of Object.entries(obj)) {
    if (!keys || typeof keys !== 'object') continue;
    for (const [k, vals] of Object.entries(keys)) {
      if (!vals || typeof vals !== 'object') continue;
      const en = vals.en, ku = vals.ku, ar = vals.ar;
      if (en) {
        const prev = byEn.get(en) || {};
        byEn.set(en, { ku: prev.ku || ku, ar: prev.ar || ar });
      }
      const full = ns + '.' + k;
      if (!byKey.has(full)) byKey.set(full, vals);
      if (!byKey.has(k)) byKey.set(k, vals);
    }
  }
}
console.log('lookup: byEn=' + byEn.size + ' byKey=' + byKey.size + ' from ' + dataFiles.length + ' data files');

// ---- default-ns per source file (cache) ----
const USE_NS = /useTranslation\(\s*['"]([a-zA-Z_]+)['"]/;
const nsCache = new Map();
function defaultNsOf(relFile) {
  if (nsCache.has(relFile)) return nsCache.get(relFile);
  let ns = 'common';
  try { const t = fs.readFileSync(path.join(FRONTEND, relFile), 'utf8'); const m = t.match(USE_NS); if (m) ns = m[1]; } catch { /* keep common */ }
  nsCache.set(relFile, ns);
  return ns;
}

// ---- which ns files exist ----
const LANGS = ['ku', 'en', 'ar'];
const nsFileExists = {};
for (const lng of LANGS) {
  nsFileExists[lng] = new Set(
    (fs.existsSync(path.join(LOCALES, lng)) ? fs.readdirSync(path.join(LOCALES, lng)) : [])
      .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')),
  );
}
const loaded = {}; // lng -> ns -> {obj,bom,dirty}
function getNsObj(lng, ns) {
  const key = lng + '/' + ns;
  if (loaded[key]) return loaded[key];
  const p = path.join(LOCALES, lng, ns + '.json');
  const r = readJson(p);
  loaded[key] = { obj: r.obj || {}, bom: r.bom, dirty: false, exists: r.obj !== null };
  return loaded[key];
}

// ---- drive from purity missing list ----
const purity = JSON.parse(fs.readFileSync('/tmp/purity.json', 'utf8'));
const seen = new Set();
const stats = { ku: 0, en: 0, ar: 0, noKu: 0, conflicts: 0, total: 0 };

for (const m of purity.missing) {
  const rawKey = m.key;
  if (!rawKey || seen.has(rawKey)) continue;
  seen.add(rawKey);
  stats.total++;

  let ns, pathKey;
  if (rawKey.includes(':')) { const i = rawKey.indexOf(':'); ns = rawKey.slice(0, i); pathKey = rawKey.slice(i + 1); }
  else { ns = defaultNsOf(m.file); pathKey = rawKey; }
  // route to common if ns file doesn't exist
  if (!nsFileExists.ku.has(ns)) { ns = 'common'; pathKey = rawKey.replace(/:/g, '.'); }

  const fb = m.fallback || '';
  const tr = (fb && byEn.get(fb)) || {};
  const tk = byKey.get(rawKey) || byKey.get(pathKey) || {};
  const en = fb || tk.en || pathKey;
  const ku = tr.ku || tk.ku || null;
  const ar = tr.ar || tk.ar || null;

  if (!ku) { stats.noKu++; continue; }  // skip if we have no Kurdish (don't leave EN in ku)

  // ku
  { const o = getNsObj('ku', ns); const r = deepSetIfAbsent(o.obj, pathKey, ku); if (r === 'added') { o.dirty = true; stats.ku++; } else if (r === 'conflict') stats.conflicts++; }
  // en
  { const o = getNsObj('en', ns); const r = deepSetIfAbsent(o.obj, pathKey, en); if (r === 'added') { o.dirty = true; stats.en++; } }
  // ar (only if provided)
  if (ar) { const o = getNsObj('ar', ns); const r = deepSetIfAbsent(o.obj, pathKey, ar); if (r === 'added') { o.dirty = true; stats.ar++; } }
}

// ---- save dirty files ----
let filesWritten = 0;
for (const [key, v] of Object.entries(loaded)) {
  if (!v.dirty) continue;
  const [lng, ns] = key.split('/');
  saveJson(path.join(LOCALES, lng, ns + '.json'), v.obj, v.bom);
  filesWritten++;
}

console.log('\n=== merge complete ===');
console.log('unique missing processed:', stats.total);
console.log('ku added:', stats.ku, '| en added:', stats.en, '| ar added:', stats.ar);
console.log('skipped (no ku translation available):', stats.noKu, '| conflicts:', stats.conflicts);
console.log('locale files written:', filesWritten);
