#!/usr/bin/env node
/**
 * Verify all Settings Help_Content translation keys exist in both
 * `en.json` and `ku.json`, matching exactly what `helpRegistry` references.
 *
 * Reads `frontend/src/help/registry.ts` directly so the check stays in sync
 * with the registry without parallel maintenance.
 *
 * Acceptance criteria validated (task 6.3):
 *   - For every Settings sub-section, all of `what`, `why`,
 *     `step_<n>`, `relates_to.<i>.label` keys exist in both locales.
 *   - Each Settings entry has ≥ 1 relatesTo link to a non-Settings Section.
 *
 * _Validates: Requirements 7.1, 7.3, 7.4, 11.5, 12.6, 17.1_
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(dirname, '..');
const enPath = path.join(repo, 'src', 'locales', 'en.json');
const kuPath = path.join(repo, 'src', 'locales', 'ku.json');
const registryPath = path.join(repo, 'src', 'help', 'registry.ts');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ku = JSON.parse(fs.readFileSync(kuPath, 'utf8'));
const src = fs.readFileSync(registryPath, 'utf8');

const isMissing = (obj, key) => {
  if (!(key in obj)) return true;
  const v = obj[key];
  return v === '' || v == null || v === 'TODO' || v === '[missing]';
};

const isSettingsRoute = (route) =>
  route === '/settings' || route.startsWith('/settings?') || route.startsWith('/settings/');

// Parse Settings entries: entry('settings.<key>', <stepCount>, [ ... ])
const entryRegex = /entry\('settings\.([a-z_]+)',\s*(\d+),\s*\[([\s\S]*?)\]\)/g;
const routeRegex = /route:\s*'([^']+)'/g;

const missingEn = [];
const missingKu = [];
const violations = [];
let totalChecked = 0;
let sectionCount = 0;

let m;
while ((m = entryRegex.exec(src)) !== null) {
  const sectionKey = m[1];
  const stepCount = Number(m[2]);
  const block = m[3];

  sectionCount++;

  const required = [];
  required.push(`settings.help.${sectionKey}.what`);
  required.push(`settings.help.${sectionKey}.why`);
  for (let n = 1; n <= stepCount; n++) {
    required.push(`settings.help.${sectionKey}.step_${n}`);
  }

  const routes = [];
  let r;
  while ((r = routeRegex.exec(block)) !== null) {
    routes.push(r[1]);
  }
  routes.forEach((_, i) => {
    required.push(`settings.help.${sectionKey}.relates_to.${i}.label`);
  });

  // R7.3 check
  const nonSettings = routes.filter((rr) => !isSettingsRoute(rr));
  if (nonSettings.length === 0) {
    violations.push(`settings.${sectionKey}: no non-Settings relatesTo (routes=[${routes.join(', ')}])`);
  }

  for (const k of required) {
    totalChecked++;
    if (isMissing(en, k)) missingEn.push(k);
    if (isMissing(ku, k)) missingKu.push(k);
  }
}

console.log(`Settings sections inspected: ${sectionCount}`);
console.log(`Translation keys checked:    ${totalChecked} per locale`);
console.log(`Missing in en.json:          ${missingEn.length}`);
console.log(`Missing in ku.json:          ${missingKu.length}`);
console.log(`R7.3 violations:             ${violations.length}`);

let exitCode = 0;
if (missingEn.length) {
  console.error('\nMissing in en.json:');
  for (const k of missingEn) console.error(`  - ${k}`);
  exitCode = 1;
}
if (missingKu.length) {
  console.error('\nMissing in ku.json:');
  for (const k of missingKu) console.error(`  - ${k}`);
  exitCode = 1;
}
if (violations.length) {
  console.error('\nR7.3 violations:');
  for (const v of violations) console.error(`  - ${v}`);
  exitCode = 1;
}

if (exitCode === 0) {
  console.log('\n✓ All Settings Help_Content translation keys present in both locales.');
  console.log('✓ Every Settings entry has ≥ 1 non-Settings relatesTo link.');
}
process.exit(exitCode);
