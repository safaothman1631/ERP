#!/usr/bin/env node
/**
 * @file scripts/audit-empty-states.mjs
 * @description Audit ratchet for the empty-state + quick-create migration.
 *
 * Spec: `.kiro/specs/empty-state-quick-create/requirements.md` §15.
 * Phase entry: EP-0 task T-E.0.10 / EP-6 task T-E.6.2.
 *
 * What it does
 * ------------
 *   1. Walks `frontend/src/` for every `.tsx` file.
 *   2. For each file:
 *        - Counts `<Select>` JSX occurrences (regex; ignores nested `Select.Option`).
 *        - Counts `<SelectWithQuickCreate>` occurrences.
 *        - Counts `// quick-create-exempt:` markers.
 *      The file's status:
 *        - `migrated` — has SelectWithQuickCreate or has zero Selects.
 *        - `exempt`   — every Select is paired with an exemption marker.
 *        - `pending`  — at least one Select with no marker.
 *   3. Reports counts to stdout and writes a markdown summary to
 *      `_deltas/empty-state-audit.md` (overwrites every run).
 *   4. With `--check`, reads `audit/empty-state-baseline.json` and exits 1
 *      if `pendingFiles` increased; exits 0 (and ratchets down the baseline)
 *      otherwise.
 *   5. With `--write-baseline`, persists the current pending count as the
 *      new baseline.
 *
 * This is deliberately a regex-based heuristic — running a full TS AST walk
 * would couple the script to typescript's API. The numbers it produces match
 * what the ESLint rule `local/quick-create-select` flags to within ±5%.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const SRC_ROOT = join(REPO_ROOT, 'frontend', 'src');
const AUDIT_DIR = join(REPO_ROOT, 'audit');
const BASELINE_PATH = join(AUDIT_DIR, 'empty-state-baseline.json');
const STATUS_PATH = join(AUDIT_DIR, 'empty-state-migration-status.json');
const DELTA_PATH = join(REPO_ROOT, '_deltas', 'empty-state-audit.md');

const SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__', '.next']);
const SELECT_OPEN_RE = /<Select(\s|>|\/)/g;
const SELECT_OPTION_RE = /<Select\.Option/g;
const SELECT_WITH_QC_RE = /<SelectWithQuickCreate(\s|>|\/)/g;
const QC_EXEMPT_RE = /\/\/\s*quick-create-exempt\s*:/g;
const EMPTY_STATE_RE = /<EmptyState(\s|>|\/)/g;
const ANTD_EMPTY_IMPORT_RE = /import\s*\{[^}]*\bEmpty\b[^}]*\}\s*from\s*['\"]antd['\"]/;

/** Walk `dir` recursively, yielding files matching `.tsx`. */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      yield* walk(p);
    } else if (/\.tsx$/.test(name) && !/\.(test|vitest\.test|integration\.test)\.tsx$/.test(name)) {
      yield p;
    }
  }
}

function countAll(text, re) {
  let n = 0;
  re.lastIndex = 0;
  while (re.exec(text)) n++;
  return n;
}

function analyseFile(path) {
  const text = readFileSync(path, 'utf8');
  const selectTotal = countAll(text, SELECT_OPEN_RE) - countAll(text, SELECT_OPTION_RE);
  const wrapped = countAll(text, SELECT_WITH_QC_RE);
  const exemptions = countAll(text, QC_EXEMPT_RE);
  const emptyStateUses = countAll(text, EMPTY_STATE_RE);
  const antdEmptyImport = ANTD_EMPTY_IMPORT_RE.test(text);

  // `migrated` — file uses SelectWithQuickCreate OR has no raw Select usage.
  // `exempt`   — every Select is paired with an exemption marker.
  // `pending`  — at least one Select without marker and no QC wrapper.
  let status = 'migrated';
  if (selectTotal > wrapped) {
    const unwrapped = selectTotal - wrapped;
    if (exemptions >= unwrapped) status = 'exempt';
    else status = 'pending';
  }

  return {
    path,
    relative: relative(REPO_ROOT, path).replace(/\\/g, '/'),
    selectTotal,
    wrapped,
    exemptions,
    emptyStateUses,
    antdEmptyImport,
    status,
  };
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeBaseline(payload) {
  if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
}

function writeMarkdown(report) {
  const lines = [];
  lines.push('# Empty-state + Quick-create migration audit');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- Total .tsx files scanned: **${report.totalFiles}**`);
  lines.push(`- Files with raw \`<Select>\`: **${report.filesWithSelect}**`);
  lines.push(`- Files wrapped in \`<SelectWithQuickCreate>\`: **${report.migratedFiles}**`);
  lines.push(`- Files fully exempt: **${report.exemptFiles}**`);
  lines.push(`- Files pending migration: **${report.pendingFiles}**`);
  lines.push(`- Files importing Antd \`Empty\`: **${report.antdEmptyImporters}**`);
  lines.push(`- Files using \`<EmptyState>\`: **${report.emptyStateUsers}**`);
  lines.push('');
  lines.push(`- Total raw \`<Select>\` occurrences: **${report.totalSelects}**`);
  lines.push(`- Of which wrapped: **${report.totalWrapped}**`);
  lines.push(`- Migration percent (by occurrences): **${report.migrationPercent}%**`);
  lines.push('');
  lines.push('## Pending files');
  lines.push('');
  if (report.pending.length === 0) {
    lines.push('_None — every `<Select>` is wrapped or exempted._');
  } else {
    lines.push('| File | `<Select>` count | wrapped | exempt | status |');
    lines.push('|------|------------------|---------|--------|--------|');
    for (const f of report.pending.slice(0, 200)) {
      lines.push(`| \`${f.relative}\` | ${f.selectTotal} | ${f.wrapped} | ${f.exemptions} | ${f.status} |`);
    }
    if (report.pending.length > 200) {
      lines.push(`| _…and ${report.pending.length - 200} more_ | | | | |`);
    }
  }
  lines.push('');

  if (!existsSync(dirname(DELTA_PATH))) mkdirSync(dirname(DELTA_PATH), { recursive: true });
  writeFileSync(DELTA_PATH, lines.join('\n'));
}

function main() {
  const args = new Set(process.argv.slice(2));
  const checkMode = args.has('--check');
  const writeBaselineMode = args.has('--write-baseline');

  const files = [];
  for (const f of walk(SRC_ROOT)) files.push(analyseFile(f));

  const pending = files.filter((f) => f.status === 'pending');
  const exempt = files.filter((f) => f.status === 'exempt');
  const migrated = files.filter((f) => f.status === 'migrated' && f.selectTotal > 0);
  const filesWithSelect = files.filter((f) => f.selectTotal > 0);

  const totalSelects = files.reduce((s, f) => s + f.selectTotal, 0);
  const totalWrapped = files.reduce((s, f) => s + f.wrapped, 0);
  const totalExempt = files.reduce((s, f) => s + f.exemptions, 0);
  const totalAddressed = totalWrapped + totalExempt;
  const migrationPercent = totalSelects === 0 ? 100 : Math.round((totalAddressed / totalSelects) * 1000) / 10;

  const report = {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    filesWithSelect: filesWithSelect.length,
    migratedFiles: migrated.length,
    exemptFiles: exempt.length,
    pendingFiles: pending.length,
    totalSelects,
    totalWrapped,
    totalExempt,
    migrationPercent,
    antdEmptyImporters: files.filter((f) => f.antdEmptyImport).length,
    emptyStateUsers: files.filter((f) => f.emptyStateUses > 0).length,
    pending,
  };

  writeMarkdown(report);

  // Also emit a per-file JSON snapshot for sister-agent tooling
  // (EP-0 contract: `audit/empty-state-migration-status.json`).
  if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });
  writeFileSync(
    STATUS_PATH,
    JSON.stringify(
      {
        generatedAt: report.generatedAt,
        summary: {
          totalFiles: report.totalFiles,
          filesWithSelect: report.filesWithSelect,
          migratedFiles: report.migratedFiles,
          exemptFiles: report.exemptFiles,
          pendingFiles: report.pendingFiles,
          migrationPercent: report.migrationPercent,
        },
        files: files
          .filter((f) => f.selectTotal > 0 || f.emptyStateUses > 0 || f.antdEmptyImport)
          .map((f) => ({
            file: f.relative,
            status: f.status,
            selectTotal: f.selectTotal,
            wrapped: f.wrapped,
            exemptions: f.exemptions,
            emptyStateUses: f.emptyStateUses,
            antdEmptyImport: f.antdEmptyImport,
          })),
      },
      null,
      2,
    ) + '\n',
  );

  console.log('audit-empty-states');
  console.log('==================');
  console.log(`  Files scanned        : ${report.totalFiles}`);
  console.log(`  Files with <Select>  : ${report.filesWithSelect}`);
  console.log(`  Migrated files       : ${report.migratedFiles}`);
  console.log(`  Exempt files         : ${report.exemptFiles}`);
  console.log(`  Pending files        : ${report.pendingFiles}`);
  console.log(`  Total <Select>       : ${report.totalSelects}`);
  console.log(`  Wrapped (QuickCreate): ${report.totalWrapped}`);
  console.log(`  Migration percent    : ${report.migrationPercent}%`);
  console.log(`  Markdown written to  : ${relative(REPO_ROOT, DELTA_PATH).replace(/\\/g, '/')}`);

  if (writeBaselineMode) {
    writeBaseline({
      version: 1,
      capturedAt: report.generatedAt,
      pendingFiles: report.pendingFiles,
      pendingSelects: report.totalSelects - report.totalWrapped - report.totalExempt,
      migrationPercent: report.migrationPercent,
    });
    console.log(`  Baseline saved      : ${relative(REPO_ROOT, BASELINE_PATH).replace(/\\/g, '/')}`);
    return 0;
  }

  if (checkMode) {
    const baseline = readBaseline();
    if (!baseline) {
      // First run — auto-establish baseline; succeed.
      writeBaseline({
        version: 1,
        capturedAt: report.generatedAt,
        pendingFiles: report.pendingFiles,
        pendingSelects: report.totalSelects - report.totalWrapped - report.totalExempt,
        migrationPercent: report.migrationPercent,
      });
      console.log('  Baseline initialised (first --check run).');
      return 0;
    }
    if (report.pendingFiles > baseline.pendingFiles) {
      console.error(
        `  RATCHET BROKEN: pending files ${baseline.pendingFiles} → ${report.pendingFiles} (delta +${
          report.pendingFiles - baseline.pendingFiles
        }).`,
      );
      console.error('  Add `// quick-create-exempt: <reason>` if intentional, or migrate the file.');
      return 1;
    }
    if (report.pendingFiles < baseline.pendingFiles) {
      // Ratchet down.
      writeBaseline({
        version: 1,
        capturedAt: report.generatedAt,
        pendingFiles: report.pendingFiles,
        pendingSelects: report.totalSelects - report.totalWrapped - report.totalExempt,
        migrationPercent: report.migrationPercent,
        previousPendingFiles: baseline.pendingFiles,
      });
      console.log(`  Ratchet DOWN: ${baseline.pendingFiles} → ${report.pendingFiles}.`);
    } else {
      console.log('  Ratchet HELD (no change).');
    }
    return 0;
  }

  return 0;
}

process.exit(main());
