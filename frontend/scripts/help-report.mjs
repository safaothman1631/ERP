#!/usr/bin/env node
/**
 * help report — non-blocking, human-readable per-`sectionId` completion
 * status for the umbrella spec `system-wide-ux-overhaul` (task 7.5).
 *
 * For every entry in `frontend/src/help/registry.ts`, this script prints
 * the locale completion percentage across the four registry parts:
 *   - `what`
 *   - `why`
 *   - every `relatesTo[].label`
 *   - every `howSteps[]` step
 *
 * Completion = (non-empty values present in the locale) / (keys referenced
 * by the registry entry). "Empty" matches the same token set used by
 * `i18n:coverage` and `i18n:report` — `""`, `null`, `"TODO"`, `"[missing]"`.
 *
 * This is a **reporting** script, not a gating one. It always exits 0 and
 * prints a table to stdout so content owners can see at a glance which
 * Sections still need help-text in either locale. The blocking job is
 * `npm run i18n:coverage` (task 7.4); this script is the editor-facing
 * report referenced by Requirement 16.3 of `system-wide-ux-overhaul/
 * requirements.md`.
 *
 * Loader strategy
 * ---------------
 * Same as `i18n-coverage.mjs` and `verify-settings-help-coverage.mjs`:
 * read `registry.ts` as text and parse the `entry()` calls + their
 * `route:` slots with regex. Keeping the loader in plain Node avoids a
 * TypeScript build step in CI and stays in sync with the registry's
 * key-derivation rules in `helpKeyspace()`:
 *
 *   settings.<key>            → settings.help.<key>.{what,why,step_N,relates_to.<i>.label}
 *   <module>.<entity>[.<sub>] → <module>.<entity>[.<sub>].help.{what,why,step_N,relates_to.<i>.label}
 *
 * Usage:
 *   npm run help:report
 *   node scripts/help-report.mjs
 *
 * _Validates: Requirements 16.3_
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

const REGISTRY_PATH = path.join(repo, 'src', 'help', 'registry.ts');

const EMPTY_TOKENS = new Set(['', 'TODO', '[missing]']);

// ─────────────────────────────────────────────────────────────────────────
// Locale helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Recursively flatten a nested object/array tree into a `Map<dottedKey, value>`.
 *
 * The locale JSONs are mostly flat (dotted keys at the top level), but we
 * flatten defensively so a future nested refactor still resolves.
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

function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return true;
  return !EMPTY_TOKENS.has(value);
}

function loadLocale(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return flatten(JSON.parse(raw), '', new Map());
}

// ─────────────────────────────────────────────────────────────────────────
// Registry parser — keep in sync with `frontend/src/help/registry.ts`
// ─────────────────────────────────────────────────────────────────────────

/**
 * Mirror of `helpKeyspace()` from registry.ts.
 */
function helpKeyspace(sectionId) {
  if (sectionId.startsWith('settings.')) {
    return `settings.help.${sectionId.slice('settings.'.length)}`;
  }
  return `${sectionId}.help`;
}

/**
 * Parse `entry('<sectionId>', <stepCount>, [ ... ])` calls in registry.ts.
 *
 * Returns an array of `{ sectionId, stepCount, relatesToCount }` records in
 * declaration order.
 */
function parseRegistryEntries(src) {
  // sectionId is dotted lowercase + snake_case (matches SECTION_IDS literals).
  const entryRegex = /entry\(\s*'([a-z][a-zA-Z0-9._]*)'\s*,\s*(\d+)\s*,\s*\[([\s\S]*?)\]\s*\)/g;
  const routeRegex = /\{\s*route:\s*'[^']+'/g;

  const out = [];
  let m;
  while ((m = entryRegex.exec(src)) !== null) {
    const sectionId = m[1];
    const stepCount = Number(m[2]);
    const block = m[3];
    let relatesToCount = 0;
    let r;
    routeRegex.lastIndex = 0;
    while ((r = routeRegex.exec(block)) !== null) {
      relatesToCount++;
    }
    out.push({ sectionId, stepCount, relatesToCount });
  }
  return out;
}

/**
 * Build the full list of translation keys an entry depends on.
 */
function keysForEntry(entryRec) {
  const ns = helpKeyspace(entryRec.sectionId);
  const keys = [];
  // four parts: what, why, relatesTo[*].label, howSteps[*]
  keys.push({ part: 'what', key: `${ns}.what` });
  keys.push({ part: 'why',  key: `${ns}.why` });
  for (let i = 0; i < entryRec.relatesToCount; i++) {
    keys.push({ part: 'relatesTo', key: `${ns}.relates_to.${i}.label` });
  }
  for (let n = 1; n <= entryRec.stepCount; n++) {
    keys.push({ part: 'howSteps', key: `${ns}.step_${n}` });
  }
  return keys;
}

// ─────────────────────────────────────────────────────────────────────────
// Report generation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute per-section locale completion. The `parts` breakdown shows which
 * of the four registry parts (what, why, relatesTo, howSteps) is fully
 * complete in the locale ('✓') vs. partially or fully missing ('·').
 */
function computeRow(entryRec, locales) {
  const keys = keysForEntry(entryRec);
  const total = keys.length;

  const partGroups = {
    what:      keys.filter((k) => k.part === 'what'),
    why:       keys.filter((k) => k.part === 'why'),
    relatesTo: keys.filter((k) => k.part === 'relatesTo'),
    howSteps:  keys.filter((k) => k.part === 'howSteps'),
  };

  const perLocale = {};
  for (const { code, map } of locales) {
    let present = 0;
    for (const { key } of keys) {
      if (isPresent(map.get(key))) present++;
    }
    const partsStatus = {};
    for (const [partName, partKeys] of Object.entries(partGroups)) {
      if (partKeys.length === 0) {
        partsStatus[partName] = '–';
        continue;
      }
      const ok = partKeys.every(({ key }) => isPresent(map.get(key)));
      partsStatus[partName] = ok ? '✓' : '·';
    }
    perLocale[code] = {
      present,
      total,
      pct: total === 0 ? 100 : Math.round((present / total) * 100),
      parts: partsStatus,
    };
  }

  return { sectionId: entryRec.sectionId, total, perLocale };
}

function pad(value, width) {
  const s = String(value);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function padLeft(value, width) {
  const s = String(value);
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

function formatPartsCell(parts) {
  // Order: what · why · relatesTo · howSteps
  return `${parts.what}${parts.why}${parts.relatesTo}${parts.howSteps}`;
}

function printTable(rows, localeCodes) {
  // Column widths
  const sectionWidth = Math.max(
    'sectionId'.length,
    ...rows.map((r) => r.sectionId.length),
  );
  const keysWidth = 5;   // e.g. "  9"
  const pctWidth = 5;    // e.g. "100%"
  const partsWidth = 6;  // 4 chars + label spacing

  console.log('Help_Registry report — per-sectionId locale completion');
  console.log('Parts column legend: w=what · y=why · r=relatesTo · h=howSteps   (✓ = complete in locale, · = missing one or more, – = part has no keys)');
  console.log('');

  const header = [
    pad('sectionId', sectionWidth),
    padLeft('keys', keysWidth),
    ...localeCodes.flatMap((code) => [
      padLeft(`${code} %`, pctWidth),
      pad(`${code} whrh`, partsWidth),
    ]),
  ].join('  ');
  console.log(header);
  console.log(
    [
      '─'.repeat(sectionWidth),
      '─'.repeat(keysWidth),
      ...localeCodes.flatMap(() => ['─'.repeat(pctWidth), '─'.repeat(partsWidth)]),
    ].join('  '),
  );

  for (const row of rows) {
    const cells = [
      pad(row.sectionId, sectionWidth),
      padLeft(row.total, keysWidth),
    ];
    for (const code of localeCodes) {
      const loc = row.perLocale[code];
      cells.push(padLeft(`${loc.pct}%`, pctWidth));
      cells.push(pad(formatPartsCell(loc.parts), partsWidth));
    }
    console.log(cells.join('  '));
  }
}

function printSummary(rows, localeCodes) {
  console.log('');
  console.log('Summary');
  console.log('───────');
  const totalSections = rows.length;
  const totalKeys = rows.reduce((acc, r) => acc + r.total, 0);
  console.log(`Sections in registry: ${totalSections}`);
  console.log(`Total help keys checked per locale: ${totalKeys}`);
  for (const code of localeCodes) {
    const presentTotal = rows.reduce((acc, r) => acc + r.perLocale[code].present, 0);
    const fullSections = rows.filter((r) => r.perLocale[code].pct === 100).length;
    const pct = totalKeys === 0 ? 100 : Math.round((presentTotal / totalKeys) * 100);
    console.log(
      `  ${code}: ${pct}% overall (${presentTotal}/${totalKeys} keys, ${fullSections}/${totalSections} sections fully complete)`,
    );
  }
}

function main() {
  const src = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const entries = parseRegistryEntries(src);
  if (entries.length === 0) {
    console.error(`No entries parsed from ${REGISTRY_PATH}.`);
    console.error('Check that registry.ts still uses the entry() helper.');
    // Still exit 0 — this is a non-blocking report.
    process.exit(0);
  }

  const locales = LOCALES.map(({ code, file }) => ({ code, map: loadLocale(file) }));
  const localeCodes = locales.map((l) => l.code);
  const rows = entries.map((e) => computeRow(e, locales));

  printTable(rows, localeCodes);
  printSummary(rows, localeCodes);
  process.exit(0);
}

main();
