// SPEC section 4 rule 1: src/core/** and src/data/** stay pure. They import nothing from
// phaser, render, input, audio, save or debug, and never touch window, document,
// Math.random, Date or performance (test files may use performance, for timing budgets).
// Usage: node scripts/check-boundaries.mjs [--self-test]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PURE_DIRS = ['src/core', 'src/data'];
const FORBIDDEN_DIRS = ['src/render', 'src/input', 'src/audio', 'src/save', 'src/debug'];
const FORBIDDEN_PACKAGES = ['phaser'];
const GLOBALS = [
  { name: 'window', re: /\bwindow\b/ },
  { name: 'document', re: /\bdocument\b/ },
  { name: 'Math.random', re: /\bMath\s*\.\s*random\b/ },
  { name: 'Date', re: /\bDate\b/ },
  { name: 'performance', re: /\bperformance\b/, allowedInTests: true },
];
const IMPORT_RE = /(?:\bimport\s*(?:type\s+)?(?:[^'"`;]*?\bfrom\s*)?|\bexport\s+[^'"`;]*?\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])([^'"]+)\1/g;

// Blanks comments and string contents (keeping line breaks and offsets) so a word inside a
// comment or a string never trips the globals check. Import specifiers are read from the raw text.
function stripCode(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (c === '/' && d === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      out += c;
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') {
          out += ' ';
          i++;
        }
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

function isTestFile(file) {
  return /\.test\.ts$/.test(file);
}

// file is relative to ROOT with forward slashes.
export function checkSource(file, src) {
  const problems = [];
  const fileAbs = resolve(ROOT, file);
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[2];
    const line = lineOf(src, m.index);
    if (FORBIDDEN_PACKAGES.some((p) => spec === p || spec.startsWith(p + '/'))) {
      problems.push(`${file}:${line} imports '${spec}'`);
      continue;
    }
    if (spec.startsWith('.')) {
      const target = resolve(dirname(fileAbs), spec);
      for (const dir of FORBIDDEN_DIRS) {
        const dirAbs = resolve(ROOT, dir);
        if (target === dirAbs || target.startsWith(dirAbs + sep)) {
          problems.push(`${file}:${line} imports '${spec}' from ${dir}`);
        }
      }
    }
  }
  const code = stripCode(src);
  const test = isTestFile(file);
  for (const g of GLOBALS) {
    if (test && g.allowedInTests) continue;
    const re = new RegExp(g.re.source, 'g');
    for (const m of code.matchAll(re)) {
      problems.push(`${file}:${lineOf(code, m.index)} uses ${g.name}`);
    }
  }
  return problems;
}

function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|mts|js|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

function selfTest() {
  const bad = [
    "import Phaser from 'phaser';",
    "import { draw } from '../render/fx';",
    '// Date in a comment is fine',
    'const r = Math.random();',
    'const t = performance.now();',
    "const s = 'window in a string is fine';",
  ].join('\n');
  const found = checkSource('src/core/__selftest__.ts', bad);
  const testOk = checkSource('src/core/__selftest__.test.ts', 'const t = performance.now();');
  const expected = ["imports 'phaser'", "imports '../render/fx'", 'uses Math.random', 'uses performance'];
  for (const p of found) console.log(`self-test detected: ${p}`);
  const missing = expected.filter((e) => !found.some((p) => p.includes(e)));
  const falsePositives = found.filter((p) => p.includes('Date') || p.includes('window'));
  if (missing.length || falsePositives.length || testOk.length) {
    console.error('self-test FAILED', { missing, falsePositives, testOk });
    process.exit(1);
  }
  console.log(`self-test ok: ${found.length} violations detected in the bad sample, none in the allowed ones`);
}

function main() {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }
  const files = PURE_DIRS.flatMap((d) => walk(join(ROOT, d)));
  const problems = files.flatMap((f) => {
    const rel = relative(ROOT, f).split(sep).join('/');
    return checkSource(rel, readFileSync(f, 'utf8'));
  });
  if (problems.length) {
    for (const p of problems) console.error(p);
    console.error(`check-boundaries: ${problems.length} violation(s)`);
    process.exit(1);
  }
  console.log(`check-boundaries: ${files.length} files in ${PURE_DIRS.join(', ')} clean`);
}

main();
