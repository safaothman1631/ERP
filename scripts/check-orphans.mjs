#!/usr/bin/env node
/**
 * check-orphans.mjs — T-LR.0.3
 *
 * Crawls the import graph from `frontend/src/main.tsx` and `backend/app/main.py`
 * and lists any file under `frontend/src/` (`.ts/.tsx`) or `backend/app/` (`.py`)
 * that is NEVER reached. Test files are excluded.
 *
 * Implementation notes:
 *   - Pure Node built-ins. No npm install required.
 *   - Frontend graph built via regex AST (best-effort, handles `import`,
 *     `export ... from`, and dynamic `import('...')`).
 *   - Backend graph built via a Python helper (`python3 -c "import ast..."`),
 *     with a regex fallback if Python isn't on PATH.
 *
 * Usage:
 *   node scripts/check-orphans.mjs              # write report
 *   node scripts/check-orphans.mjs --check      # exit non-zero if orphan
 *                                                count > baseline
 *
 * Outputs:
 *   - audit/orphans.json        — structured data for CI / dashboards
 *   - markdown table to stdout
 *   - audit/orphans-baseline.json (read; written once on first run)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const AUDIT_DIR = path.join(ROOT, 'audit');
const ORPHANS_JSON = path.join(AUDIT_DIR, 'orphans.json');
const BASELINE_JSON = path.join(AUDIT_DIR, 'orphans-baseline.json');

const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src');
const FRONTEND_ENTRY = path.join(FRONTEND_SRC, 'main.tsx');

const BACKEND_APP = path.join(ROOT, 'backend', 'app');
const BACKEND_ENTRY = path.join(BACKEND_APP, 'main.py');

const FRONTEND_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

/* ---------------------------- utilities ---------------------------- */

function isTestFile(file) {
  const base = path.basename(file);
  return /\.(test|spec|vitest|integration\.test)\.(ts|tsx|js|jsx|mjs|py)$/.test(base)
    || base === 'test-setup.ts'
    || /(^|\/)tests?\//.test(file.replace(/\\/g, '/'))
    || /(^|\/)__tests__\//.test(file.replace(/\\/g, '/'));
}

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__pycache__' || entry.name === 'venv') continue;
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, exts, out);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

/* --------------------------- frontend graph --------------------------- */

const IMPORT_RE = /(?:^|\n)\s*(?:import\s+(?:[^'"]*?from\s+)?|export\s+(?:[^'"]*?from\s+))?['"]([^'"]+)['"]/g;
const DYN_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveFrontendImport(fromFile, spec) {
  if (!spec) return null;
  // Bare imports (no relative or alias) → npm packages → ignore.
  let target;
  if (spec.startsWith('@/')) {
    target = path.join(FRONTEND_SRC, spec.slice(2));
  } else if (spec.startsWith('.')) {
    target = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null;
  }

  // Try as-is, then with extensions, then index.*
  const candidates = [target];
  for (const ext of FRONTEND_EXTS) candidates.push(target + ext);
  for (const ext of FRONTEND_EXTS) candidates.push(path.join(target, 'index' + ext));

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
  }
  return null;
}

function extractFrontendImports(file) {
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const specs = new Set();
  // Strip block comments + line comments cheaply to avoid commented imports
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  // import "x"; import x from "y"; export ... from "z"
  const importStmt = /(?:^|\n)\s*(?:import|export)\b[^;'"\n]*?['"]([^'"]+)['"]/g;
  let m;
  while ((m = importStmt.exec(clean)) !== null) specs.add(m[1]);
  while ((m = DYN_IMPORT_RE.exec(clean)) !== null) specs.add(m[1]);
  while ((m = REQUIRE_RE.exec(clean)) !== null) specs.add(m[1]);
  return [...specs];
}

function crawlFrontend() {
  const reachable = new Set();
  const stack = [];

  if (fs.existsSync(FRONTEND_ENTRY)) {
    stack.push(path.resolve(FRONTEND_ENTRY));
  }

  // The index.html lists ./src/main.tsx; nothing else to seed.
  while (stack.length) {
    const file = stack.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);

    if (!FRONTEND_EXTS.some((e) => file.endsWith(e))) continue;
    const specs = extractFrontendImports(file);
    for (const spec of specs) {
      const resolved = resolveFrontendImport(file, spec);
      if (resolved && !reachable.has(resolved)) {
        stack.push(resolved);
      }
    }
  }

  return reachable;
}

/* --------------------------- backend graph --------------------------- */

function pythonAvailable() {
  for (const cmd of ['python3', 'python']) {
    try {
      execSync(`${cmd} -c "import sys; print(sys.version)"`, { stdio: 'pipe' });
      return cmd;
    } catch {}
  }
  return null;
}

function extractBackendImportsPy(file, py) {
  // Use Python's `ast` to extract import targets safely.
  // Write the helper script once and reuse it for every file to avoid
  // shell-quoting headaches on Windows.
  if (!extractBackendImportsPy._scriptPath) {
    const tmp = path.join(AUDIT_DIR, '_extract_py_imports.py');
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
    fs.writeFileSync(tmp, [
      'import ast, json, sys',
      'with open(sys.argv[1], "r", encoding="utf-8") as f:',
      '    src = f.read()',
      'try:',
      '    tree = ast.parse(src)',
      'except SyntaxError:',
      '    print("[]"); sys.exit(0)',
      'out = []',
      'for node in ast.walk(tree):',
      '    if isinstance(node, ast.Import):',
      '        for n in node.names:',
      '            out.append(["abs", n.name, 0])',
      '    elif isinstance(node, ast.ImportFrom):',
      '        out.append(["from", node.module or "", node.level or 0])',
      'print(json.dumps(out))',
    ].join('\n'));
    extractBackendImportsPy._scriptPath = tmp;
  }
  try {
    const result = execSync(`${py} "${extractBackendImportsPy._scriptPath}" "${file}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 4 * 1024 * 1024,
    });
    return JSON.parse(result.toString());
  } catch {
    return [];
  }
}

function extractBackendImportsRegex(file) {
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  // from X.Y import Z  /  from . import Z  /  from .X import Z
  const fromRe = /^\s*from\s+(\.+)?([\w.]*)\s+import\s+/gm;
  // import X.Y  /  import X.Y as Z
  const impRe = /^\s*import\s+([\w.]+)(?:\s+as\s+\w+)?/gm;
  let m;
  while ((m = fromRe.exec(src)) !== null) {
    const dots = m[1] || '';
    out.push(['from', m[2] || '', dots.length]);
  }
  while ((m = impRe.exec(src)) !== null) {
    out.push(['abs', m[1], 0]);
  }
  return out;
}

function resolveBackendImport(fromFile, kind, name, level) {
  // Backend layout: app/<mod>.py or app/<pkg>/__init__.py
  // We're only interested in imports that resolve INSIDE backend/app/.
  let baseDir;
  if (kind === 'from' && level > 0) {
    // Relative: from .x → relative to current package.
    let dir = path.dirname(fromFile);
    for (let i = 1; i < level; i++) dir = path.dirname(dir);
    baseDir = dir;
  } else {
    // Absolute. Look for `app.x.y` style. We chop the `app.` prefix.
    if (!name) return [];
    const parts = name.split('.');
    if (parts[0] !== 'app') return [];
    baseDir = BACKEND_APP;
    name = parts.slice(1).join('.');
  }

  if (!name) {
    // `from . import x` — we'd need the actual `x`; skip and treat the
    // package's __init__ as reachable (caller already includes it).
    const initFile = path.join(baseDir, '__init__.py');
    return fs.existsSync(initFile) ? [path.resolve(initFile)] : [];
  }

  const parts = name.split('.').filter(Boolean);
  let dir = baseDir;
  for (let i = 0; i < parts.length - 1; i++) dir = path.join(dir, parts[i]);
  const last = parts[parts.length - 1];

  const candidates = [
    path.join(dir, last + '.py'),
    path.join(dir, last, '__init__.py'),
  ];
  const results = [];
  for (const c of candidates) {
    if (fs.existsSync(c)) results.push(path.resolve(c));
  }
  return results;
}

function crawlBackend() {
  const reachable = new Set();
  const stack = [];
  if (fs.existsSync(BACKEND_ENTRY)) stack.push(path.resolve(BACKEND_ENTRY));

  const py = pythonAvailable();
  if (!py) {
    console.warn('[check-orphans] Python not available; using regex fallback for backend.');
  }

  while (stack.length) {
    const file = stack.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);

    const imports = py ? extractBackendImportsPy(file, py) : extractBackendImportsRegex(file);
    for (const [kind, name, level] of imports) {
      const resolved = resolveBackendImport(file, kind, name, level);
      for (const r of resolved) {
        if (!reachable.has(r)) stack.push(r);
      }
    }
  }
  return reachable;
}

/* ----------------------------- main ----------------------------- */

function loadBaseline() {
  if (!fs.existsSync(BASELINE_JSON)) return { frontend: -1, backend: -1, total: -1 };
  try {
    return JSON.parse(fs.readFileSync(BASELINE_JSON, 'utf8'));
  } catch {
    return { frontend: -1, backend: -1, total: -1 };
  }
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');

  fs.mkdirSync(AUDIT_DIR, { recursive: true });

  console.error('[check-orphans] Crawling frontend graph...');
  const frontendReachable = crawlFrontend();
  const allFrontend = walk(FRONTEND_SRC, FRONTEND_EXTS)
    .filter((f) => !isTestFile(f));
  const frontendOrphans = allFrontend
    .filter((f) => !frontendReachable.has(path.resolve(f)))
    .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));

  console.error('[check-orphans] Crawling backend graph...');
  const backendReachable = crawlBackend();
  const allBackend = walk(BACKEND_APP, ['.py']).filter((f) => !isTestFile(f));
  const backendOrphans = allBackend
    .filter((f) => !backendReachable.has(path.resolve(f)))
    .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));

  const result = {
    generated_at: new Date().toISOString(),
    frontend: {
      entry: path.relative(ROOT, FRONTEND_ENTRY).replace(/\\/g, '/'),
      total: allFrontend.length,
      reachable: frontendReachable.size,
      orphan_count: frontendOrphans.length,
      orphans: frontendOrphans.sort(),
    },
    backend: {
      entry: path.relative(ROOT, BACKEND_ENTRY).replace(/\\/g, '/'),
      total: allBackend.length,
      reachable: backendReachable.size,
      orphan_count: backendOrphans.length,
      orphans: backendOrphans.sort(),
    },
  };

  fs.writeFileSync(ORPHANS_JSON, JSON.stringify(result, null, 2));

  // Markdown to stdout.
  const totalOrphans = frontendOrphans.length + backendOrphans.length;
  console.log('# Orphan Audit\n');
  console.log(`Generated: ${result.generated_at}\n`);
  console.log('| Side | Total | Reachable | Orphans |');
  console.log('|------|-------|-----------|---------|');
  console.log(`| Frontend (${result.frontend.entry}) | ${result.frontend.total} | ${result.frontend.reachable} | ${result.frontend.orphan_count} |`);
  console.log(`| Backend  (${result.backend.entry}) | ${result.backend.total} | ${result.backend.reachable} | ${result.backend.orphan_count} |\n`);

  if (totalOrphans > 0) {
    console.log('## Orphan files\n');
    console.log('| Path | Side |');
    console.log('|------|------|');
    for (const p of frontendOrphans) console.log(`| ${p} | frontend |`);
    for (const p of backendOrphans) console.log(`| ${p} | backend |`);
    console.log('');
  } else {
    console.log('No orphan files detected.\n');
  }

  if (isCheck) {
    const baseline = loadBaseline();
    if (baseline.total === -1) {
      console.error('[check-orphans] No baseline found; writing current as baseline.');
      fs.writeFileSync(BASELINE_JSON, JSON.stringify({
        frontend: frontendOrphans.length,
        backend: backendOrphans.length,
        total: totalOrphans,
        recorded_at: new Date().toISOString(),
      }, null, 2));
      process.exit(0);
    }
    if (totalOrphans > baseline.total) {
      console.error(`[check-orphans] FAIL: orphan count ${totalOrphans} exceeds baseline ${baseline.total}.`);
      process.exit(1);
    }
    console.error(`[check-orphans] OK: ${totalOrphans} ≤ baseline ${baseline.total}.`);
  }
}

main();
