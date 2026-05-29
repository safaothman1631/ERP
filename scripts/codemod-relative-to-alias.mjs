#!/usr/bin/env node
/**
 * codemod-relative-to-alias.mjs — T-LR.0.6
 *
 * Rewrites deep relative imports (`../../../something`) to alias form
 * (`@/something`) when the `@/*` alias is configured to `./src/*`.
 *
 * Rules:
 *   - Only touches files under `frontend/src/`.
 *   - Only rewrites specifiers that walk up THREE or more parent levels.
 *     One- and two-level relatives (`./x`, `../x`) are intentionally
 *     preserved — they're locality signals, not noise.
 *   - Skips test files (we leave the editor experience for tests alone).
 *   - Idempotent: alias-form specifiers are untouched on subsequent runs.
 *   - `--dry-run` shows a unified-ish diff without writing.
 *
 * No npm install required. Pure Node, regex-based; we only touch
 * import/export string literals (not arbitrary string occurrences).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'frontend', 'src');

const DRY = process.argv.includes('--dry-run');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '__pycache__']);

function isTest(file) {
  const base = path.basename(file);
  return /\.(test|spec|vitest|integration\.test)\.(ts|tsx|js|jsx|mjs)$/.test(base)
    || base === 'test-setup.ts';
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !isTest(full)) out.push(full);
  }
  return out;
}

/**
 * Replace import/export string specifiers in `src`. Returns
 * { next, changes: [{from, to}] }.
 */
function rewrite(src, file) {
  const changes = [];
  // Match the whole import/export/dyn-import statement enough to find the
  // string specifier and the quote style.
  const RE = /((?:import|export)\s+[^'"\n;]*?from\s+|import\s*\(\s*|export\s+\*\s+from\s+|export\s+\{[^}]*\}\s+from\s+|import\s+['"]\s*$)?(['"])((?:\.\.\/){3,}[^'"]*)\2/g;

  // Simpler approach: scan for any string literal that begins with three
  // or more `../` and is preceded by a known import/export/require keyword
  // (or `import(`).
  const next = src.replace(/(\bfrom\s*|require\s*\(\s*|import\s*\(\s*|^\s*import\s+['"]|\bexport\s+\*\s+from\s+|\bexport\s+\{[^}]*\}\s+from\s+)(['"])((?:\.\.\/){3,}[^'"\s)]+)(\2)/gm,
    (match, prefix, q1, spec, q2) => {
      // Resolve the spec relative to the file, against SRC.
      const abs = path.resolve(path.dirname(file), spec);
      const relToSrc = path.relative(SRC, abs).replace(/\\/g, '/');
      if (relToSrc.startsWith('..')) {
        // Walks outside src; do not rewrite.
        return match;
      }
      const aliased = `@/${relToSrc}`.replace(/\/+$/, '');
      changes.push({ from: spec, to: aliased });
      return `${prefix}${q1}${aliased}${q2}`;
    });

  return { next, changes };
}

function diffSnippet(file, src, next) {
  const a = src.split('\n');
  const b = next.split('\n');
  const max = Math.max(a.length, b.length);
  const lines = [];
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) {
      if (a[i] !== undefined) lines.push(`- ${a[i]}`);
      if (b[i] !== undefined) lines.push(`+ ${b[i]}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const files = walk(SRC);
  let touched = 0;
  let totalChanges = 0;
  const filesChanged = [];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const { next, changes } = rewrite(src, file);
    if (next !== src && changes.length > 0) {
      touched++;
      totalChanges += changes.length;
      filesChanged.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), changes });
      if (DRY) {
        console.log(`\n--- ${path.relative(ROOT, file).replace(/\\/g, '/')} (${changes.length} change${changes.length === 1 ? '' : 's'})`);
        for (const c of changes) console.log(`  ${c.from}  →  ${c.to}`);
      } else {
        fs.writeFileSync(file, next);
      }
    }
  }

  console.log('\n# codemod-relative-to-alias\n');
  console.log(`Mode: ${DRY ? 'dry-run (no files written)' : 'apply'}`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Files changed: ${touched}`);
  console.log(`Total specifier rewrites: ${totalChanges}\n`);
  if (touched > 0 && !DRY) {
    console.log('## Touched files');
    for (const f of filesChanged) console.log(`- ${f.file} (${f.changes.length})`);
  }
}

main();
