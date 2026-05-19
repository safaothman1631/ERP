#!/usr/bin/env node
/**
 * i18n-coverage — CI quality gate enforcing P1 + P3 conditions.
 *
 * Checks:
 *   1. Symmetric-difference: en.json and ku.json must have identical key sets.
 *   2. No invalid values: rejects "", null, "TODO", "[missing]".
 *   3. useHelp(id) call-site coverage: every `sectionId` referenced via
 *      `useHelp(id)` or `<HelpIcon sectionId="id">` in any .tsx file must
 *      exist in the helpRegistry (SECTION_IDS).
 *   4. helpRegistry entry validation: every referenced translation key in
 *      the registry must exist in both locales with non-empty values, and
 *      howSteps.length must be in [2, 7].
 *   5. Per-locale 100% gate (never average).
 *
 * Exit code 0 = pass, 1 = fail.
 *
 * _Validates: Requirements 7.2, 8.5, 13.1, 13.2, 13.3, 13.6, 13.7_
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(dirname, '..');
const srcDir = path.join(repo, 'src');
const enPath = path.join(srcDir, 'locales', 'en.json');
const kuPath = path.join(srcDir, 'locales', 'ku.json');
const registryPath = path.join(srcDir, 'help', 'registry.ts');
const sectionIdsPath = path.join(srcDir, 'help', 'sectionIds.ts');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const INVALID_VALUES = new Set(['', 'TODO', '[missing]']);

function isInvalid(value) {
  if (value == null) return true;
  if (typeof value === 'string' && INVALID_VALUES.has(value)) return true;
  return false;
}

/**
 * Recursively walk a directory and yield file paths matching a filter.
 */
function* walkDir(dir, filter) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, dist, .git, test directories
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      yield* walkDir(full, filter);
    } else if (filter(entry.name)) {
      yield full;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Load locale files
// ─────────────────────────────────────────────────────────────────────────────

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ku = JSON.parse(fs.readFileSync(kuPath, 'utf8'));
const enKeys = new Set(Object.keys(en));
const kuKeys = new Set(Object.keys(ku));

// ─────────────────────────────────────────────────────────────────────────────
// Check 1: Symmetric difference (P1)
// ─────────────────────────────────────────────────────────────────────────────

const onlyInEn = [...enKeys].filter((k) => !kuKeys.has(k));
const onlyInKu = [...kuKeys].filter((k) => !enKeys.has(k));

// ─────────────────────────────────────────────────────────────────────────────
// Check 2: Invalid values (P1)
// ─────────────────────────────────────────────────────────────────────────────

const invalidEn = [];
const invalidKu = [];

for (const k of enKeys) {
  if (isInvalid(en[k])) invalidEn.push(k);
}
for (const k of kuKeys) {
  if (isInvalid(ku[k])) invalidKu.push(k);
}

// ─────────────────────────────────────────────────────────────────────────────
// Load SECTION_IDS from sectionIds.ts
// ─────────────────────────────────────────────────────────────────────────────

const sectionIdsSrc = fs.readFileSync(sectionIdsPath, 'utf8');
const sectionIdMatches = sectionIdsSrc.match(/'([^']+)'/g) || [];
const SECTION_IDS = new Set(sectionIdMatches.map((s) => s.slice(1, -1)));

// ─────────────────────────────────────────────────────────────────────────────
// Check 3: Walk .tsx files for useHelp(id) call sites (P3)
// ─────────────────────────────────────────────────────────────────────────────

// Patterns to detect:
//   useHelp('sectionId')  or  useHelp("sectionId")
//   <HelpIcon sectionId="..." />  or  sectionId='...'
const useHelpRegex = /useHelp\(\s*['"]([^'"]+)['"]\s*\)/g;
const helpIconRegex = /<HelpIcon[^>]*\bsectionId\s*=\s*['"]([^'"]+)['"]/g;

const unresolvedIds = []; // { file, line, id }

for (const filePath of walkDir(srcDir, (name) => name.endsWith('.tsx'))) {
  // Skip test files
  if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__test')) continue;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(repo, filePath);

  // Search for useHelp('id') patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;

    useHelpRegex.lastIndex = 0;
    while ((match = useHelpRegex.exec(line)) !== null) {
      const id = match[1];
      if (!SECTION_IDS.has(id)) {
        unresolvedIds.push({ file: relPath, line: i + 1, id });
      }
    }

    helpIconRegex.lastIndex = 0;
    while ((match = helpIconRegex.exec(line)) !== null) {
      const id = match[1];
      if (!SECTION_IDS.has(id)) {
        unresolvedIds.push({ file: relPath, line: i + 1, id });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 4: Walk helpRegistry entries (P3)
// ─────────────────────────────────────────────────────────────────────────────

const registrySrc = fs.readFileSync(registryPath, 'utf8');

// Parse all entry() calls: entry('sectionId', stepCount, [ ... ])
const entryRegex = /entry\('([^']+)',\s*(\d+),\s*\[([\s\S]*?)\]\)/g;
const routeRegex = /route:\s*'([^']+)'/g;

const registryErrors = [];
const howStepsErrors = [];
let registryEntryCount = 0;

let entryMatch;
while ((entryMatch = entryRegex.exec(registrySrc)) !== null) {
  const sectionId = entryMatch[1];
  const stepCount = Number(entryMatch[2]);
  const block = entryMatch[3];
  registryEntryCount++;

  // Determine the key namespace (same logic as registry.ts helpKeyspace)
  let ns;
  if (sectionId.startsWith('settings.')) {
    const key = sectionId.slice('settings.'.length);
    ns = `settings.help.${key}`;
  } else {
    ns = `${sectionId}.help`;
  }

  // Check howSteps length constraint [2, 7]
  if (stepCount < 2 || stepCount > 7) {
    howStepsErrors.push(`${sectionId}: howSteps.length = ${stepCount} (must be 2–7)`);
  }

  // Collect all translation keys this entry references
  const requiredKeys = [];
  requiredKeys.push(`${ns}.what`);
  requiredKeys.push(`${ns}.why`);
  for (let n = 1; n <= stepCount; n++) {
    requiredKeys.push(`${ns}.step_${n}`);
  }

  // Parse relatesTo routes to get label keys
  const routes = [];
  let routeMatch;
  routeRegex.lastIndex = 0;
  while ((routeMatch = routeRegex.exec(block)) !== null) {
    routes.push(routeMatch[1]);
  }
  routes.forEach((_, i) => {
    requiredKeys.push(`${ns}.relates_to.${i}.label`);
  });

  // Verify each key exists in both locales with valid values
  for (const key of requiredKeys) {
    if (!enKeys.has(key) || isInvalid(en[key])) {
      registryErrors.push({ sectionId, key, locale: 'en' });
    }
    if (!kuKeys.has(key) || isInvalid(ku[key])) {
      registryErrors.push({ sectionId, key, locale: 'ku' });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Summary
// ─────────────────────────────────────────────────────────────────────────────

const totalEnKeys = enKeys.size;
const totalKuKeys = kuKeys.size;
const validEnCount = totalEnKeys - invalidEn.length;
const validKuCount = totalKuKeys - invalidKu.length;
const enCoverage = totalEnKeys > 0 ? ((validEnCount / totalEnKeys) * 100).toFixed(2) : '100.00';
const kuCoverage = totalKuKeys > 0 ? ((validKuCount / totalKuKeys) * 100).toFixed(2) : '100.00';

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║              i18n Coverage Report                           ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  en.json keys:          ${String(totalEnKeys).padStart(6)}                          ║`);
console.log(`║  ku.json keys:          ${String(totalKuKeys).padStart(6)}                          ║`);
console.log(`║  Symmetric difference:  ${String(onlyInEn.length + onlyInKu.length).padStart(6)} keys                     ║`);
console.log(`║  Invalid en values:     ${String(invalidEn.length).padStart(6)}                          ║`);
console.log(`║  Invalid ku values:     ${String(invalidKu.length).padStart(6)}                          ║`);
console.log(`║  en coverage:           ${enCoverage.padStart(7)}%                       ║`);
console.log(`║  ku coverage:           ${kuCoverage.padStart(7)}%                       ║`);
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  Help registry entries: ${String(registryEntryCount).padStart(6)}                          ║`);
console.log(`║  Registry key errors:   ${String(registryErrors.length).padStart(6)}                          ║`);
console.log(`║  howSteps violations:   ${String(howStepsErrors.length).padStart(6)}                          ║`);
console.log(`║  Unresolved useHelp:    ${String(unresolvedIds.length).padStart(6)}                          ║`);
console.log('╚══════════════════════════════════════════════════════════════╝');

// ─────────────────────────────────────────────────────────────────────────────
// Report failures
// ─────────────────────────────────────────────────────────────────────────────

let exitCode = 0;

// Symmetric difference
if (onlyInEn.length > 0) {
  console.error(`\n✗ Keys only in en.json (${onlyInEn.length}):`);
  for (const k of onlyInEn.slice(0, 20)) console.error(`    - ${k}`);
  if (onlyInEn.length > 20) console.error(`    ... and ${onlyInEn.length - 20} more`);
  exitCode = 1;
}
if (onlyInKu.length > 0) {
  console.error(`\n✗ Keys only in ku.json (${onlyInKu.length}):`);
  for (const k of onlyInKu.slice(0, 20)) console.error(`    - ${k}`);
  if (onlyInKu.length > 20) console.error(`    ... and ${onlyInKu.length - 20} more`);
  exitCode = 1;
}

// Invalid values
if (invalidEn.length > 0) {
  console.error(`\n✗ Invalid values in en.json (${invalidEn.length}):`);
  for (const k of invalidEn.slice(0, 20)) console.error(`    - ${k}: ${JSON.stringify(en[k])}`);
  if (invalidEn.length > 20) console.error(`    ... and ${invalidEn.length - 20} more`);
  exitCode = 1;
}
if (invalidKu.length > 0) {
  console.error(`\n✗ Invalid values in ku.json (${invalidKu.length}):`);
  for (const k of invalidKu.slice(0, 20)) console.error(`    - ${k}: ${JSON.stringify(ku[k])}`);
  if (invalidKu.length > 20) console.error(`    ... and ${invalidKu.length - 20} more`);
  exitCode = 1;
}

// Unresolved useHelp IDs
if (unresolvedIds.length > 0) {
  console.error(`\n✗ useHelp/HelpIcon references not in helpRegistry (${unresolvedIds.length}):`);
  for (const { file, line, id } of unresolvedIds.slice(0, 20)) {
    console.error(`    - ${file}:${line} → sectionId="${id}"`);
  }
  if (unresolvedIds.length > 20) console.error(`    ... and ${unresolvedIds.length - 20} more`);
  exitCode = 1;
}

// howSteps length violations
if (howStepsErrors.length > 0) {
  console.error(`\n✗ howSteps length violations (${howStepsErrors.length}):`);
  for (const err of howStepsErrors) console.error(`    - ${err}`);
  exitCode = 1;
}

// Registry key errors
if (registryErrors.length > 0) {
  console.error(`\n✗ Help registry keys missing or invalid in locale files (${registryErrors.length}):`);
  const grouped = {};
  for (const { sectionId, key, locale } of registryErrors) {
    const k = `${key} [${locale}]`;
    if (!grouped[sectionId]) grouped[sectionId] = [];
    grouped[sectionId].push(k);
  }
  const sections = Object.keys(grouped);
  for (const s of sections.slice(0, 15)) {
    console.error(`    ${s}:`);
    for (const k of grouped[s].slice(0, 5)) console.error(`      - ${k}`);
    if (grouped[s].length > 5) console.error(`      ... and ${grouped[s].length - 5} more`);
  }
  if (sections.length > 15) console.error(`    ... and ${sections.length - 15} more sections`);
  exitCode = 1;
}

// Per-locale 100% gate
if (enCoverage !== '100.00' || kuCoverage !== '100.00') {
  if (exitCode === 0) {
    console.error('\n✗ Per-locale 100% coverage gate failed:');
    if (enCoverage !== '100.00') console.error(`    en: ${enCoverage}% (must be 100%)`);
    if (kuCoverage !== '100.00') console.error(`    ku: ${kuCoverage}% (must be 100%)`);
    exitCode = 1;
  }
}

// Success
if (exitCode === 0) {
  console.log('\n✓ i18n coverage: 100% parity, no invalid values.');
  console.log('✓ All useHelp/HelpIcon sectionIds resolve in helpRegistry.');
  console.log('✓ All helpRegistry translation keys present in both locales.');
  console.log('✓ All howSteps lengths within [2, 7].');
}

process.exit(exitCode);
