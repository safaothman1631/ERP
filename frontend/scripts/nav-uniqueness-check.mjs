#!/usr/bin/env node
/**
 * Task 4 invariant gate: verify the relaxed uniqueness invariant.
 *
 * Original invariant (pre-relaxation): no duplicate (surface, path) pairs.
 * Relaxed invariant (user-approved):    no duplicate (source, path) pairs.
 *
 * Rationale: the same destination URL is intentionally reachable from
 * multiple distinct UI controls on the same surface (e.g. QuickCreateMenu's
 * `customer` and `vendor` items both land on /contacts; TopBar.userMenu.settings
 * and OrgSwitcher.manage both land on /settings). The `source` field is the
 * canonical disambiguator — `(source, path)` uniqueness is the meaningful
 * "no two registry entries describe the same control" property.
 *
 * Reports BOTH numbers (legacy and relaxed) for transparency, then exits
 * non-zero only if the relaxed invariant is violated.
 *
 * Node 24 strips TypeScript natively (see nav-audit.mjs Layer 2 comment),
 * so we can `import()` the .ts registry directly.
 */
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const navDestinationsFile = path.join(frontendRoot, 'src', 'layouts', 'navDestinations.ts');

const mod = await import(pathToFileURL(navDestinationsFile).href);
const navDestinations = mod.navDestinations;

if (!Array.isArray(navDestinations)) {
  console.error('FAIL: navDestinations export is not an array');
  process.exit(2);
}

/**
 * @param {string} label
 * @param {(d: { surface: string; source: string; path: string }) => string} keyFn
 */
const tally = (label, keyFn) => {
  /** @type {Map<string, string[]>} */
  const seen = new Map();
  for (const d of navDestinations) {
    const k = keyFn(d);
    const arr = seen.get(k);
    if (arr) arr.push(`${d.surface} | ${d.source} | ${d.path}`);
    else seen.set(k, [`${d.surface} | ${d.source} | ${d.path}`]);
  }
  const dups = [...seen.entries()].filter(([, v]) => v.length > 1);
  return { label, total: navDestinations.length, distinct: seen.size, dups };
};

const surfacePath = tally('(surface, path)', (d) => `${d.surface}::${d.path}`);
const sourcePath = tally('(source, path)', (d) => `${d.source}::${d.path}`);

console.log('navDestinations entries:', navDestinations.length);
console.log('');
console.log(`legacy invariant  ${surfacePath.label}:`);
console.log(`  distinct keys:    ${surfacePath.distinct}`);
console.log(`  duplicate groups: ${surfacePath.dups.length}`);
for (const [k, group] of surfacePath.dups) {
  console.log(`  - ${k}`);
  for (const row of group) console.log(`      ${row}`);
}
console.log('');
console.log(`relaxed invariant ${sourcePath.label}  (the gate):`);
console.log(`  distinct keys:    ${sourcePath.distinct}`);
console.log(`  duplicate groups: ${sourcePath.dups.length}`);
for (const [k, group] of sourcePath.dups) {
  console.log(`  - ${k}`);
  for (const row of group) console.log(`      ${row}`);
}
console.log('');

if (sourcePath.dups.length > 0) {
  console.error('FAIL: relaxed (source, path) uniqueness violated.');
  process.exit(1);
}
console.log('OK: relaxed (source, path) uniqueness holds — 0 duplicate (source, path) pairs.');
process.exit(0);
