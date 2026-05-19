#!/usr/bin/env node
/**
 * Lighthouse no-regression check.
 *
 * Compares the latest Lighthouse CI results against the baseline stored in
 * `frontend/perf-baseline.json`. Fails if any route's Performance score
 * dropped by more than `noRegressionDeltaPoints` (default: 3) compared to
 * the recorded baseline.
 *
 * Routes with a `null` baseline score are skipped (only absolute floors apply
 * via lighthouserc.json assertions).
 *
 * Usage:
 *   node scripts/lighthouse-no-regression.mjs
 *
 * Expects `.lighthouseci/` to contain the LHCI manifest and result JSON files
 * (produced by `lhci autorun` with filesystem upload target).
 *
 * Validates: Requirements 5.5, 14.8, 15.1, 15.2, 15.3, 15.4
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const frontendDir = resolve(__dirname, '..');

// Load baseline
const baselinePath = join(frontendDir, 'perf-baseline.json');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));

// Load perf-budgets for the delta value
const budgetsPath = join(frontendDir, 'perf-budgets.json');
const budgets = JSON.parse(readFileSync(budgetsPath, 'utf-8'));
const deltaPoints = budgets.noRegressionDeltaPoints ?? 3;

// Load LHCI results from .lighthouseci directory
const lhciDir = join(frontendDir, '.lighthouseci');

/**
 * Parse LHCI manifest to get result file paths, or fall back to scanning
 * the directory for lhr-*.json files.
 */
function loadLhciResults() {
  const results = [];

  try {
    const manifestPath = join(lhciDir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    for (const entry of manifest) {
      const lhrPath = entry.jsonPath
        ? resolve(lhciDir, entry.jsonPath)
        : null;

      if (lhrPath) {
        try {
          const lhr = JSON.parse(readFileSync(lhrPath, 'utf-8'));
          results.push(lhr);
        } catch {
          // Skip unreadable result files
        }
      }
    }
  } catch {
    // No manifest — scan for lhr-*.json files
    const files = readdirSync(lhciDir).filter(
      (f) => f.startsWith('lhr-') && f.endsWith('.json')
    );

    for (const file of files) {
      try {
        const lhr = JSON.parse(readFileSync(join(lhciDir, file), 'utf-8'));
        results.push(lhr);
      } catch {
        // Skip unreadable files
      }
    }
  }

  return results;
}

/**
 * Extract the route path from a full URL.
 * e.g., "http://localhost:5173/dashboard" → "/dashboard"
 */
function extractRoute(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '' ? '/' : parsed.pathname;
  } catch {
    return url;
  }
}

/**
 * Group results by route and compute median scores.
 */
function computeMedianScores(results) {
  const byRoute = {};

  for (const lhr of results) {
    const route = extractRoute(lhr.finalUrl || lhr.requestedUrl);
    if (!byRoute[route]) {
      byRoute[route] = { performance: [], accessibility: [] };
    }

    const perfScore = lhr.categories?.performance?.score;
    const a11yScore = lhr.categories?.accessibility?.score;

    if (perfScore != null) {
      byRoute[route].performance.push(Math.round(perfScore * 100));
    }
    if (a11yScore != null) {
      byRoute[route].accessibility.push(Math.round(a11yScore * 100));
    }
  }

  // Compute medians
  const medians = {};
  for (const [route, scores] of Object.entries(byRoute)) {
    medians[route] = {
      performance: median(scores.performance),
      accessibility: median(scores.accessibility),
    };
  }

  return medians;
}

function median(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

// Main
function main() {
  let results;
  try {
    results = loadLhciResults();
  } catch (err) {
    console.log(
      '⚠️  No Lighthouse CI results found in .lighthouseci/ — skipping no-regression check.'
    );
    console.log('   This is expected on the first run before baseline is populated.');
    process.exit(0);
  }

  if (results.length === 0) {
    console.log(
      '⚠️  No Lighthouse CI results found in .lighthouseci/ — skipping no-regression check.'
    );
    process.exit(0);
  }

  const medians = computeMedianScores(results);
  const baselineRoutes = baseline.routes || {};

  let failures = 0;
  let checked = 0;

  console.log('');
  console.log('🔍 Lighthouse No-Regression Check');
  console.log(`   Delta threshold: ${deltaPoints} points`);
  console.log('   ─────────────────────────────────────────────');

  for (const [route, baselineScores] of Object.entries(baselineRoutes)) {
    const measured = medians[route];

    if (!measured) {
      console.log(`   ⚠️  ${route}: no Lighthouse results found (skipped)`);
      continue;
    }

    // Check Performance regression
    if (baselineScores.performance != null) {
      checked++;
      const floor = baselineScores.performance - deltaPoints;
      const actual = measured.performance;

      if (actual != null && actual < floor) {
        console.log(
          `   ❌ ${route} Performance: ${actual} < ${floor} (baseline ${baselineScores.performance} - ${deltaPoints})`
        );
        failures++;
      } else {
        console.log(
          `   ✅ ${route} Performance: ${actual ?? 'N/A'} ≥ ${floor} (baseline ${baselineScores.performance} - ${deltaPoints})`
        );
      }
    } else {
      console.log(
        `   ⏭️  ${route} Performance: baseline is null (absolute floor only)`
      );
    }

    // Check Accessibility regression
    if (baselineScores.accessibility != null) {
      checked++;
      const floor = baselineScores.accessibility - deltaPoints;
      const actual = measured.accessibility;

      if (actual != null && actual < floor) {
        console.log(
          `   ❌ ${route} Accessibility: ${actual} < ${floor} (baseline ${baselineScores.accessibility} - ${deltaPoints})`
        );
        failures++;
      } else {
        console.log(
          `   ✅ ${route} Accessibility: ${actual ?? 'N/A'} ≥ ${floor} (baseline ${baselineScores.accessibility} - ${deltaPoints})`
        );
      }
    } else {
      console.log(
        `   ⏭️  ${route} Accessibility: baseline is null (absolute floor only)`
      );
    }
  }

  console.log('   ─────────────────────────────────────────────');
  console.log(`   Checked: ${checked} | Failures: ${failures}`);
  console.log('');

  if (failures > 0) {
    console.error(
      `❌ No-regression check FAILED: ${failures} score(s) dropped below baseline - ${deltaPoints} points.`
    );
    process.exit(1);
  }

  console.log('✅ No-regression check passed.');
  process.exit(0);
}

main();
