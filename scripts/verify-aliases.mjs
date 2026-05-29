#!/usr/bin/env node
/**
 * verify-aliases.mjs — T-LR.0.4
 *
 * Asserts the alias map declared in TypeScript (`tsconfig.json` /
 * `tsconfig.app.json` `compilerOptions.paths`) matches the one declared in
 * Vite (`vite.config.ts` `resolve.alias`).
 *
 * Why: drift between these two surfaces produces classic "works at runtime
 * but typechecker can't find it" bugs (or vice versa).
 *
 * Exits 1 on drift; prints a diff to stderr.
 *
 * No npm install required — uses only Node built-ins. The TS path lookup
 * walks `references` (project references) so `tsconfig.app.json` paths are
 * picked up from the root `tsconfig.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');

/* ----------------- JSONC-tolerant reader ----------------- */

function readJsonc(file) {
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  // Strip /* */ and // comments and trailing commas.
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const noLine = noBlock.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const noTrail = noLine.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(noTrail);
  } catch (e) {
    console.error(`[verify-aliases] Failed to parse ${file}: ${e.message}`);
    return null;
  }
}

/* ------------------- collect TS aliases ------------------- */

function collectTsPaths(tsconfigPath, accum = {}) {
  const cfg = readJsonc(tsconfigPath);
  if (!cfg) return accum;

  const baseUrl = cfg.compilerOptions?.baseUrl ?? '.';
  const baseDir = path.resolve(path.dirname(tsconfigPath), baseUrl);
  const paths = cfg.compilerOptions?.paths ?? {};
  for (const [key, targets] of Object.entries(paths)) {
    // First target wins (consistent with TS resolution behavior).
    const first = Array.isArray(targets) ? targets[0] : targets;
    if (typeof first !== 'string') continue;
    const resolvedTarget = path.resolve(baseDir, first);
    accum[key] = resolvedTarget;
  }

  // Recurse into project references.
  if (Array.isArray(cfg.references)) {
    for (const ref of cfg.references) {
      if (typeof ref.path === 'string') {
        let refPath = path.resolve(path.dirname(tsconfigPath), ref.path);
        if (fs.statSync(refPath).isDirectory()) {
          refPath = path.join(refPath, 'tsconfig.json');
        }
        collectTsPaths(refPath, accum);
      }
    }
  }

  return accum;
}

/* ----------------- extract Vite aliases ----------------- */

function extractViteAliases(viteConfigPath) {
  // Best-effort regex parse — vite.config.ts is TypeScript so we can't
  // import it without a compiler. We look for an `alias: { ... }` block.
  const src = fs.readFileSync(viteConfigPath, 'utf8');
  // Find `resolve:` block first to scope correctly.
  const resolveIdx = src.indexOf('resolve:');
  if (resolveIdx === -1) return {};
  // Find `alias` after `resolve:`
  const aliasMatch = src.slice(resolveIdx).match(/alias\s*:\s*\{([\s\S]*?)\}/);
  if (!aliasMatch) return {};
  const body = aliasMatch[1];

  const aliases = {};
  // Match entries like `'@': path.resolve(__dirname, './src')`
  //                   or `'@/data': './src/data'`
  const entryRe = /['"]([^'"]+)['"]\s*:\s*([^,\n]+)/g;
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    const key = m[1];
    let value = m[2].trim();
    // Resolve a few common forms:
    let resolved = null;
    const pathResolve = value.match(/path\.resolve\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/);
    const pathJoin = value.match(/path\.join\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/);
    const literal = value.match(/^['"]([^'"]+)['"]$/);
    if (pathResolve) {
      resolved = path.resolve(path.dirname(viteConfigPath), pathResolve[1]);
    } else if (pathJoin) {
      resolved = path.join(path.dirname(viteConfigPath), pathJoin[1]);
    } else if (literal) {
      resolved = path.resolve(path.dirname(viteConfigPath), literal[1]);
    } else {
      // Unknown form — keep raw for the diff.
      resolved = value;
    }
    aliases[key] = resolved;
  }
  return aliases;
}

/* ----------------- normalize keys ----------------- */

function normalizeKey(k) {
  // Strip trailing `/*` so `@/*` and `@` compare equal.
  return k.replace(/\/\*$/, '').replace(/\*$/, '');
}
function normalizeValue(v) {
  if (!v) return v;
  // Strip trailing `*` and `/*`, normalize separators.
  return v.replace(/\\/g, '/').replace(/\/\*$/, '').replace(/\*$/, '').replace(/\/+$/, '');
}

function main() {
  const rootTs = path.join(FRONTEND, 'tsconfig.json');
  const viteConfig = path.join(FRONTEND, 'vite.config.ts');

  if (!fs.existsSync(rootTs)) {
    console.error(`[verify-aliases] Missing ${rootTs}`);
    process.exit(2);
  }
  if (!fs.existsSync(viteConfig)) {
    console.error(`[verify-aliases] Missing ${viteConfig}`);
    process.exit(2);
  }

  const tsRaw = collectTsPaths(rootTs);
  const viteRaw = extractViteAliases(viteConfig);

  const ts = {};
  for (const [k, v] of Object.entries(tsRaw)) ts[normalizeKey(k)] = normalizeValue(v);
  const vite = {};
  for (const [k, v] of Object.entries(viteRaw)) vite[normalizeKey(k)] = normalizeValue(v);

  const allKeys = new Set([...Object.keys(ts), ...Object.keys(vite)]);
  const diffs = [];
  for (const key of [...allKeys].sort()) {
    const a = ts[key];
    const b = vite[key];
    if (a == null) {
      diffs.push({ key, kind: 'missing_in_ts', vite: b });
    } else if (b == null) {
      diffs.push({ key, kind: 'missing_in_vite', ts: a });
    } else if (a !== b) {
      diffs.push({ key, kind: 'target_mismatch', ts: a, vite: b });
    }
  }

  console.log('# Alias Verification\n');
  console.log('## TypeScript paths');
  for (const [k, v] of Object.entries(ts)) console.log(`- \`${k}\` → \`${v}\``);
  console.log('\n## Vite aliases');
  for (const [k, v] of Object.entries(vite)) console.log(`- \`${k}\` → \`${v}\``);
  console.log('');

  if (diffs.length === 0) {
    console.log('Aliases are in sync.\n');
    process.exit(0);
  }

  console.error('\n[verify-aliases] DRIFT DETECTED\n');
  for (const d of diffs) {
    if (d.kind === 'missing_in_ts') {
      console.error(`  - Alias '${d.key}' is in Vite (${d.vite}) but NOT in TS tsconfig paths.`);
    } else if (d.kind === 'missing_in_vite') {
      console.error(`  - Alias '${d.key}' is in TS (${d.ts}) but NOT in Vite resolve.alias.`);
    } else {
      console.error(`  - Alias '${d.key}' targets differ: TS=${d.ts} vs Vite=${d.vite}`);
    }
  }
  process.exit(1);
}

main();
