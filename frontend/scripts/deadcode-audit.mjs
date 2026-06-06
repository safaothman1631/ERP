#!/usr/bin/env node
/**
 * deadcode-audit — finds `src/` modules that are never imported by any other
 * module (potential dead code). Convention-matched to the other scripts/*.mjs
 * audits (nav-audit, audit-lazy, rtl-audit).
 *
 * It resolves relative + `@/`-alias imports, dynamic `import()`, `export … from`,
 * `require()`, and `new URL('./x', import.meta.url)` worker specifiers, so the
 * common lazy-route / barrel / worker patterns do NOT show up as false orphans.
 *
 * REPORT-ONLY by default (exit 0) so it can be adopted as an informational CI
 * step on a codebase that already has some dead code. Pass `--strict` to exit 1
 * when any orphan is found (use once the baseline is cleaned).
 *
 * Caveat: a module referenced ONLY by non-statically-analyzable means (a string
 * built at runtime, a glob, an HTML <script>, JSON config) can still appear here.
 * VERIFY each candidate (grep its basename) before deleting.
 *
 * Usage:  node ./scripts/deadcode-audit.mjs [--strict] [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..'); // frontend/
const SRC = join(ROOT, 'src');
const STRICT = process.argv.includes('--strict');
const JSON_OUT = process.argv.includes('--json');

const EXT = ['.ts', '.tsx', '.js', '.jsx'];

// Directories never scanned (reference kit, mocks, generated).
const IGNORE_DIR_SUBSTR = ['Vertex Design System', '__mocks__'];

// Modules consumed by tooling / the platform rather than by another module's
// import — these are legitimately "unreferenced" and must NOT be flagged.
const ENTRY_RE = [
  /\/main\.tsx$/,
  /\/vite-env\.d\.ts$/,
  /\.d\.ts$/,
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\.vitest\.test\.(ts|tsx)$/,
  /\/setupTests?\.ts$/,
  /\/test-setup\.ts$/,
  /\/sw\.ts$/,
  /service-?worker/i,
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (IGNORE_DIR_SUBSTR.some((d) => name.includes(d))) continue;
      walk(p, out);
    } else if (EXT.includes(extname(name))) {
      out.push(p);
    }
  }
  return out;
}

const norm = (p) =>
  p.replace(/\\/g, '/').replace(/\.(ts|tsx|js|jsx)$/, '').replace(/\/index$/, '');

// import x from '…' | export … from '…' | import('…') | require('…') | new URL('…', import.meta.url)
const SPEC_RE =
  /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|new\s+URL\(\s*['"]([^'"]+)['"]/g;

function resolveSpec(spec, fromFile) {
  if (spec.startsWith('@/')) return join(SRC, spec.slice(2));
  if (spec.startsWith('.')) return resolve(dirname(fromFile), spec);
  return null; // bare package import — irrelevant
}

const files = walk(SRC);
const referenced = new Set();

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  SPEC_RE.lastIndex = 0;
  let m;
  while ((m = SPEC_RE.exec(src))) {
    const spec = m[1] || m[2] || m[3] || m[4];
    if (!spec) continue;
    const base = resolveSpec(spec, f);
    if (base) referenced.add(norm(base));
  }
}

const orphans = [];
for (const f of files) {
  const unix = f.replace(/\\/g, '/');
  if (ENTRY_RE.some((re) => re.test(unix))) continue;
  const n = norm(f);
  const keys = [n];
  if (n.endsWith('/index')) keys.push(n.replace(/\/index$/, ''));
  if (!keys.some((k) => referenced.has(k))) orphans.push(relative(ROOT, f).replace(/\\/g, '/'));
}

orphans.sort();

if (JSON_OUT) {
  console.log(JSON.stringify({ count: orphans.length, orphans }, null, 2));
} else {
  if (orphans.length === 0) {
    console.log('✓ deadcode-audit: no orphan modules found.');
  } else {
    console.log('Potential orphan modules (never imported by another module):\n');
    for (const o of orphans) console.log('  ' + o);
    console.log(`\n${orphans.length} candidate(s). VERIFY each (grep basename; check route registries,`);
    console.log('runtime-string imports, glob loaders) before deleting.');
  }
}

if (STRICT && orphans.length) process.exit(1);
