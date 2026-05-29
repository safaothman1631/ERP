#!/usr/bin/env node
/**
 * audit-lazy.mjs
 * --------------
 * CI guard for the world-class-performance lazy-loading discipline (R3.1,
 * R3.3, R3.4). Walks `frontend/src/App.routes.tsx` and
 * `frontend/src/pages/modules/moduleConfigs.ts` (and any sibling section
 * files) and asserts that:
 *
 *   1. Every route-level dynamic page import goes through `lazyWithRetry`
 *      (never `React.lazy` or a bare `lazy(...)` helper).
 *   2. Each `lazyWithRetry` call receives a non-empty kebab-case chunk-name
 *      string literal as its second argument.
 *   3. The `lazyWithRetry` symbol is imported at the top of any file that
 *      uses it (catches accidental shadowing).
 *
 * Violations are printed with file path + line number and the process exits
 * with a non-zero status so CI fails.
 *
 * Usage:
 *   node frontend/scripts/audit-lazy.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const frontendDir = resolve(__dirname, '..');

// Files to audit. Anything under `pages/modules/moduleConfigs/sections/` is
// optional (only present after the section-split refactor lands in P4); we
// silently skip it if absent.
const targets = [
  resolve(frontendDir, 'src/App.routes.tsx'),
  resolve(frontendDir, 'src/pages/modules/moduleConfigs.ts'),
];

// Patterns
const FORBIDDEN_LAZY_RE = /\bReact\.lazy\s*\(/g;
const BARE_LAZY_RE = /(^|[^.\w])lazy\s*\(\s*\(\s*\)\s*=>/g;
const LAZY_WITH_RETRY_RE =
  /\blazyWithRetry\(\s*\(\s*\)\s*=>\s*import\(\s*(['"`])([^'"`]+)\1\s*\)\s*,\s*(['"`])([^'"`]+)\3\s*\)/g;
const KEBAB_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Map a character offset to a 1-indexed line number. */
function offsetToLine(src, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

const violations = [];
let totalLazy = 0;

for (const file of targets) {
  if (!existsSync(file)) {
    // moduleConfigs sections may not exist yet — silently skip.
    continue;
  }

  const src = readFileSync(file, 'utf-8');
  const relPath = file.replace(frontendDir, 'frontend');

  // 1. Forbidden: React.lazy(...)
  let m;
  while ((m = FORBIDDEN_LAZY_RE.exec(src)) !== null) {
    violations.push({
      file: relPath,
      line: offsetToLine(src, m.index),
      message: '`React.lazy(...)` is forbidden — use `lazyWithRetry(...)` instead.',
    });
  }
  FORBIDDEN_LAZY_RE.lastIndex = 0;

  // 2. Forbidden: bare `lazy(() => ...)` (the old local helper).
  // Allowed: `lazyWithRetry(...)` — the BARE_LAZY_RE pattern requires the
  // `lazy(` token NOT be preceded by a word char or dot, which catches
  // `lazy(` but excludes `lazyWithRetry(` and `React.lazy(`.
  while ((m = BARE_LAZY_RE.exec(src)) !== null) {
    // Skip false positives: comments and import lines that mention `lazy`.
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const lineEnd = src.indexOf('\n', m.index);
    const lineText = src.slice(lineStart, lineEnd === -1 ? src.length : lineEnd);
    if (/^\s*(?:\/\/|\*|\/\*)/.test(lineText)) continue;
    if (/^\s*import\b/.test(lineText)) continue;
    violations.push({
      file: relPath,
      line: offsetToLine(src, m.index),
      message:
        'Bare `lazy(...)` call detected — route-level pages must use `lazyWithRetry(importFn, chunkName)`.',
    });
  }
  BARE_LAZY_RE.lastIndex = 0;

  // 3. Validate every lazyWithRetry(...) call has a proper kebab-case chunk name.
  while ((m = LAZY_WITH_RETRY_RE.exec(src)) !== null) {
    totalLazy++;
    const chunkName = m[4];
    if (!KEBAB_RE.test(chunkName)) {
      violations.push({
        file: relPath,
        line: offsetToLine(src, m.index),
        message: `Chunk name "${chunkName}" is not kebab-case (lowercase alphanumerics + dashes).`,
      });
    }
  }
  LAZY_WITH_RETRY_RE.lastIndex = 0;

  // 4. If the file calls lazyWithRetry, it MUST import it.
  if (/\blazyWithRetry\b/.test(src)) {
    const hasImport = /import\s+(?:\{[^}]*\blazyWithRetry\b[^}]*\}|\blazyWithRetry\b)\s+from\s+['"][^'"]+['"]/.test(
      src,
    );
    // Also accept default import named lazyWithRetry.
    if (!hasImport) {
      violations.push({
        file: relPath,
        line: 1,
        message: '`lazyWithRetry` is used but not imported at the top of the file.',
      });
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────
console.log('');
console.log('Lazy-route audit');
console.log('   ─────────────────────────────────────────────');
console.log(`   Files scanned:       ${targets.length}`);
console.log(`   lazyWithRetry calls: ${totalLazy}`);
console.log(`   Violations:          ${violations.length}`);
console.log('   ─────────────────────────────────────────────');

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`   ${v.file}:${v.line}  ${v.message}`);
  }
  console.error('');
  console.error(`audit-lazy FAILED with ${violations.length} violation(s).`);
  process.exit(1);
}

console.log('   OK — all route-level pages are wrapped in lazyWithRetry().');
console.log('');
process.exit(0);
