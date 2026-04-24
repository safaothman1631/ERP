import { promises as fs } from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const DOCS_INDEX = path.resolve(SRC_DIR, 'docs', 'index.ts');
const allowedExtensions = new Set(['.ts', '.tsx']);

const scanRules = [
  {
    label: 'Firebase popup auth is forbidden',
    match: (content) => /\bsignInWithPopup\s*\(/.exec(content),
  },
  {
    label: 'AntD Statistic valueStyle is deprecated',
    match: (content) => /\bvalueStyle\s*=\s*\{/.exec(content),
  },
  {
    label: 'AntD Tag bordered={false} is deprecated',
    match: (content) => /<Tag\b[^>]*\bbordered=\{false\}/s.exec(content),
  },
  {
    label: 'AntD Input bordered={false} is deprecated',
    match: (content) => /<Input(?:\.Password)?\b[^>]*\bbordered=\{false\}/s.exec(content),
  },
  {
    label: 'AntD List is deprecated',
    match: (content) => /<List(?:\.Item(?:\.Meta)?)?\b/s.exec(content),
  },
  {
    label: 'AntD Timeline items.dot is deprecated',
    match: (content) => (content.includes('Timeline') ? /\bdot:\s*</.exec(content) : null),
  },
  {
    label: 'AntD Timeline items.children is deprecated',
    match: (content) => (content.includes('Timeline') ? /\bchildren:\s*\(/.exec(content) : null),
  },
  {
    label: 'Docs types must not be imported from the docs barrel',
    match: (content) => /import\s+type\s+\{[^}]*\b(?:SectionDoc|SectionDocMap|SubArea)\b[^}]*\}\s+from\s+['"][^'"]*\/docs['"]/s.exec(content),
  },
];

const docsIndexRule = {
  label: 'Docs barrel must stay runtime-only',
  match: (content) => /export\s+type\s+\{[^}]*\b(?:SectionDoc|SectionDocMap|SubArea)\b[^}]*\}/s.exec(content),
};

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }
    if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

async function main() {
  const files = await walk(SRC_DIR);
  const failures = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    for (const rule of scanRules) {
      const hit = rule.match(content);
      if (!hit || hit.index == null) {
        continue;
      }
      failures.push({
        file,
        line: getLineNumber(content, hit.index),
        rule: rule.label,
      });
    }
  }

  const docsIndexContent = await fs.readFile(DOCS_INDEX, 'utf8');
  const docsHit = docsIndexRule.match(docsIndexContent);
  if (docsHit && docsHit.index != null) {
    failures.push({
      file: DOCS_INDEX,
      line: getLineNumber(docsIndexContent, docsHit.index),
      rule: docsIndexRule.label,
    });
  }

  if (failures.length === 0) {
    console.log('compat-guard: ok');
    return;
  }

  console.error('compat-guard: found banned compatibility patterns');
  for (const failure of failures) {
    const relative = path.relative(process.cwd(), failure.file).replace(/\\/g, '/');
    console.error(`- ${failure.rule}: ${relative}:${failure.line}`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
