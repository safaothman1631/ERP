// Endpoint audit: cross-check every `api.get/post/put/delete('/api/...')` call
// in the frontend against the FastAPI route table.
//
// Inputs:
//   _api_routes.json  (run backend/scripts/api_routes.py first)
// Output:
//   ../../MASTER_AUDIT_REPORTS/endpoints.md
//
// We only flag *definitely* unknown paths. Path params (e.g. `/api/x/${id}`)
// are normalised to `/api/x/{id}` before comparison.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const frontendSrc = path.join(repoRoot, 'frontend', 'src');
const apiRoutesPath = path.join(repoRoot, 'backend', 'scripts', '_api_routes.json');
const reportDir = path.join(repoRoot, 'MASTER_AUDIT_REPORTS');
const reportPath = path.join(reportDir, 'endpoints.md');

if (!fs.existsSync(apiRoutesPath)) {
  console.error(`Missing ${apiRoutesPath}. Run backend/scripts/api_routes.py first.`);
  process.exit(1);
}

const routes = JSON.parse(fs.readFileSync(apiRoutesPath, 'utf-8'));
// build a lookup keyed by normalised path → set(methods)
// IMPORTANT: same path can be registered multiple times for different verbs
// (e.g. GET /api/accounts and POST /api/accounts), so MERGE methods.
const routeMap = new Map();
for (const r of routes) {
  const key = r.path.replace(/\/+$/, '');
  if (!routeMap.has(key)) routeMap.set(key, new Set());
  for (const m of r.methods) routeMap.get(key).add(m);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const callRegex = /api\.(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
const calls = []; // {file, line, method, raw}
for (const file of walk(frontendSrc)) {
  const text = fs.readFileSync(file, 'utf-8');
  let m;
  while ((m = callRegex.exec(text)) !== null) {
    const [, method, raw] = m;
    if (!raw.startsWith('/api/')) continue;
    const lineNum = text.slice(0, m.index).split('\n').length;
    calls.push({ file: path.relative(repoRoot, file), line: lineNum, method: method.toUpperCase(), raw });
  }
}

function normalise(raw) {
  // strip query string
  let p = raw.split('?')[0];
  // template literal interpolation `${x}` → {x}
  p = p.replace(/\$\{[^}]+\}/g, '{x}');
  // already-named params like {id} stay
  // remove trailing slash
  p = p.replace(/\/+$/, '');
  return p;
}

function findRoute(callPath, method) {
  // direct hit
  const direct = routeMap.get(callPath);
  if (direct?.has(method)) return { kind: 'ok', match: callPath };
  if (direct) return { kind: 'method-mismatch', match: callPath, allowed: [...direct] };

  // try matching with parameter wildcarding
  const callSegs = callPath.split('/');
  for (const [routePath, methods] of routeMap.entries()) {
    const routeSegs = routePath.split('/');
    if (routeSegs.length !== callSegs.length) continue;
    let ok = true;
    for (let i = 0; i < routeSegs.length; i++) {
      const r = routeSegs[i];
      const c = callSegs[i];
      if (r === c) continue;
      if (r.startsWith('{') && r.endsWith('}')) continue;
      ok = false;
      break;
    }
    if (ok) {
      if (methods.has(method)) return { kind: 'ok', match: routePath };
      return { kind: 'method-mismatch', match: routePath, allowed: [...methods] };
    }
  }
  return { kind: 'not-found' };
}

const findings = [];
for (const c of calls) {
  const norm = normalise(c.raw);
  const res = findRoute(norm, c.method);
  findings.push({ ...c, normalised: norm, ...res });
}

const unique = new Map();
for (const f of findings) {
  const key = `${f.method} ${f.normalised}`;
  if (!unique.has(key)) unique.set(key, { ...f, hits: 1 });
  else unique.get(key).hits += 1;
}
const rows = [...unique.values()];

const ok = rows.filter(r => r.kind === 'ok');
const mismatch = rows.filter(r => r.kind === 'method-mismatch');
const missing = rows.filter(r => r.kind === 'not-found');

fs.mkdirSync(reportDir, { recursive: true });
const lines = [];
lines.push('# Endpoint Audit Report\n');
lines.push(`Generated: ${new Date().toISOString()}\n`);
lines.push(`- Backend routes registered: **${routes.length}**`);
lines.push(`- Distinct frontend API calls: **${rows.length}** (across ${calls.length} call sites)`);
lines.push(`- ✅ Healthy: **${ok.length}**`);
lines.push(`- ⚠️  Method mismatch: **${mismatch.length}**`);
lines.push(`- ❌ Endpoint not registered: **${missing.length}**\n`);

if (missing.length) {
  lines.push('## ❌ Missing endpoints (frontend calls a path that the backend does not expose)\n');
  lines.push('| Method | Path | Hits | First call site |');
  lines.push('|--------|------|------|-----------------|');
  for (const r of missing.sort((a, b) => a.normalised.localeCompare(b.normalised))) {
    lines.push(`| ${r.method} | \`${r.normalised}\` | ${r.hits} | ${r.file}:${r.line} |`);
  }
  lines.push('');
}

if (mismatch.length) {
  lines.push('## ⚠️  Method mismatch (path exists, but wrong HTTP verb)\n');
  lines.push('| Called | Path | Allowed | Hits | First call site |');
  lines.push('|--------|------|---------|------|-----------------|');
  for (const r of mismatch.sort((a, b) => a.normalised.localeCompare(b.normalised))) {
    lines.push(`| ${r.method} | \`${r.normalised}\` | ${(r.allowed || []).join(',')} | ${r.hits} | ${r.file}:${r.line} |`);
  }
  lines.push('');
}

lines.push('## ✅ Healthy endpoints (sample, first 60)\n');
lines.push('| Method | Path | Hits |');
lines.push('|--------|------|------|');
for (const r of ok.sort((a, b) => b.hits - a.hits).slice(0, 60)) {
  lines.push(`| ${r.method} | \`${r.normalised}\` | ${r.hits} |`);
}
lines.push('');

fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
console.log(`Wrote ${reportPath}`);
console.log(`ok=${ok.length}  mismatch=${mismatch.length}  missing=${missing.length}`);
