/**
 * Test runner: `npm test`.
 *
 * Discovers `tests/**\/*.test.mjs`, imports each (tests register themselves),
 * runs them and exits non-zero when anything failed.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runRegistered } from './harness.mjs';

const testsDir = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('..', import.meta.url));

/** @param {string} dir @returns {string[]} */
function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (entry.endsWith('.test.mjs')) out.push(full);
  }
  return out;
}

const files = collect(testsDir).sort();
if (files.length === 0) {
  console.error('no *.test.mjs files found');
  process.exit(1);
}

for (const file of files) {
  // eslint-disable-next-line no-await-in-loop
  await import(pathToFileURL(file).href);
}

const summary = await runRegistered();

const RED = '\u001b[31m';
const GREEN = '\u001b[32m';
const DIM = '\u001b[2m';
const RESET = '\u001b[0m';

console.log(`\n${DIM}موقع القرآن الكريم — ${files.length} ملف اختبار${RESET}\n`);
for (const file of files) {
  console.log(`  ${DIM}${relative(root, file)}${RESET}`);
}

for (const { name, error } of summary.failures) {
  console.log(`\n${RED}✗${RESET} ${name}`);
  console.log(`  ${String(error?.message ?? error).split('\n').join('\n  ')}`);
}

console.log(
  `\n${summary.failures.length ? RED : GREEN}` +
    `${summary.passed}/${summary.total} passed${RESET}` +
    ` ${DIM}in ${summary.durationMs.toFixed(1)}ms${RESET}\n`,
);

process.exit(summary.failures.length === 0 ? 0 : 1);
