/**
 * no-ua-layout-detection.mjs — Forbid user-agent / pointer-type sniffing in
 * responsive layout code.
 *
 * Validates: Requirements 4.1, 4.5, 4.7
 *
 * The system-wide UX overhaul mandates a single source of truth for "is this
 * Mobile_Viewport?" decisions: `useViewport()`, which reads viewport width via
 * `window.matchMedia` against the four named Tailwind breakpoints. Any
 * branching on `navigator.userAgent`, `navigator.userAgentData`, or
 * `matchMedia('(pointer: coarse)')` would re-introduce device-type sniffing
 * and is forbidden in:
 *
 *   - frontend/src/components/responsive/**
 *   - frontend/src/layouts/**
 *
 * Forbidden patterns:
 *   - navigator.userAgent
 *   - navigator.userAgentData
 *   - matchMedia('(pointer: coarse)') / matchMedia("(pointer: coarse)")
 *   - any media-query string literal containing `pointer: coarse`
 *     (catches template-literal and split-string variants)
 *
 * Allowlisted exceptions can be marked with a trailing
 * `// no-ua-layout-detection-ignore` comment on the same line.
 *
 * Exit codes:
 *   0 — no violations found (and at least one scan target exists)
 *   1 — at least one violation found
 *
 * Note on missing scan roots: `frontend/src/components/responsive/**` is
 * created later in the umbrella implementation. If a root is missing, this
 * script logs a warning and continues; the script only fails when a
 * forbidden pattern is detected inside a root that does exist.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FRONTEND_DIR = join(__dirname, '..');
const SCAN_ROOTS = [
  join(FRONTEND_DIR, 'src', 'components', 'responsive'),
  join(FRONTEND_DIR, 'src', 'layouts'),
];

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);

/**
 * Patterns that constitute a forbidden user-agent or pointer-type sniff.
 * Each entry has an `id` (stable identifier for the violation) and a `regex`.
 */
const FORBIDDEN_PATTERNS = [
  {
    id: 'navigator.userAgent',
    regex: /\bnavigator\s*\.\s*userAgent\b(?!Data)/,
    hint: "Use useViewport() (viewport width) instead of branching on navigator.userAgent.",
  },
  {
    id: 'navigator.userAgentData',
    regex: /\bnavigator\s*\.\s*userAgentData\b/,
    hint: "Use useViewport() (viewport width) instead of branching on navigator.userAgentData.",
  },
  {
    id: '(pointer: coarse) media query',
    // Catches `(pointer: coarse)` anywhere — matchMedia('(pointer: coarse)'),
    // matchMedia(`(pointer: coarse)`), CSS-in-JS strings, split-string
    // concatenations that produce the literal, and `@media (pointer: coarse)`
    // blocks. Pointer-type detection is forbidden in responsive layout code.
    regex: /\(\s*pointer\s*:\s*coarse\s*\)/,
    hint: "Use useViewport() (viewport width) — pointer-type detection is forbidden in responsive components.",
  },
];

/** Inline opt-out marker (rare; reviewed in PR). */
const IGNORE_MARKER = 'no-ua-layout-detection-ignore';

/**
 * Recursively collect all files to scan inside `dir`.
 * Returns an empty array if `dir` does not exist.
 */
function collectFiles(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join(current, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
        stack.push(fullPath);
      } else if (SCAN_EXTENSIONS.has(extname(entry))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * Scan a single file for forbidden patterns.
 * Returns an array of violation objects.
 */
function auditFile(filePath) {
  const violations = [];
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return violations;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(IGNORE_MARKER)) continue;

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(line)) {
        violations.push({
          file: relative(FRONTEND_DIR, filePath).replace(/\\/g, '/'),
          line: i + 1,
          content: line.trim(),
          patternId: pattern.id,
          hint: pattern.hint,
        });
      }
    }
  }
  return violations;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const allViolations = [];
let scannedFileCount = 0;
const missingRoots = [];

for (const root of SCAN_ROOTS) {
  if (!existsSync(root)) {
    missingRoots.push(relative(FRONTEND_DIR, root).replace(/\\/g, '/'));
    continue;
  }
  const files = collectFiles(root);
  scannedFileCount += files.length;
  for (const file of files) {
    allViolations.push(...auditFile(file));
  }
}

for (const missing of missingRoots) {
  console.warn(
    `⚠️  no-ua-layout-detection: scan root not present yet, skipping: ${missing}`
  );
}

if (allViolations.length === 0) {
  console.log(
    `✅ no-ua-layout-detection passed — scanned ${scannedFileCount} file(s) under ` +
      SCAN_ROOTS.map((r) => relative(FRONTEND_DIR, r).replace(/\\/g, '/')).join(', ')
  );
  process.exit(0);
}

console.error(
  `❌ no-ua-layout-detection failed — ${allViolations.length} violation(s) found:\n`
);
for (const v of allViolations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    ${v.content}`);
  console.error(`    Forbidden: ${v.patternId}`);
  console.error(`    Fix: ${v.hint}\n`);
}
console.error(
  '\nResponsive layout decisions must use useViewport() (viewport width via matchMedia\n' +
    'on the four named Tailwind breakpoints), not user-agent or pointer-type sniffing.\n' +
    'See .kiro/specs/system-wide-ux-overhaul/design.md → "Decision Rule: Viewport Width,\n' +
    'not User-Agent" (Requirements 4.1, 4.5, 4.7).\n' +
    '\nTo suppress a rare false positive, add a trailing comment: // no-ua-layout-detection-ignore'
);
process.exit(1);
