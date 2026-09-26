/**
 * Repository name hygiene.
 *
 * Arabic (or any non-ASCII) names in paths break ordinary workflows: zip
 * archives, the GitHub web uploader, CI checkouts and percent-encoded URLs.
 * The app itself is Arabic — its *file names* must not be.
 *
 * This test exists because the project folder was once named in Arabic and the
 * upload failed. It enforces ASCII-only, space-free paths from now on.
 */
import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertEqual, assertTrue, test } from './harness.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** @param {string} dir @param {string[]} [out] @returns {string[]} */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    // Always report paths as `/a/b`, whether or not ROOT carries a separator.
    out.push(`/${full.slice(ROOT.length).replace(/\\/g, '/').replace(/^\/+/, '')}`);
    if (statSync(full).isDirectory()) walk(full, out);
  }
  return out;
}

// eslint-disable-next-line no-control-regex
const NON_ASCII = /[^\x00-\x7F]/;

test('the project folder name itself is ASCII', () => {
  const folder = basename(ROOT.replace(/[/\\]+$/, ''));
  assertEqual(NON_ASCII.test(folder), false, `the project folder "${folder}" must be ASCII-only`);
});

test('every file and directory inside the project is ASCII-only', () => {
  const offenders = walk(ROOT).filter((relativePath) => NON_ASCII.test(relativePath));
  assertEqual(offenders, [], `these paths contain non-ASCII characters:\n  ${offenders.join('\n  ')}`);
});

test('no path contains a space or a Windows-reserved character', () => {
  const offenders = walk(ROOT).filter((relativePath) => /[ <>:"|?*]/.test(relativePath));
  assertEqual(offenders, [], `these paths would break a URL or an archive:\n  ${offenders.join('\n  ')}`);
});

test('the walk actually sees the project, so the checks above are meaningful', () => {
  const paths = walk(ROOT);
  assertTrue(paths.length > 30, `expected to walk the whole tree, saw ${paths.length} entries`);
  assertTrue(paths.some((path) => path === '/index.html'), 'index.html must be found at the root');
  assertTrue(paths.includes('/.nojekyll'), '.nojekyll must be found at the root');
});
