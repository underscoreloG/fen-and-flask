// SPEC section 10 live check: writes dist/version.json { "version": "<package version>" } after
// vite build, then reads it back, so a build that lost it fails here and not on Pages.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(DIST, 'version.json');

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (typeof version !== 'string' || version === '') {
  console.error('write-version: package.json has no version');
  process.exit(1);
}
if (!existsSync(DIST)) {
  console.error('write-version: no dist folder, run vite build first');
  process.exit(1);
}
writeFileSync(OUT, `${JSON.stringify({ version })}\n`);
const back = JSON.parse(readFileSync(OUT, 'utf8'));
if (back.version !== version) {
  console.error(`write-version: dist/version.json holds ${back.version}, expected ${version}`);
  process.exit(1);
}
console.log(`write-version: dist/version.json = ${version}`);
