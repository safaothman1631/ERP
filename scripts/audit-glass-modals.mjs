#!/usr/bin/env node
/**
 * Reports Ant Design Modal usages with hard-coded primary blue inline styles
 * (global glass CSS + ResponsiveDialog cover the rest).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src');
const HITS = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      walk(p);
      continue;
    }
    if (!/\.(tsx|ts|jsx|js)$/.test(name)) continue;
    const text = readFileSync(p, 'utf8');
    if (!/<Modal[\s>]/.test(text)) continue;
    if (/getGlassStyle|--role-accent|modalRender/.test(text)) continue;
    if (/rgba\(31,\s*111,\s*235/.test(text)) {
      HITS.push(p.replace(join(ROOT, '..', '..') + '\\', '').replace(join(ROOT, '..', '..') + '/', ''));
    }
  }
}

walk(ROOT);

if (HITS.length === 0) {
  console.log('audit-glass-modals: OK — no raw Modal blues without glass wrapper.');
  process.exit(0);
}

console.log('audit-glass-modals: Modal files needing glass migration:');
for (const f of HITS) console.log('  -', f);
process.exit(1);
