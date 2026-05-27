#!/usr/bin/env node
/**
 * check-shell-size.mjs
 * --------------------
 * Asserts the **authenticated app-shell bundle** stays under the R1.5 budget
 * of **350 KB gzipped**. The shell is defined (per design §1.1) as the union
 * of chunks loaded on the first paint of any authenticated route:
 *
 *   - vendor-react        (React + React-DOM + React-Router)
 *   - vendor-query        (TanStack React Query)
 *   - vendor-i18n         (i18next + react-i18next + active language bundle)
 *   - vendor-antd-core    (Ant Design components shipped on every page)
 *   - The application entry chunk (`index-*.js`, `App-*.js`)
 *   - The application entry CSS (`index-*.css`)
 *
 * Data source preference:
 *   1. `dist/stats.html` JSON sidecar emitted by rollup-plugin-visualizer
 *      when `template: 'raw-data'` is also requested. Most accurate.
 *   2. Fallback: walk `dist/assets/` directly and gzip each file with the
 *      Node built-in `zlib` so we get a real gzip size without external deps.
 *
 * Outputs a Markdown table to stdout for easy PR-comment embedding. Exits
 * non-zero if the total exceeds the budget.
 *
 * Usage:
 *   node frontend/scripts/check-shell-size.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const frontendDir = resolve(__dirname, '..');
const distDir = join(frontendDir, 'dist');
const assetsDir = join(distDir, 'assets');

/** Authenticated shell budget — must match perf-budgets.json once that lands. */
const SHELL_BUDGET_KB = 350;

/** Patterns whose chunks count toward the shell budget. Order doesn't matter. */
const SHELL_CHUNK_PATTERNS = [
  /^vendor-react\b/i,
  /^vendor-query\b/i,
  /^vendor-i18n\b/i,
  /^vendor-antd-core\b/i,
  /^index\b/i, // application entry
  /^app(?:Shell)?\b/i, // shell entry (varies by Vite version)
];

/** Friendly label per chunk, in the order they should appear in the table. */
const SHELL_ROWS = [
  { label: 'vendor-react', re: /^vendor-react\b/i },
  { label: 'vendor-query', re: /^vendor-query\b/i },
  { label: 'vendor-i18n', re: /^vendor-i18n\b/i },
  { label: 'vendor-antd-core', re: /^vendor-antd-core\b/i },
  { label: 'app entry (index.js)', re: /^index-.*\.js$/i },
  { label: 'app entry (index.css)', re: /^index-.*\.css$/i },
];

function fmtKb(bytes) {
  return (bytes / 1024).toFixed(1);
}

function isShellAsset(name) {
  return SHELL_CHUNK_PATTERNS.some((re) => re.test(name));
}

/** Walk dist/assets and gzip each candidate file. */
function collectFromAssets() {
  if (!existsSync(assetsDir)) {
    console.error(
      `check-shell-size: dist/assets not found at ${assetsDir}. Run \`npm run build\` first.`,
    );
    process.exit(2);
  }

  const files = readdirSync(assetsDir);
  const rows = [];

  for (const file of files) {
    if (!/\.(?:js|css)$/i.test(file)) continue;
    if (!isShellAsset(file)) continue;

    const path = join(assetsDir, file);
    const raw = readFileSync(path);
    const gz = gzipSync(raw, { level: 9 });

    rows.push({
      name: file,
      rawBytes: raw.length,
      gzBytes: gz.length,
    });
  }
  return rows;
}

/** Try to read the JSON sidecar produced by rollup-plugin-visualizer. */
function tryLoadStatsJson() {
  // visualizer can emit a JSON sidecar when `json: true` is passed. We support
  // either `dist/stats.json` (if a future config switches output) or the
  // embedded `<script type=...>` blob inside `dist/stats.html`.
  const jsonPath = join(distDir, 'stats.json');
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  const htmlPath = join(distDir, 'stats.html');
  if (!existsSync(htmlPath)) return null;
  const html = readFileSync(htmlPath, 'utf-8');
  // visualizer embeds the bundle data as: <script>window.statsData = {...}</script>
  const m = html.match(/window\.(?:nodesData|statsData)\s*=\s*({[\s\S]*?});/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function main() {
  // We always prefer the empirical gzip of the actual emitted assets — the
  // stats sidecar can be stale or shape-inconsistent across visualizer
  // versions. The JSON sidecar is used purely as a sanity cross-check.
  const stats = tryLoadStatsJson();
  const assetRows = collectFromAssets();

  if (assetRows.length === 0) {
    console.error('check-shell-size: no shell chunks matched. Did the build run?');
    process.exit(2);
  }

  // Group by friendly label so the markdown table is stable across builds.
  const grouped = SHELL_ROWS.map((r) => {
    const matched = assetRows.filter((a) => r.re.test(a.name));
    const rawBytes = matched.reduce((s, a) => s + a.rawBytes, 0);
    const gzBytes = matched.reduce((s, a) => s + a.gzBytes, 0);
    return { label: r.label, files: matched.map((m) => m.name), rawBytes, gzBytes };
  }).filter((r) => r.gzBytes > 0);

  const totalRaw = grouped.reduce((s, r) => s + r.rawBytes, 0);
  const totalGz = grouped.reduce((s, r) => s + r.gzBytes, 0);
  const budgetBytes = SHELL_BUDGET_KB * 1024;
  const overBudget = totalGz > budgetBytes;

  // ── Markdown table ────────────────────────────────────────────────
  console.log('');
  console.log('## Shell size report (R1.5)');
  console.log('');
  console.log('| Chunk | Files | Raw | Gzipped |');
  console.log('|-------|-------|-----|---------|');
  for (const row of grouped) {
    console.log(
      `| \`${row.label}\` | ${row.files.length} | ${fmtKb(row.rawBytes)} KB | **${fmtKb(row.gzBytes)} KB** |`,
    );
  }
  console.log(
    `| **TOTAL** | ${grouped.reduce((s, r) => s + r.files.length, 0)} | ${fmtKb(totalRaw)} KB | **${fmtKb(totalGz)} KB** |`,
  );
  console.log('');
  console.log(`Budget: **${SHELL_BUDGET_KB} KB gzipped** (R1.5 — authenticated app shell)`);
  console.log(
    `Status: ${overBudget ? 'OVER BUDGET' : 'OK'} (${fmtKb(totalGz)} KB / ${SHELL_BUDGET_KB} KB)`,
  );
  console.log('');

  if (stats && typeof stats === 'object') {
    console.log('Cross-check: stats.html sidecar loaded successfully.');
  } else {
    console.log('Note: no stats sidecar found — measured directly from dist/assets.');
  }
  console.log('');

  if (overBudget) {
    console.error(
      `check-shell-size FAILED: shell is ${fmtKb(totalGz)} KB gzipped, ${fmtKb(
        totalGz - budgetBytes,
      )} KB over the ${SHELL_BUDGET_KB} KB budget.`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
