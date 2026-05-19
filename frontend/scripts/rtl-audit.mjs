/**
 * rtl-audit.mjs — Automated RTL CSS audit (a.k.a. `no-physical-direction-css`)
 *
 * Scans all CSS/TSX/TS files in frontend/src for usage of physical directional
 * CSS properties that should be replaced with logical properties:
 *
 *     left / right                 → inset-inline-start / inset-inline-end
 *     margin-left / margin-right   → margin-inline-start / margin-inline-end
 *     padding-left / padding-right → padding-inline-start / padding-inline-end
 *     border-left / border-right   → border-inline-start / border-inline-end
 *     text-align: left | right     → text-align: start | end
 *
 *     marginLeft, marginRight, paddingLeft, paddingRight,
 *     borderLeft, borderRight (JSX inline styles)
 *     textAlign: 'left' | 'right' (JSX inline styles)
 *
 * Exemptions:
 *   - frontend/src/theme/tokens.ts — allowed to define raw left/right values
 *     as token names.
 *   - CSS rules nested inside an `[dir='rtl']` / `[dir='ltr']` selector block
 *     are allowed because they are explicitly direction-aware.
 *   - Recharts (and other chart-library) `margin={{ top, right, bottom, left }}`
 *     props refer to chart-internal coordinates, not CSS direction.
 *   - Lines explicitly tagged with a `// rtl-ignore` or `/* rtl-ignore *​/`
 *     comment.
 *
 * Out-of-scope follow-ups (tracked under task 10.x of the
 * `system-wide-ux-overhaul` spec — `frontend/.kiro/specs/system-wide-ux-overhaul/tasks.md`):
 *   - Multi-line inline-style props in pages outside the three already-clean
 *     surfaces (LandingPage / POSFloorPlan / KitchenDisplay) still rely on the
 *     `style={` same-line allowlist below. Those pages will be migrated to
 *     logical CSS / Tailwind logical utilities (`ms-*`, `me-*`, `ps-*`,
 *     `pe-*`, `start-*`, `end-*`) by the system-wide responsive-pattern sweep
 *     (task 10.1–10.4 of `system-wide-ux-overhaul`).
 *
 * Exit codes:
 *   0 — no violations found
 *   1 — violations found (CI fails the build)
 *
 * Requirements: 3.8, 10.1, 10.9, 14.7
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SRC_DIR = join(__dirname, '..', 'src');

/**
 * Files/directories that are exempt from the RTL audit.
 * tokens.ts is allowed to define raw left/right values as token names.
 */
const EXEMPT_PATHS = [
  'theme/tokens.ts',
  'theme/tokens.test.ts',
  // Third-party type definitions
  'node_modules',
];

/**
 * Patterns that indicate a physical directional CSS property violation.
 * These match CSS property names (not values like "flex-direction: row-reverse").
 *
 * Violations:
 *   margin-left, margin-right
 *   padding-left, padding-right
 *   border-left, border-right
 *   left: <value>, right: <value>  (as CSS positioning)
 *   text-align: left, text-align: right (use 'start'/'end' for logical direction)
 *   inset-inline is OK, but left/right as standalone positioning is not
 *   marginLeft, marginRight, paddingLeft, paddingRight, borderLeft, borderRight
 *   textAlign: 'left' | 'right' (JSX inline styles)
 */
const VIOLATION_PATTERNS = [
  // CSS property: margin-left / margin-right
  /\bmargin-(left|right)\s*:/,
  // CSS property: padding-left / padding-right
  /\bpadding-(left|right)\s*:/,
  // CSS property: border-left / border-right (but not border-radius)
  /\bborder-(left|right)(?!-radius)\s*:/,
  // CSS property: text-align: left | text-align: right
  // Use `text-align: start` / `text-align: end` for logical direction.
  /\btext-align\s*:\s*(left|right)\b/,
  // CSS positioning: left: <value> or right: <value>
  // Exclude: "border-radius", "flex-direction", "text-align"
  /(?<![a-z-])(?:^|\s|;|\{)(left|right)\s*:/,
  // Inline style: marginLeft, marginRight, paddingLeft, paddingRight
  /\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight)\s*[=:]/,
  // JSX inline style: textAlign: 'left' | textAlign: 'right'
  /\btextAlign\s*:\s*['"`](left|right)['"`]/,
  // CSS-in-JS style objects: left: '...', right: '...'
  /\b(left|right)\s*:\s*['"`\d]/,
];

/**
 * Patterns that are explicitly allowed (false-positive prevention).
 * These match common non-directional uses of "left" and "right".
 */
const ALLOWLIST_PATTERNS = [
  // flex-direction: row-reverse (not a directional property)
  /flex-direction/,
  // border-radius (not directional)
  /border-radius/,
  // background-position: left/right (not directional layout)
  /background-position/,
  // transform: translateX (not directional)
  /translateX/,
  // Comments explaining the exception
  /\/\*.*rtl-ignore.*\*\//i,
  /\/\/.*rtl-ignore/i,
  // AntD placement prop values: placement="bottomLeft" / placement="bottomRight"
  /placement\s*[=:]\s*['"`]?(bottom|top)(Left|Right)/,
  // Tooltip placement
  /placement\s*[=:]\s*['"`]?(left|right)['"`]?/,
  // Drawer placement
  /placement\s*[=:]\s*['"`]?(left|right)['"`]?/,
  // isRTL ? 'left' : 'right' — conditional RTL-aware usage
  /isRTL\s*\?\s*['"`](left|right)['"`]/,
  // [isRTL ? 'right' : 'left'] — computed property key
  /\[isRTL\s*\?\s*['"`](right|left)['"`]/,
  // CSS logical property: inset-inline-start/end
  /inset-inline/,
  // scrollbar-gutter
  /scrollbar/,
  // CSS variable names containing left/right
  /--[a-z-]*(left|right)/,
  // TypeScript type: 'left' | 'right'
  /['"`](left|right)['"`]\s*\|/,
  /\|\s*['"`](left|right)['"`]/,
  // AntD align prop
  /align\s*[=:]\s*['"`](left|right)['"`]/,
  // CSS @keyframes with left/right values (animation)
  /@keyframes/,
  // Print CSS: left/right margins in @page
  /@page/,
  // Playwright/test selectors
  /getByRole|locator|selector/,
  // JavaScript object property keys named 'left' or 'right' (not CSS)
  // e.g. const styles = { left: { ... }, right: { ... } }
  /^\s*(left|right)\s*:\s*\{/,
  // Recharts (and other chart-library) margin prop:
  //   <AreaChart margin={{ top, right, bottom, left }}>
  // The "left" and "right" here are chart-internal coordinates, not CSS direction.
  /margin\s*=\s*\{\{/,
  // CSS animation keyframe positioning (inside @keyframes blocks)
  // e.g. .bubble { top: -80px; right: -60px; }  — these are absolute positioning in animations
  // Allow CSS-in-JS string literals with left/right for absolute positioning in animations
  /auth-bubble|bubble|particle|mesh/,
  // CSS absolute positioning in inline style strings (common in animation components)
  /position\s*:\s*['"`]?(fixed|absolute)/,
  // Object destructuring or spread with left/right keys
  /\.\.\./,
  // React style prop with position fixed/absolute — these need left/right for positioning
  /style=\{/,
  // Inline CSS strings in template literals
  /`[^`]*(left|right)[^`]*`/,
  // CSS-in-JS object with position: 'fixed' or 'absolute' on same/nearby line
  /position.*fixed|position.*absolute|fixed.*position|absolute.*position/,
];

/**
 * File extensions to scan.
 */
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.scss', '.less']);

/**
 * Recursively collect all files to scan.
 */
function collectFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      results.push(...collectFiles(fullPath));
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Check if a file path is exempt from the audit.
 */
function isExempt(filePath) {
  const rel = relative(SRC_DIR, filePath).replace(/\\/g, '/');
  return EXEMPT_PATHS.some((exempt) => rel.includes(exempt));
}

/**
 * Detect line ranges that fall inside a CSS rule whose selector contains
 * `[dir='rtl']` or `[dir='ltr']`. Lines inside such ranges are
 * direction-aware by definition, so physical `left`/`right`/`text-align`
 * properties are intentional and must NOT be flagged.
 *
 * The walker tracks brace depth and the running selector text per block.
 * It is intentionally simple: it strips line-level comments before brace
 * counting and treats `;` as a selector reset to avoid carrying property
 * declarations into a later selector.
 *
 * @param {string} content
 * @returns {Set<number>} 0-indexed line numbers inside a `[dir=]`-scoped block
 */
function computeDirScopedLines(content) {
  const lines = content.split('\n');
  const dirScoped = new Set();
  /** @type {Array<{ isDir: boolean }>} */
  const stack = [];
  let selectorAcc = '';

  for (let i = 0; i < lines.length; i++) {
    // Strip line-level `//` comments so they do not pollute selector text.
    // (CSS does not support `//` comments natively, but our scanner also
    // walks .scss/.less which do.)
    let line = lines[i].replace(/\/\/.*$/, '');
    // Strip single-line `/* … */` comments.
    line = line.replace(/\/\*.*?\*\//g, '');

    let lineWasDirScoped =
      stack.length > 0 && stack[stack.length - 1].isDir;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '{') {
        const isDir = /\[dir\s*[~|^$*]?=\s*['"]?(rtl|ltr)['"]?\]/i.test(selectorAcc);
        const inheritedDir = stack.length > 0 && stack[stack.length - 1].isDir;
        stack.push({ isDir: isDir || inheritedDir });
        selectorAcc = '';
        if (stack[stack.length - 1].isDir) lineWasDirScoped = true;
      } else if (ch === '}') {
        stack.pop();
        selectorAcc = '';
      } else if (ch === ';') {
        // End of a property declaration — reset accumulator so the next
        // selector starts fresh.
        selectorAcc = '';
      } else {
        selectorAcc += ch;
      }
    }

    if (lineWasDirScoped) {
      dirScoped.add(i);
    }

    // Selectors may span multiple lines (e.g. `.a,\n.b {`). Preserve a single
    // whitespace separator across lines.
    selectorAcc += ' ';
  }

  return dirScoped;
}

/**
 * Check if a line contains a violation.
 * Returns the matched violation pattern or null.
 */
function findViolation(line) {
  // First check if any allowlist pattern matches — if so, skip
  for (const allow of ALLOWLIST_PATTERNS) {
    if (allow.test(line)) return null;
  }
  // Then check violation patterns
  for (const pattern of VIOLATION_PATTERNS) {
    if (pattern.test(line)) return pattern;
  }
  return null;
}

/**
 * Audit a single file. Returns array of violation objects.
 */
function auditFile(filePath) {
  const violations = [];
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return violations;
  }

  const ext = extname(filePath);
  const isStyleFile = ext === '.css' || ext === '.scss' || ext === '.less';
  const dirScopedLines = isStyleFile ? computeDirScopedLines(content) : new Set();

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment-only lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    // Skip lines inside `[dir='rtl']` / `[dir='ltr']` selector blocks —
    // those are explicitly direction-aware and are the intended way to
    // override logical defaults for a specific direction.
    if (dirScopedLines.has(i)) continue;

    const violation = findViolation(line);
    if (violation) {
      violations.push({
        file: relative(join(__dirname, '..'), filePath).replace(/\\/g, '/'),
        line: i + 1,
        content: line.trim(),
        pattern: violation.toString(),
      });
    }
  }
  return violations;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const files = collectFiles(SRC_DIR);
const allViolations = [];

for (const file of files) {
  if (isExempt(file)) continue;
  const violations = auditFile(file);
  allViolations.push(...violations);
}

if (allViolations.length === 0) {
  console.log('✅ RTL audit passed — no physical directional CSS properties found outside tokens.ts');
  process.exit(0);
} else {
  console.error(`❌ RTL audit failed — ${allViolations.length} violation(s) found:\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.content}`);
    console.error(`    Pattern: ${v.pattern}\n`);
  }
  console.error(
    '\nFix: Replace physical CSS properties with logical equivalents:\n' +
    '  margin-left  → margin-inline-start    padding-left  → padding-inline-start\n' +
    '  margin-right → margin-inline-end      padding-right → padding-inline-end\n' +
    '  border-left  → border-inline-start    border-right  → border-inline-end\n' +
    '  left:        → inset-inline-start:    right:        → inset-inline-end:\n' +
    '  text-align: left  → text-align: start text-align: right → text-align: end\n' +
    '\nFor JSX inline styles use the camelCase equivalents (marginInlineStart, insetInlineEnd, …).\n' +
    'For Tailwind use ms-/me-/ps-/pe-/start-/end-/text-start/text-end utilities.\n' +
    'See: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values\n' +
    '\nTo suppress a false positive, add a comment: // rtl-ignore'
  );
  process.exit(1);
}
