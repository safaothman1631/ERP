#!/usr/bin/env node
// @ts-check
/**
 * audit-bundle-size.mjs (T-0.3, R3.7, R1.5)
 *
 * Reads the rollup-plugin-visualizer JSON sidecar emitted alongside
 * `dist/stats.html` and prints a stable JSON shape to stdout:
 *
 *   { "chunks": [{ "name", "size", "gzipSize", "delta" }] }
 *
 * The `delta` field is always 0 here — pairwise comparison lives in
 * post-bundle-diff.mjs.
 *
 * The visualizer is expected to be configured with:
 *   visualizer({ filename: 'dist/stats.html', json: true, gzipSize: true })
 *
 * which writes `dist/stats.json` (rollup-plugin-visualizer >= 5.x).
 *
 * If stats.json is missing we fall back to scanning `dist/assets/*.js`
 * with gzip-size from the fs so the script still produces a useful output
 * during local development.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');
const STATS_JSON = resolve(DIST, 'stats.json');

/** @typedef {{ name: string, size: number, gzipSize: number, delta: number }} ChunkRow */

/**
 * Walk the visualizer tree and flatten it into a list of leaf chunks (the
 * top-level "tree.children" array each represent a chunk).
 *
 * @param {any} node
 * @returns {ChunkRow[]}
 */
function chunksFromStats(node) {
  /** @type {ChunkRow[]} */
  const rows = [];
  if (!node) return rows;
  // The visualizer v5 JSON shape: { tree: { children: [{ uid, name, children?, ... }] }, nodeParts: { [uid]: { renderedLength, gzipLength } } }
  const tree = node.tree || node;
  const nodeParts = node.nodeParts || {};
  const top = tree.children || [];
  for (const chunk of top) {
    const stats = collectStats(chunk, nodeParts);
    rows.push({
      name: chunk.name,
      size: stats.size,
      gzipSize: stats.gzipSize,
      delta: 0,
    });
  }
  return rows;
}

/**
 * @param {any} node
 * @param {Record<string, { renderedLength?: number, gzipLength?: number }>} nodeParts
 */
function collectStats(node, nodeParts) {
  let size = 0;
  let gzipSize = 0;
  if (node.uid && nodeParts[node.uid]) {
    size += nodeParts[node.uid].renderedLength || 0;
    gzipSize += nodeParts[node.uid].gzipLength || 0;
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      const s = collectStats(c, nodeParts);
      size += s.size;
      gzipSize += s.gzipSize;
    }
  }
  return { size, gzipSize };
}

/**
 * Fallback when stats.json doesn't exist — scan dist/assets for .js/.css.
 * @returns {Promise<ChunkRow[]>}
 */
async function fallbackScan() {
  const assetsDir = resolve(DIST, 'assets');
  if (!existsSync(assetsDir)) return [];
  /** @type {ChunkRow[]} */
  const rows = [];
  const entries = await readdir(assetsDir);
  for (const entry of entries) {
    if (!/\.(js|css)$/.test(entry)) continue;
    const p = resolve(assetsDir, entry);
    const st = await stat(p);
    const buf = await readFile(p);
    rows.push({
      name: entry,
      size: st.size,
      gzipSize: gzipSync(buf).length,
      delta: 0,
    });
  }
  return rows;
}

async function main() {
  /** @type {ChunkRow[]} */
  let chunks = [];
  if (existsSync(STATS_JSON)) {
    try {
      const raw = await readFile(STATS_JSON, 'utf8');
      const parsed = JSON.parse(raw);
      chunks = chunksFromStats(parsed);
    } catch (e) {
      process.stderr.write(`[audit-bundle-size] failed to parse ${STATS_JSON}: ${e}\n`);
    }
  }
  if (chunks.length === 0) {
    chunks = await fallbackScan();
  }
  // Sort largest first by gzipSize for stable output.
  chunks.sort((a, b) => b.gzipSize - a.gzipSize);
  process.stdout.write(JSON.stringify({ chunks }, null, 2) + '\n');
}

main().catch((e) => {
  process.stderr.write(`[audit-bundle-size] fatal: ${e?.stack || e}\n`);
  process.exit(1);
});

// Re-export internals for testability.
export { chunksFromStats, collectStats };
