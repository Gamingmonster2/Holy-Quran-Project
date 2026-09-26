/**
 * End-to-end check of the static layer: `npm run verify`.
 *
 * Starts `server.mjs` on a free port, then crawls the import graph over HTTP and
 * asserts every asset (HTML, CSS, JS, docs) is served with a usable content
 * type. This catches broken relative paths — the one class of bug that unit
 * tests on pure modules cannot see.
 *
 * Uses `stdio: 'ignore'` deliberately: sandboxes that forbid named pipes break
 * piped child output, but inheriting/ignoring stdio works everywhere.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.VERIFY_PORT) || 5199;
const BASE = `http://127.0.0.1:${PORT}`;

const failures = [];
/** @type {Set<string>} */
const seen = new Set();

/** @param {string} url */
async function fetchText(url) {
  const response = await fetch(url);
  return { status: response.status, type: response.headers.get('content-type') ?? '', body: await response.text() };
}

/** @param {string} url @param {string} expectedType */
async function check(url, expectedType) {
  if (seen.has(url)) return null;
  seen.add(url);
  try {
    const { status, type, body } = await fetchText(url);
    if (status !== 200) failures.push(`${url} → HTTP ${status}`);
    else if (expectedType && !type.includes(expectedType)) failures.push(`${url} → content-type ${type}, expected ${expectedType}`);
    return body;
  } catch (error) {
    failures.push(`${url} → ${error.message}`);
    return null;
  }
}

/** Extract static `import ... from '...'` specifiers. @param {string} source @param {string} fromUrl */
function importSpecifiers(source, fromUrl) {
  const out = [];
  const pattern = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(source)) !== null) out.push({ specifier: match[1], fromUrl });
  return out;
}

const server = spawn(process.execPath, ['server.mjs', '--port', String(PORT)], {
  cwd: ROOT,
  stdio: 'ignore',
});

/** @param {number} ms */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/`);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await wait(150);
  }
  return false;
}

try {
  if (!(await waitForServer())) {
    console.error(`server did not start on ${BASE}`);
    process.exit(1);
  }

  const html = await check(`${BASE}/`, 'text/html');
  if (html) {
    if (!html.includes('src/main.js')) failures.push('index.html does not load src/main.js');
    if (!html.includes('dir="rtl"')) failures.push('index.html is not RTL');
    if (!html.includes('id="main"')) failures.push('index.html has no #main host');
  }

  await check(`${BASE}/src/styles/main.css`, 'text/css');
  await check(`${BASE}/docs/DATA_SOURCES.md`, 'text/markdown');
  await check(`${BASE}/docs/MIGRATION-FROM-ANDROID.md`, 'text/markdown');
  await check(`${BASE}/docs/DEPLOY-GITHUB-PAGES.md`, 'text/markdown');
  await check(`${BASE}/README.md`, 'text/markdown');

  // GitHub Pages specific files must be present and served.
  await check(`${BASE}/.nojekyll`, null);
  const notFound = await check(`${BASE}/404.html`, 'text/html');
  if (notFound && !notFound.includes("location.replace('./'")) {
    failures.push('404.html does not redirect to the site root');
  }

  // The docs viewer is a second entry point with its own module graph.
  const docsHtml = await check(`${BASE}/docs.html`, 'text/html');
  if (docsHtml && !docsHtml.includes('src/docs-viewer.js')) {
    failures.push('docs.html does not load src/docs-viewer.js');
  }

  // Crawl the module graph starting from both entry points.
  const queue = [`${BASE}/src/main.js`, `${BASE}/src/docs-viewer.js`];
  while (queue.length) {
    const url = /** @type {string} */ (queue.shift());
    // eslint-disable-next-line no-await-in-loop
    const source = await check(url, 'text/javascript');
    if (!source) continue;
    for (const { specifier } of importSpecifiers(source, url)) {
      if (!specifier.startsWith('.')) continue; // bare specifiers would need a bundler
      const resolved = new URL(specifier, url).href;
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }

  const crawlReport = `crawled ${seen.size} URLs`;
  if (failures.length) {
    console.error(`\n✗ static verification failed (${crawlReport})\n`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`\n✓ static verification passed — ${crawlReport}, all assets served correctly\n`);
  }
} finally {
  server.kill();
}
