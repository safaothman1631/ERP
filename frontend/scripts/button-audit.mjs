// Button audit — scan all `<Button onClick={...}>` in pages/components and
// flag handlers that are clearly placeholders:
//   - onClick={() => {}}
//   - onClick={() => null}
//   - onClick={undefined}
//   - onClick={() => {/* TODO */}}
// We intentionally DO NOT flag inline functions that have a body.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const frontendSrc = path.join(repoRoot, 'frontend', 'src');
const reportPath = path.join(repoRoot, 'MASTER_AUDIT_REPORTS', 'buttons.md');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const placeholderPatterns = [
  /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/,             // () => {}
  /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*null\s*\}/,                // () => null
  /onClick\s*=\s*\{\s*undefined\s*\}/,                          // undefined
  /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\/\*\s*TODO[^}]*\*\/\s*\}\s*\}/i,
  /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\/\*\s*TODO/i,             // () => /* TODO
];

const findings = [];
for (const file of walk(frontendSrc)) {
  const text = fs.readFileSync(file, 'utf-8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pat of placeholderPatterns) {
      if (pat.test(lines[i])) {
        findings.push({
          file: path.relative(repoRoot, file),
          line: i + 1,
          snippet: lines[i].trim().slice(0, 200),
        });
        break;
      }
    }
  }
}

const lines = [];
lines.push('# Button Audit Report\n');
lines.push(`Generated: ${new Date().toISOString()}\n`);
lines.push(`Files scanned: ${walk(frontendSrc).length}`);
lines.push(`Placeholder onClick handlers found: **${findings.length}**\n`);

if (findings.length) {
  lines.push('## Placeholders\n');
  lines.push('| File | Line | Snippet |');
  lines.push('|------|------|---------|');
  for (const f of findings) {
    lines.push(`| ${f.file} | ${f.line} | \`${f.snippet.replace(/\|/g, '\\|')}\` |`);
  }
} else {
  lines.push('✅ No placeholder onClick handlers detected.');
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
console.log(`Wrote ${reportPath}`);
console.log(`placeholders=${findings.length}`);
