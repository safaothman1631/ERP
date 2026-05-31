#!/usr/bin/env node
/**
 * i18n-backfill.mjs - merge authored ku+en values (i18n-backfill-data.json) into
 * public/locales/{ku,en}/{common,errors}.json. Never overwrites existing keys.
 * Spec: premium-glass-rtl-experience R5. Frontend-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(dirname, '..');
const LOCALES = path.join(FRONTEND, 'public', 'locales');
const DATA = JSON.parse(fs.readFileSync(path.join(dirname, 'i18n-backfill-data.json'), 'utf8'));

let added = 0, skipped = 0;
const conflicts = [];

function deepMerge(target, src, trail) {
  for (const [k, v] of Object.entries(src)) {
    if (k.startsWith('_')) continue;
    const where = trail ? trail + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (target[k] === undefined) target[k] = {};
      if (typeof target[k] !== 'object' || target[k] === null || Array.isArray(target[k])) {
        conflicts.push(where + ' (existing non-object)'); continue;
      }
      deepMerge(target[k], v, where);
    } else if (target[k] === undefined) {
      target[k] = v; added++;
    } else {
      skipped++;
    }
  }
}

function loadJson(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const bom = raw.charCodeAt(0) === 0xFEFF;
  const obj = JSON.parse(bom ? raw.slice(1) : raw);
  return { obj, bom };
}
function saveJson(p, obj, bom) {
  const txt = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(p, (bom ? '﻿' : '') + txt, 'utf8');
}

function apply(ns, lang, payload) {
  const p = path.join(LOCALES, lang, ns + '.json');
  if (!fs.existsSync(p)) { console.log('  ! missing file', p); return; }
  const { obj, bom } = loadJson(p);
  deepMerge(obj, payload, '');
  saveJson(p, obj, bom);
  console.log('  merged ->', lang + '/' + ns + '.json');
}

// common + errors namespaces
apply('common', 'ku', DATA.common.ku);
apply('common', 'en', DATA.common.en);
apply('errors', 'ku', DATA.errors.ku);
apply('errors', 'en', DATA.errors.en);
// offline_description is a flat common key
apply('common', 'ku', { offline_description: DATA.offline_description.ku });
apply('common', 'en', { offline_description: DATA.offline_description.en });

console.log('\n  added:', added, ' skipped(existing):', skipped, ' conflicts:', conflicts.length);
if (conflicts.length) for (const c of conflicts) console.log('   conflict:', c);
