#!/usr/bin/env node
/**
 * i18n parity diff — compare `en.json` and `ku.json` and report:
 *   - keys only in en.json (missing in ku.json)
 *   - keys only in ku.json (missing in en.json)
 *   - keys whose value is empty in en.json
 *   - keys whose value is empty in ku.json
 *
 * "Empty" = `""`, `null`, `"TODO"`, `"[missing]"`.
 *
 * Used by task 6.4 of `system-wide-ux-overhaul` to backfill gaps. Kept for
 * ongoing parity checks — exits 0 when all four lists are empty.
 *
 * _Validates: Requirements 11.2, 11.3, 11.6, 11.7, 11.8, 12.1, 12.2_
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(dirname, '..');
const enPath = path.join(repo, 'src', 'locales', 'en.json');
const kuPath = path.join(repo, 'src', 'locales', 'ku.json');

const EMPTY_TOKENS = new Set(['', 'TODO', '[missing]']);

/**
 * Recursively flatten a nested object into a `Map<dottedKey, value>`.
 * Arrays are flattened as `key.0`, `key.1`, ... so we only walk into
 * objects below.
 */
function flatten(obj, prefix = '', out = new Map()) {
  if (obj === null || obj === undefined) {
    out.set(prefix, obj);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, prefix === '' ? String(i) : `${prefix}.${i}`, out));
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      flatten(v, prefix === '' ? k : `${prefix}.${k}`, out);
    }
    return out;
  }
  out.set(prefix, obj);
  return out;
}

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  return EMPTY_TOKENS.has(value);
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ku = JSON.parse(fs.readFileSync(kuPath, 'utf8'));

const enFlat = flatten(en);
const kuFlat = flatten(ku);

const onlyInEn = [];
const onlyInKu = [];
const emptyInEn = [];
const emptyInKu = [];

for (const [k, v] of enFlat) {
  if (!kuFlat.has(k)) onlyInEn.push(k);
  if (isEmpty(v)) emptyInEn.push(k);
}
for (const [k, v] of kuFlat) {
  if (!enFlat.has(k)) onlyInKu.push(k);
  if (isEmpty(v)) emptyInKu.push(k);
}

const total = onlyInEn.length + onlyInKu.length + emptyInEn.length + emptyInKu.length;

console.log(`en.json keys total : ${enFlat.size}`);
console.log(`ku.json keys total : ${kuFlat.size}`);
console.log(`only in en.json    : ${onlyInEn.length}`);
console.log(`only in ku.json    : ${onlyInKu.length}`);
console.log(`empty in en.json   : ${emptyInEn.length}`);
console.log(`empty in ku.json   : ${emptyInKu.length}`);

const dump = (label, list) => {
  if (!list.length) return;
  console.log(`\n=== ${label} (${list.length}) ===`);
  for (const k of list) console.log(`  - ${k}`);
};

dump('only in en.json', onlyInEn);
dump('only in ku.json', onlyInKu);
dump('empty in en.json', emptyInEn);
dump('empty in ku.json', emptyInKu);

if (process.argv.includes('--json')) {
  const out = {
    onlyInEn,
    onlyInKu,
    emptyInEn,
    emptyInKu,
  };
  fs.writeFileSync(
    path.join(repo, 'scripts', 'i18n-parity-diff.report.json'),
    JSON.stringify(out, null, 2),
    'utf8',
  );
  console.log('\nReport written to scripts/i18n-parity-diff.report.json');
}

if (total === 0) {
  console.log('\n✓ en.json and ku.json are at full parity with no empty placeholders.');
  process.exit(0);
}
process.exit(1);
