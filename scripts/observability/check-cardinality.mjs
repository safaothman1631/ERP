#!/usr/bin/env node
// @ts-check
/**
 * check-cardinality.mjs (T-SF.5.x — cardinality budget lint)
 *
 * Time-series cost in Prometheus / Cloud Monitoring is driven by the number of
 * distinct label-value combinations (the cardinality). A single label whose
 * value is per-user, per-request, or a raw URL can explode a metric into
 * millions of series — blowing up cost and breaking dashboards.
 *
 * This lint statically scans the repo for metric definitions and flags:
 *   1. UNBOUNDED label names (denylist): id, user_id, session_id, request_id,
 *      trace_id, email, token, url, path, query, ip, host, sku ... — values
 *      that are effectively unique per event.
 *   2. Metrics that exceed the per-metric LABEL BUDGET (default 5 labels).
 *   3. Log-based-metric label_extractors (Terraform) that pull an unbounded
 *      field into a metric label.
 *
 * Sources scanned:
 *   - backend/app/observability/metrics.py  (prometheus_client Counter/…/Gauge)
 *   - backend/app (recursively)              (any other Counter/Histogram/Gauge)
 *   - terraform/monitoring (*.tf)            (google_logging_metric label_extractors)
 *
 * Exit code: 0 = within budget, 1 = at least one violation (or an unexpected
 * error). Designed to run in CI (ci-quality.yml) as a non-blocking-then-blocking
 * ratchet, same pattern as the other scripts/*.mjs linters.
 *
 * Flags:
 *   --markdown   emit a markdown report instead of JSON
 *   --json       force JSON (default)
 *   --quiet      suppress the per-file OK lines
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..', '..');

// ---- Budget configuration --------------------------------------------------

/** Max labels any single metric may declare. */
const LABEL_BUDGET = 5;

/**
 * Label names that are (almost) always unbounded. Matched case-insensitively
 * against the whole label name and as a `_`-delimited token, so `user_id`,
 * `org_id` vs `id`, `correlation_id` all trip the `id` rule.
 *
 * NOTE: `tenant_id` / `org_id` are allowed by design — tenant count is bounded
 * and per-tenant breakdown is an explicit product requirement (dashboard D6).
 * They are listed in ALLOWED to document that the omission is deliberate.
 */
const UNBOUNDED = [
  'id',
  'uuid',
  'user_id',
  'userid',
  'session_id',
  'sessionid',
  'request_id',
  'requestid',
  'trace_id',
  'traceid',
  'span_id',
  'correlation_id',
  'email',
  'phone',
  'token',
  'url',
  'uri',
  'path',
  'fullpath',
  'query',
  'querystring',
  'ip',
  'ip_address',
  'remote_addr',
  'host',
  'hostname',
  'timestamp',
  'ts',
  'invoice_id',
  'order_id',
  'document_id',
  'doc_id',
  'sku',
  'barcode',
  'serial',
];

/**
 * Explicitly-allowed names that look risky but are bounded by design:
 *   - tenant_id / org_id : tenant count is bounded; per-tenant breakdown is a
 *     product requirement (dashboard D6).
 *   - route / collection : a bounded set of route templates / Firestore
 *     collections (surfaced as a soft-warn to re-verify the *value* is a
 *     template, not a raw URL).
 *   - job_id             : the APScheduler job set is a fixed, hardcoded
 *     registry (~16 jobs in services/scheduler.py), so the label is bounded.
 *   - state              : Cloud Run instance state ∈ {active, idle}.
 */
const ALLOWED = new Set([
  'tenant_id',
  'org_id',
  'route',
  'collection',
  'job_id',
  'state',
]);

/**
 * `route`/`collection` are allowed ONLY when the value is a bounded template
 * (e.g. `/api/invoices/{id}`), never a raw URL. We can't prove that statically,
 * so we surface them as INFO, not violations.
 */
const SOFT_WARN = new Set(['route', 'collection', 'op', 'method', 'resource']);

// ---- File discovery --------------------------------------------------------

/**
 * @param {string} dir
 * @param {(p: string) => boolean} match
 * @param {string[]} acc
 * @returns {Promise<string[]>}
 */
async function walk(dir, match, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '__pycache__' || e.name === 'venv' || e.name === 'dist') {
      continue;
    }
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, match, acc);
    } else if (match(full)) {
      acc.push(full);
    }
  }
  return acc;
}

// ---- Parsing ---------------------------------------------------------------

/**
 * Extract prometheus_client metric definitions from Python source.
 * Handles both `labelnames=(...)` and `labelnames=[...]`, multi-line.
 *
 * @param {string} src
 * @param {string} file
 * @returns {Array<{file:string, metric:string, kind:string, labels:string[], line:number}>}
 */
function parsePythonMetrics(src, file) {
  /** @type {Array<{file:string, metric:string, kind:string, labels:string[], line:number}>} */
  const out = [];
  // Match:  NAME = Counter( "metric_name", "...", labelnames=("a","b") )
  // The constructor body may span multiple lines, so capture lazily up to the
  // matching close paren heuristically (first ")" at paren depth 0).
  const ctor = /(\w+)\s*=\s*(Counter|Histogram|Gauge|Summary)\s*\(/g;
  let m;
  while ((m = ctor.exec(src)) !== null) {
    const varName = m[1];
    const kind = m[2];
    const startIdx = ctor.lastIndex;
    // Walk to the matching close paren.
    let depth = 1;
    let i = startIdx;
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    const body = src.slice(startIdx, i - 1);
    const metricName = (body.match(/^\s*["']([^"']+)["']/) || [])[1] || varName;
    const labels = extractLabelList(body);
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ file, metric: metricName, kind, labels, line });
  }
  return out;
}

/**
 * Pull label names out of a metric constructor body. Looks for
 * `labelnames=(...)`/`[...]` first, then a bare `labels=` kwarg.
 * @param {string} body
 * @returns {string[]}
 */
function extractLabelList(body) {
  const ln = body.match(/labelnames\s*=\s*[([]([^)\]]*)[)\]]/);
  const raw = ln ? ln[1] : '';
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/**
 * Extract google_logging_metric label_extractors from Terraform HCL.
 * Returns one entry per extracted label.
 * @param {string} src
 * @param {string} file
 * @returns {Array<{file:string, metric:string, kind:string, labels:string[], line:number}>}
 */
function parseTerraformLogMetrics(src, file) {
  /** @type {Array<{file:string, metric:string, kind:string, labels:string[], line:number}>} */
  const out = [];
  const blockRe = /resource\s+"google_logging_metric"\s+"(\w+)"\s*{/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const resName = m[1];
    const startIdx = blockRe.lastIndex;
    let depth = 1;
    let i = startIdx;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
    }
    const body = src.slice(startIdx, i - 1);
    const nameMatch = body.match(/name\s*=\s*"([^"]+)"/);
    const metricName = nameMatch ? nameMatch[1] : resName;
    // label_extractors = { "tenant_id" = "EXTRACT(...)" }
    const extractors = body.match(/label_extractors\s*=\s*{([^}]*)}/);
    /** @type {string[]} */
    const labels = [];
    if (extractors) {
      const re = /"([^"]+)"\s*=/g;
      let lm;
      while ((lm = re.exec(extractors[1])) !== null) labels.push(lm[1]);
    }
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ file, metric: metricName, kind: 'log_metric', labels, line });
  }
  return out;
}

// ---- Rule evaluation -------------------------------------------------------

/**
 * @param {string} label
 * @returns {boolean}
 */
function isUnbounded(label) {
  const l = label.toLowerCase();
  if (ALLOWED.has(l)) return false;
  if (UNBOUNDED.includes(l)) return true;
  const tokens = l.split(/[_.]/);
  // Trip if any token is a denylisted atom like `id`, `url`, `ip`, `ts`.
  return tokens.some((t) => UNBOUNDED.includes(t));
}

/**
 * @param {Array<{file:string, metric:string, kind:string, labels:string[], line:number}>} metrics
 */
function evaluate(metrics) {
  /** @type {Array<{file:string,metric:string,line:number,severity:'error'|'warn',rule:string,detail:string}>} */
  const findings = [];
  for (const md of metrics) {
    const rel = relative(REPO_ROOT, md.file).replace(/\\/g, '/');
    // Rule 2: label budget.
    if (md.labels.length > LABEL_BUDGET) {
      findings.push({
        file: rel,
        metric: md.metric,
        line: md.line,
        severity: 'error',
        rule: 'label-budget',
        detail: `${md.labels.length} labels (budget ${LABEL_BUDGET}): [${md.labels.join(', ')}]`,
      });
    }
    // Rule 1 + 3: unbounded label names.
    for (const label of md.labels) {
      if (isUnbounded(label)) {
        findings.push({
          file: rel,
          metric: md.metric,
          line: md.line,
          severity: 'error',
          rule: 'unbounded-label',
          detail: `label "${label}" is high-cardinality; aggregate or drop it (allowed bounded ids: ${[...ALLOWED].join(', ')})`,
        });
      } else if (SOFT_WARN.has(label.toLowerCase())) {
        findings.push({
          file: rel,
          metric: md.metric,
          line: md.line,
          severity: 'warn',
          rule: 'verify-bounded',
          detail: `label "${label}" must carry a bounded value (route template / op name), never a raw URL or free string`,
        });
      }
    }
  }
  return findings;
}

// ---- Report ----------------------------------------------------------------

/**
 * @param {{metrics:number, findings:ReturnType<typeof evaluate>}} r
 */
function toMarkdown(r) {
  const errors = r.findings.filter((f) => f.severity === 'error');
  const warns = r.findings.filter((f) => f.severity === 'warn');
  const lines = [];
  lines.push('# Cardinality budget report');
  lines.push('');
  lines.push(`- Metrics scanned: **${r.metrics}**`);
  lines.push(`- Violations (error): **${errors.length}**`);
  lines.push(`- Warnings: **${warns.length}**`);
  lines.push(`- Label budget per metric: **${LABEL_BUDGET}**`);
  lines.push('');
  if (errors.length) {
    lines.push('## Violations');
    lines.push('');
    lines.push('| File:line | Metric | Rule | Detail |');
    lines.push('|---|---|---|---|');
    for (const f of errors) {
      lines.push(`| ${f.file}:${f.line} | \`${f.metric}\` | ${f.rule} | ${f.detail} |`);
    }
    lines.push('');
  }
  if (warns.length) {
    lines.push('## Warnings (verify manually)');
    lines.push('');
    lines.push('| File:line | Metric | Detail |');
    lines.push('|---|---|---|');
    for (const f of warns) {
      lines.push(`| ${f.file}:${f.line} | \`${f.metric}\` | ${f.detail} |`);
    }
    lines.push('');
  }
  if (!errors.length) lines.push('All metrics are within the cardinality budget.');
  return lines.join('\n');
}

// ---- Main ------------------------------------------------------------------

async function buildReport() {
  const pyFiles = await walk(
    join(REPO_ROOT, 'backend', 'app'),
    (p) => p.endsWith('.py'),
  );
  const tfFiles = await walk(
    join(REPO_ROOT, 'terraform', 'monitoring'),
    (p) => p.endsWith('.tf'),
  );

  /** @type {Array<{file:string, metric:string, kind:string, labels:string[], line:number}>} */
  const metrics = [];
  for (const f of pyFiles) {
    const src = await readFile(f, 'utf8');
    if (!/\b(Counter|Histogram|Gauge|Summary)\s*\(/.test(src)) continue;
    metrics.push(...parsePythonMetrics(src, f));
  }
  for (const f of tfFiles) {
    const src = await readFile(f, 'utf8');
    if (!src.includes('google_logging_metric')) continue;
    metrics.push(...parseTerraformLogMetrics(src, f));
  }

  const findings = evaluate(metrics);
  return { metrics: metrics.length, findings };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const r = await buildReport();

  if (args.has('--markdown')) {
    process.stdout.write(toMarkdown(r) + '\n');
  } else {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  }

  const errorCount = r.findings.filter((f) => f.severity === 'error').length;
  if (errorCount > 0) {
    process.stderr.write(
      `\n[check-cardinality] ${errorCount} cardinality violation(s). ` +
        `High-cardinality labels blow up metric cost — aggregate or drop them.\n`,
    );
    process.exit(1);
  }
}

export { buildReport, toMarkdown, isUnbounded, parsePythonMetrics, parseTerraformLogMetrics, LABEL_BUDGET };

const isDirect = (() => {
  try {
    return (
      import.meta.url === `file://${process.argv[1]}` ||
      import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
    );
  } catch {
    return false;
  }
})();

if (isDirect) {
  main().catch((err) => {
    console.error('[check-cardinality] error:', err?.stack || err);
    process.exit(1);
  });
}
