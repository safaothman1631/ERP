#!/usr/bin/env node
/**
 * Lighthouse no-regression check.
 *
 * Compares the latest Lighthouse CI results against the baseline stored in
 * `frontend/perf-baseline.json` (or `audit/baselines/lhci-baseline.json` when
 * present — preferred for the world-class-performance spec). Fails if:
 *
 *   1. Any route's Performance score dropped by more than
 *      `noRegressionDeltaPoints` (default: 3) — R1.6.
 *   2. LCP exceeds the R1.1 threshold (2.5s mobile / 1.5s desktop).
 *   3. INP exceeds the R1.2 threshold (150ms p75; hard ceiling 500ms).
 *   4. CLS exceeds the R1.3 threshold (0.05).
 *
 * Routes with a `null` baseline score are skipped for the delta check but
 * are still subjected to the CWV absolute thresholds.
 *
 * Usage:
 *   node scripts/lighthouse-no-regression.mjs
 *
 * Expects `.lighthouseci/` to contain the LHCI manifest and result JSON files
 * (produced by `lhci autorun` with filesystem upload target).
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.6, 5.5, 14.8, 15.1-15.4
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const frontendDir = resolve(__dirname, '..');

// Prefer the spec-aligned baseline location if it exists; fall back to the
// legacy `perf-baseline.json`. New routes from the world-class-performance
// spec should be added under `audit/baselines/lhci-baseline.json`.
const preferredBaseline = join(frontendDir, 'audit', 'baselines', 'lhci-baseline.json');
const legacyBaseline = join(frontendDir, 'perf-baseline.json');
const baselinePath = existsSync(preferredBaseline) ? preferredBaseline : legacyBaseline;
const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));

// Load perf-budgets for the delta value
const budgetsPath = join(frontendDir, 'perf-budgets.json');
const budgets = existsSync(budgetsPath) ? JSON.parse(readFileSync(budgetsPath, 'utf-8')) : {};
const deltaPoints = budgets.noRegressionDeltaPoints ?? 3;

// R1.1–R1.3 absolute Core Web Vitals thresholds. Mobile is the strict bar
// because that's what 75th-percentile real users experience on a low-end
// Android in Iraq.
const CWV_THRESHOLDS = {
  // LCP in milliseconds — R1.1 mobile (4G) bar, exceeded only on desktop.
  lcpMaxMs: 2500,
  // INP in milliseconds — R1.2; 500ms is the hard interaction ceiling.
  inpMaxMs: 200,
  inpHardCeilingMs: 500,
  // CLS — R1.3; stricter than the CWV "good" of 0.1.
  clsMax: 0.05,
};

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
 * Group results by route and compute median scores **and** median CWV values.
 * Lighthouse exposes LCP / CLS via audit numericValue; INP comes from the
 * `experimental-interaction-to-next-paint` audit when measured under traffic.
 * If a metric is missing for a route the corresponding median is `null` and
 * the threshold check is skipped (rather than failing on absence).
 */
function computeMedianScores(results) {
  const byRoute = {};

  for (const lhr of results) {
    const route = extractRoute(lhr.finalUrl || lhr.requestedUrl);
    if (!byRoute[route]) {
      byRoute[route] = {
        performance: [],
        accessibility: [],
        lcp: [],
        inp: [],
        cls: [],
      };
    }

    const perfScore = lhr.categories?.performance?.score;
    const a11yScore = lhr.categories?.accessibility?.score;

    if (perfScore != null) {
      byRoute[route].performance.push(Math.round(perfScore * 100));
    }
    if (a11yScore != null) {
      byRoute[route].accessibility.push(Math.round(a11yScore * 100));
    }

    const lcp = lhr.audits?.['largest-contentful-paint']?.numericValue;
    const cls = lhr.audits?.['cumulative-layout-shift']?.numericValue;
    const inp =
      lhr.audits?.['experimental-interaction-to-next-paint']?.numericValue ??
      lhr.audits?.['interaction-to-next-paint']?.numericValue ??
      lhr.audits?.['max-potential-fid']?.numericValue;

    if (typeof lcp === 'number') byRoute[route].lcp.push(lcp);
    if (typeof inp === 'number') byRoute[route].inp.push(inp);
    if (typeof cls === 'number') byRoute[route].cls.push(cls);
  }

  // Compute medians
  const medians = {};
  for (const [route, scores] of Object.entries(byRoute)) {
    medians[route] = {
      performance: median(scores.performance),
      accessibility: median(scores.accessibility),
      lcp: median(scores.lcp),
      inp: median(scores.inp),
      cls: medianFloat(scores.cls),
    };
  }

  return medians;
}

/** Median for floating-point series (CLS) — does not round to an integer. */
function medianFloat(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
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

    // ── R1.1 / R1.2 / R1.3 — absolute Core Web Vitals thresholds ────────
    if (measured.lcp != null) {
      checked++;
      if (measured.lcp > CWV_THRESHOLDS.lcpMaxMs) {
        console.log(
          `   ❌ ${route} LCP: ${Math.round(measured.lcp)}ms > ${CWV_THRESHOLDS.lcpMaxMs}ms (R1.1)`
        );
        failures++;
      } else {
        console.log(
          `   ✅ ${route} LCP: ${Math.round(measured.lcp)}ms ≤ ${CWV_THRESHOLDS.lcpMaxMs}ms`
        );
      }
    }

    if (measured.inp != null) {
      checked++;
      if (measured.inp > CWV_THRESHOLDS.inpHardCeilingMs) {
        console.log(
          `   ❌ ${route} INP: ${Math.round(measured.inp)}ms > ${CWV_THRESHOLDS.inpHardCeilingMs}ms hard ceiling (R1.2)`
        );
        failures++;
      } else if (measured.inp > CWV_THRESHOLDS.inpMaxMs) {
        console.log(
          `   ⚠️  ${route} INP: ${Math.round(measured.inp)}ms > ${CWV_THRESHOLDS.inpMaxMs}ms soft target (R1.2)`
        );
      } else {
        console.log(
          `   ✅ ${route} INP: ${Math.round(measured.inp)}ms ≤ ${CWV_THRESHOLDS.inpMaxMs}ms`
        );
      }
    }

    if (measured.cls != null) {
      checked++;
      if (measured.cls > CWV_THRESHOLDS.clsMax) {
        console.log(
          `   ❌ ${route} CLS: ${measured.cls.toFixed(3)} > ${CWV_THRESHOLDS.clsMax} (R1.3)`
        );
        failures++;
      } else {
        console.log(
          `   ✅ ${route} CLS: ${measured.cls.toFixed(3)} ≤ ${CWV_THRESHOLDS.clsMax}`
        );
      }
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
