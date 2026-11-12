// SPEC section 9 budget: the summed size of dist/**/*.js stays under 1.8 MB (1 MB = 1,000,000 bytes).
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const LIMIT = 1_800_000;

function jsFiles(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? jsFiles(p) : e.endsWith('.js') ? [p] : [];
  });
}

let files = [];
try {
  files = jsFiles(DIST);
} catch {
  console.error('check-size: no dist folder, run vite build first');
  process.exit(1);
}
if (files.length === 0) {
  console.error('check-size: no .js files in dist');
  process.exit(1);
}
const total = files.reduce((sum, f) => sum + statSync(f).size, 0);
const mb = (total / 1_000_000).toFixed(3);
if (total > LIMIT) {
  console.error(`check-size: dist JS is ${mb} MB, over the 1.8 MB budget`);
  process.exit(1);
}
console.log(`check-size: dist JS ${mb} MB (budget 1.8 MB)`);
