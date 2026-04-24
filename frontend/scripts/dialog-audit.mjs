#!/usr/bin/env node
// Phase 3 — Dialog Scanner
// Walks frontend/src/pages/**/*.tsx and extracts every <Modal …> / <Drawer …>
// along with the <Form.Item name="…"> entries inside it.
// Output: JSON array of { file, kind, title, page, fields[] }.
//
// Usage: node frontend/scripts/dialog-audit.mjs > dialogs.json
//
// Heuristic-based (no full TS parse): good enough to give an honest gap list.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = new URL('../src/pages/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (entry.endsWith('.tsx')) yield p;
  }
}

// Find every <Modal …> / <Drawer …> opening tag, capture its slice up to the matching close.
// We don't need a perfect parser — we slice from the opening tag to the next </Modal>/</Drawer>.
function extractDialogs(src, file) {
  const out = [];
  const re = /<(Modal|Drawer)\b([\s\S]*?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const kind = m[1];
    const propsRaw = m[2];
    const close = src.indexOf(`</${kind}>`, re.lastIndex);
    const body = close > 0 ? src.slice(re.lastIndex, close) : '';
    // title= can be string literal, t('x'), or expression — capture plain string or t() arg
    let title = null;
    const titleStr = propsRaw.match(/title=\{?["'`]([^"'`]+)["'`]\}?/);
    if (titleStr) title = titleStr[1];
    else {
      const titleT = propsRaw.match(/title=\{t\(['"`]([^'"`]+)['"`]/);
      if (titleT) title = `t:${titleT[1]}`;
    }
    // Extract Form.Item names inside body
    const fields = new Set();
    const fre = /<Form\.Item\b[^>]*\bname=["'`]([^"'`]+)["'`]/g;
    let fm;
    while ((fm = fre.exec(body))) fields.add(fm[1]);
    out.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      page: basename(file, '.tsx'),
      kind,
      title,
      fields: [...fields].sort(),
    });
  }
  return out;
}

const dialogs = [];
for (const f of walk(ROOT)) {
  const src = readFileSync(f, 'utf8');
  dialogs.push(...extractDialogs(src, f));
}

dialogs.sort((a, b) => a.file.localeCompare(b.file));
console.log(JSON.stringify(dialogs, null, 2));
console.error(`Scanned ${dialogs.length} dialogs across pages.`);
