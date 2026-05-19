#!/usr/bin/env node
// Helper: extract Kurdish values for keys that are missing in en.json.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(dirname, '..');
const ku = JSON.parse(fs.readFileSync(path.join(repo, 'src/locales/ku.json'), 'utf8'));
const report = JSON.parse(
  fs.readFileSync(path.join(repo, 'scripts/i18n-parity-diff.report.json'), 'utf8'),
);

function getByPath(obj, key) {
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) cur = cur[Number(p)];
    else cur = cur[p];
  }
  return cur;
}

const out = {};
for (const k of report.onlyInKu) out[k] = getByPath(ku, k);
fs.writeFileSync(
  path.join(repo, 'scripts/_missing-en-values.json'),
  JSON.stringify(out, null, 2),
  'utf8',
);
console.log(`Wrote ${Object.keys(out).length} entries.`);
