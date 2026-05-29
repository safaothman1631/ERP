#!/usr/bin/env node
/**
 * detect-truncation.mjs — T-LR.0.5
 *
 * Walks a list of "high-risk" files (default: every file touched in the
 * last 50 git commits — fall back to the entire frontend/src tree if
 * git history is unavailable) and parses each one. Parse failure is
 * treated as a likely truncation event.
 *
 * - `.ts/.tsx/.js/.jsx/.mjs` — parse with `@babel/parser` if installed;
 *   otherwise use a heuristic looking for known mid-string truncation
 *   patterns (open string at EOF, dangling open brace count, etc.).
 * - `.py` — `python3 -c "import ast; ast.parse(...)"`.
 * - `.json` — `JSON.parse`.
 * - `.yml / .yaml` — parse with `js-yaml` if installed; otherwise a
 *   structure-only heuristic.
 *
 * Output:
 *   - markdown to stdout
 *   - audit/truncation-suspects.json
 *
 * Exit code:
 *   - 1 if any file failed to parse
 *   - 0 otherwise
 *
 * Optional positional arg: path to a newline-separated manifest of files
 * to check (e.g. `git diff --name-only` for a pre-commit hook).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const AUDIT_DIR = path.join(ROOT, 'audit');
const REPORT = path.join(AUDIT_DIR, 'truncation-suspects.json');

/* ---------- optional parsers ---------- */

async function tryLoad(absCandidates, bareSpec) {
  for (const c of absCandidates) {
    if (fs.existsSync(c)) {
      try {
        const m = await import(pathToFileURL(c).href);
        return m.default || m;
      } catch { /* keep trying */ }
    }
  }
  try {
    const m = await import(bareSpec);
    return m.default || m;
  } catch {
    return null;
  }
}

const babelParser = await tryLoad(
  [
    path.join(ROOT, 'frontend', 'node_modules', '@babel', 'parser', 'lib', 'index.js'),
    path.join(ROOT, 'node_modules', '@babel', 'parser', 'lib', 'index.js'),
  ],
  '@babel/parser',
);

const jsYaml = await tryLoad(
  [
    path.join(ROOT, 'frontend', 'node_modules', 'js-yaml', 'lib', 'index.js'),
    path.join(ROOT, 'node_modules', 'js-yaml', 'lib', 'index.js'),
  ],
  'js-yaml',
);

function pythonAvailable() {
  for (const cmd of ['python3', 'python']) {
    try {
      execSync(`${cmd} -c "import sys"`, { stdio: 'pipe' });
      return cmd;
    } catch {}
  }
  return null;
}
const PYTHON = pythonAvailable();

/* ---------- file list collection ---------- */

function collectFromGit(maxCommits = 50) {
  try {
    const raw = execSync(`git -C "${ROOT}" log -n ${maxCommits} --name-only --pretty=format:`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    }).toString();
    const files = new Set();
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const abs = path.join(ROOT, line);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) files.add(abs);
    }
    return [...files];
  } catch {
    return null;
  }
}

function collectFallback() {
  const out = [];
  const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.json', '.yml', '.yaml']);
  const skip = new Set(['node_modules', 'venv', '__pycache__', 'dist', 'build', '.git']);
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (exts.has(path.extname(entry.name))) out.push(full);
    }
  }
  walk(path.join(ROOT, 'frontend', 'src'));
  walk(path.join(ROOT, 'backend', 'app'));
  walk(path.join(ROOT, 'scripts'));
  return out;
}

function readManifest(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim())
    .filter(Boolean).map((p) => path.isAbsolute(p) ? p : path.join(ROOT, p))
    .filter((p) => fs.existsSync(p) && fs.statSync(p).isFile());
}

/* ---------- per-language parsing ---------- */

function parseJsTs(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (babelParser) {
    try {
      babelParser.parse(src, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'topLevelAwait',
          'classProperties',
          'decorators-legacy',
          'importMeta',
          'dynamicImport',
        ],
        errorRecovery: false,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
      });
      return null;
    } catch (e) {
      return { reason: e.message, line: e.loc?.line ?? null };
    }
  }
  // Heuristic fallback: balanced braces + non-truncated tail.
  return heuristicJsTs(src);
}

function heuristicJsTs(src) {
  const tail = src.slice(Math.max(0, src.length - 100));
  // Common truncation indicators: ends mid-identifier, mid-string, open
  // template literal, or trailing `,\n`.
  const suspicious = [];
  // Brace balance.
  let braces = 0, brackets = 0, parens = 0;
  let inStr = null;
  let inLine = false, inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === '{') braces++;
    else if (c === '}') braces--;
    else if (c === '[') brackets++;
    else if (c === ']') brackets--;
    else if (c === '(') parens++;
    else if (c === ')') parens--;
  }
  if (inStr) suspicious.push(`unterminated string (${inStr}) at EOF`);
  if (inBlock) suspicious.push('unterminated /* */ comment at EOF');
  if (braces !== 0) suspicious.push(`unbalanced braces: ${braces}`);
  if (brackets !== 0) suspicious.push(`unbalanced brackets: ${brackets}`);
  if (parens !== 0) suspicious.push(`unbalanced parens: ${parens}`);
  if (/[,({[]\s*$/.test(tail)) suspicious.push('file ends with dangling , ( { [');
  if (suspicious.length === 0) return null;
  return { reason: suspicious.join('; '), line: null };
}

function parsePy(file) {
  if (!PYTHON) {
    return heuristicPy(fs.readFileSync(file, 'utf8'));
  }
  try {
    // Quote-escape minimal one-liner — works on both PowerShell and POSIX
    // shells because execSync uses /bin/sh on Unix and cmd.exe on Windows.
    const py = `import ast,sys;ast.parse(open(r'${file.replace(/'/g, "\\'")}','r',encoding='utf-8').read())`;
    execSync(`${PYTHON} -c "${py.replace(/"/g, '\\"')}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return null;
  } catch (e) {
    return { reason: (e.stderr?.toString() || e.message).split('\n').slice(-3).join(' ').trim(), line: null };
  }
}

function heuristicPy(src) {
  const suspicious = [];
  if (/[\\:({[,]\s*$/.test(src.slice(-100))) suspicious.push('dangling continuation at EOF');
  let parens = 0, brackets = 0, braces = 0;
  for (const c of src) {
    if (c === '(') parens++; else if (c === ')') parens--;
    else if (c === '[') brackets++; else if (c === ']') brackets--;
    else if (c === '{') braces++; else if (c === '}') braces--;
  }
  if (parens) suspicious.push(`unbalanced parens: ${parens}`);
  if (brackets) suspicious.push(`unbalanced brackets: ${brackets}`);
  if (braces) suspicious.push(`unbalanced braces: ${braces}`);
  if (suspicious.length === 0) return null;
  return { reason: suspicious.join('; '), line: null };
}

function parseJson(file) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
    return null;
  } catch (e) {
    return { reason: e.message, line: null };
  }
}

function parseYaml(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (jsYaml) {
    try {
      jsYaml.loadAll(src);
      return null;
    } catch (e) {
      return { reason: e.message, line: e.mark?.line ?? null };
    }
  }
  // Heuristic — last line cannot end with ':' or '-' alone (incomplete key).
  const tail = src.trimEnd().split('\n').pop();
  if (tail && /[:\-]\s*$/.test(tail)) {
    return { reason: 'YAML appears to end mid-key (tail=' + JSON.stringify(tail) + ')', line: null };
  }
  return null;
}

/* ---------- main ---------- */

function main() {
  const args = process.argv.slice(2);
  let files = [];
  const manifestArg = args.find((a) => !a.startsWith('--'));
  if (manifestArg) {
    files = readManifest(manifestArg);
  } else {
    files = collectFromGit(50) || collectFallback();
  }

  // Filter to languages we parse.
  files = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|py|json|yml|yaml)$/.test(f));

  const suspects = [];
  for (const file of files) {
    let res = null;
    const ext = path.extname(file);
    try {
      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx' || ext === '.mjs') {
        res = parseJsTs(file);
      } else if (ext === '.py') {
        res = parsePy(file);
      } else if (ext === '.json') {
        res = parseJson(file);
      } else if (ext === '.yml' || ext === '.yaml') {
        res = parseYaml(file);
      }
    } catch (e) {
      res = { reason: 'parser threw: ' + e.message, line: null };
    }
    if (res) {
      suspects.push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        line: res.line,
        reason: res.reason,
      });
    }
  }

  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify({
    generated_at: new Date().toISOString(),
    files_scanned: files.length,
    parsers: {
      babel_parser: !!babelParser,
      python: !!PYTHON,
      js_yaml: !!jsYaml,
    },
    suspect_count: suspects.length,
    suspects,
  }, null, 2));

  console.log('# Truncation / Parse-failure Audit\n');
  console.log(`Files scanned: ${files.length}`);
  console.log(`Parsers: babel=${!!babelParser ? 'ok' : 'heuristic'}, python=${!!PYTHON ? 'ok' : 'heuristic'}, yaml=${!!jsYaml ? 'ok' : 'heuristic'}\n`);
  if (suspects.length === 0) {
    console.log('No suspects.\n');
    process.exit(0);
  }

  console.log('| File | Line | Reason |');
  console.log('|------|------|--------|');
  for (const s of suspects) console.log(`| \`${s.file}\` | ${s.line ?? '—'} | ${s.reason.replace(/\|/g, '\\|')} |`);
  console.log('');
  process.exit(1);
}

main();
