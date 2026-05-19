// Scans frontend/src for `t('key', 'kurdishFallback')` calls and reports them.
//
// Per system-wide-ux-overhaul task 6.1 (Requirements 12.3): every
// `t(key, fallback)` call must use an English fallback. The Kurdish
// translation lives in ku.json; the fallback string is the English copy.
//
// Usage: node frontend/scripts/find-kurdish-fallbacks.mjs
// Exit code: 0 when no findings, 1 when at least one finding is detected.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const KURDISH_RANGE = /[\u0600-\u06FF]/;

// Match t('key' | "key", 'fallback' | "fallback") with simple non-escaped
// string args. Calls with backticks or template literals are out of scope
// (they are not legal i18next call shapes anyway).
const T_CALL = /\bt\(\s*(['"])([^'"\\]+)\1\s*,\s*(['"])((?:[^'"\\]|\\.)*)\3\s*\)/g;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '__generators__') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
}

const files = [];
walk(ROOT, files);

const findings = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  let m;
  T_CALL.lastIndex = 0;
  while ((m = T_CALL.exec(text)) !== null) {
    const [, , key, , fallback] = m;
    if (KURDISH_RANGE.test(fallback)) {
      const before = text.slice(0, m.index);
      const line = before.split('\n').length;
      findings.push({ file: relative(ROOT, f).replace(/\\/g, '/'), line, key, fallback });
    }
  }
}

const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

if (findings.length === 0) {
  console.log('OK: no t(key, fallback) calls with Kurdish fallbacks.');
  process.exit(0);
}

console.error(
  `FAIL: ${findings.length} t(key, fallback) call(s) with Kurdish fallbacks across ${byFile.size} file(s).`,
);
console.error('Replace each Kurdish fallback with an English string and add the Kurdish translation to ku.json.');
console.error('');
for (const [file, items] of byFile) {
  console.error(`=== ${file} (${items.length})`);
  for (const it of items) {
    console.error(`  ${it.line}: t('${it.key}', '${it.fallback}')`);
  }
}
process.exit(1);
