#!/usr/bin/env node
// @ts-check
/**
 * dead-code-report.mjs (V-LM.4)
 *
 * Unified frontend + backend dead-code report.
 *
 *   Frontend: `npx ts-prune --project frontend/tsconfig.json`
 *             (gracefully skips with a warning if ts-prune is not installed).
 *
 *   Backend:  `vulture backend/app --min-confidence 80`
 *             (gracefully skips with a warning if vulture is not installed).
 *
 * Threshold (V-LM.4): < 0.5% of exports are dead.
 *
 * Output:
 *   - JSON to stdout (default), or `--markdown` for a markdown summary.
 *   - `--write` writes both to `audit/maintainability/dead-code-{ISO-DATE}.{json,md}`.
 *
 * Exit code: always 0 unless this script itself crashes — this is an
 * observability script, not a gate. Gating happens elsewhere.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..');

/**
 * @returns {{ ok: boolean; count: number; sample: string[]; warning?: string; raw_lines: number; by_dir: Record<string, number> }}
 */
function runTsPrune() {
  // Try `npx -y ts-prune` — graceful fallback if not installed.
  const r = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['-y', '--no-install', 'ts-prune', '--project', 'frontend/tsconfig.json'],
    { cwd: REPO_ROOT, encoding: 'utf8', shell: false }
  );
  if (r.error && /ENOENT/.test(r.error.message)) {
    return {
      ok: false,
      count: 0,
      sample: [],
      warning: 'npx not found — install Node to run ts-prune',
      raw_lines: 0,
      by_dir: {},
    };
  }
  // ts-prune exits non-zero if not installed (--no-install)
  const stderr = r.stderr || '';
  if (r.status !== 0 && /could not determine|not found|cannot find module/i.test(stderr)) {
    return {
      ok: false,
      count: 0,
      sample: [],
      warning: 'ts-prune not installed — run `npm i -D ts-prune` in frontend/',
      raw_lines: 0,
      by_dir: {},
    };
  }
  const out = (r.stdout || '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  // ts-prune output: `<file>:<line> - <symbol>`
  /** @type {Record<string, number>} */
  const byDir = {};
  for (const line of out) {
    const path = line.split(':')[0] || '';
    const seg = path.split('/').slice(0, 3).join('/');
    if (!seg) continue;
    byDir[seg] = (byDir[seg] ?? 0) + 1;
  }
  return {
    ok: true,
    count: out.length,
    sample: out.slice(0, 20),
    raw_lines: out.length,
    by_dir: byDir,
  };
}

/**
 * @returns {{ ok: boolean; count: number; sample: string[]; warning?: string; raw_lines: number }}
 */
function runVulture() {
  const r = spawnSync('vulture', ['backend/app', '--min-confidence', '80'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false,
  });
  if (r.error && /ENOENT/.test(r.error.message)) {
    return {
      ok: false,
      count: 0,
      sample: [],
      warning: 'vulture not installed — `pip install vulture`',
      raw_lines: 0,
    };
  }
  // vulture exits 0 if no issues, 3 if issues found
  const out = (r.stdout || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  return {
    ok: true,
    count: out.length,
    sample: out.slice(0, 20),
    raw_lines: out.length,
  };
}

/**
 * Best-effort estimate of total exported symbols in frontend/src so we can
 * compute a percentage. Very cheap heuristic — counts `export ` occurrences.
 * @returns {number}
 */
function estimateFrontendExports() {
  try {
    const out = execFileSync(
      process.platform === 'win32' ? 'powershell' : 'bash',
      process.platform === 'win32'
        ? ['-Command', "(Get-ChildItem -Path frontend/src -Recurse -Include *.ts,*.tsx | Select-String -Pattern '^export ' | Measure-Object).Count"]
        : ['-c', "grep -rE '^export ' frontend/src --include='*.ts' --include='*.tsx' | wc -l"],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    const n = Number(out);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function buildReport() {
  const ts = runTsPrune();
  const vul = runVulture();
  const totalExports = estimateFrontendExports();
  const deadPercent =
    totalExports > 0 && ts.ok ? (ts.count / totalExports) * 100 : null;

  /** @type {'green' | 'yellow' | 'red' | 'unknown'} */
  let status = 'unknown';
  if (deadPercent != null) {
    if (deadPercent < 0.5) status = 'green';
    else if (deadPercent < 1.0) status = 'yellow';
    else status = 'red';
  }

  return {
    generated: new Date().toISOString(),
    frontend: ts,
    backend: vul,
    estimated_total_frontend_exports: totalExports,
    dead_percent: deadPercent == null ? null : Math.round(deadPercent * 100) / 100,
    target_percent: 0.5,
    status,
  };
}

/**
 * @param {Awaited<ReturnType<typeof buildReport>>} r
 */
function toMarkdown(r) {
  const lines = [];
  lines.push('# Dead-Code Report');
  lines.push('');
  lines.push(`- Generated: \`${r.generated}\``);
  lines.push(`- Target (V-LM.4): **< ${r.target_percent}%** dead exports`);
  lines.push('');
  lines.push('## Frontend (`ts-prune`)');
  lines.push('');
  if (!r.frontend.ok) {
    lines.push(`- _Skipped_: ${r.frontend.warning}`);
  } else {
    lines.push(`- Unused exports: **${r.frontend.count}**`);
    lines.push(`- Estimated total exports: ${r.estimated_total_frontend_exports}`);
    if (r.dead_percent != null) {
      lines.push(`- Dead %: **${r.dead_percent}%** — status: ${r.status}`);
    }
    if (r.frontend.sample.length > 0) {
      lines.push('');
      lines.push('Sample (first 20):');
      lines.push('');
      lines.push('```');
      lines.push(...r.frontend.sample);
      lines.push('```');
    }
  }
  lines.push('');
  lines.push('## Backend (`vulture`)');
  lines.push('');
  if (!r.backend.ok) {
    lines.push(`- _Skipped_: ${r.backend.warning}`);
  } else {
    lines.push(`- Findings: **${r.backend.count}**`);
    if (r.backend.sample.length > 0) {
      lines.push('');
      lines.push('Sample (first 20):');
      lines.push('');
      lines.push('```');
      lines.push(...r.backend.sample);
      lines.push('```');
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const wantMarkdown = args.includes('--markdown');
  const wantWrite = args.includes('--write');

  const r = await buildReport();

  if (wantWrite) {
    const today = new Date().toISOString().slice(0, 10);
    const dir = resolve(REPO_ROOT, 'audit', 'maintainability');
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `dead-code-${today}.json`), JSON.stringify(r, null, 2));
    await writeFile(resolve(dir, `dead-code-${today}.md`), toMarkdown(r));
  }

  if (wantMarkdown) process.stdout.write(toMarkdown(r) + '\n');
  else process.stdout.write(JSON.stringify(r, null, 2) + '\n');
}

export { buildReport, toMarkdown };

const isDirect = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}` ||
      import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
  } catch {
    return false;
  }
})();

if (isDirect) {
  main().catch((err) => {
    console.error('[dead-code-report] error:', err?.stack || err);
    process.exit(1);
  });
}
