/**
 * Zero-dependency static file server.
 *
 * The app itself needs no build step, but ES modules cannot be loaded over
 * `file://` in most browsers, so this serves the folder with correct MIME types
 * and a hash-router-friendly fallback.
 *
 *   node server.mjs [--port 5173] [--host 127.0.0.1]
 */
import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** @param {string[]} argv */
function parseArgs(argv) {
  const args = { port: Number(process.env.PORT) || 5173, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port' || argv[i] === '-p') args.port = Number(argv[i + 1]) || args.port;
    if (argv[i] === '--host') args.host = argv[i + 1] ?? args.host;
  }
  return args;
}

/** @param {string} urlPath */
function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const target = join(ROOT, relative);
  // Refuse anything that escapes the served directory.
  if (!target.startsWith(ROOT + sep) && target !== ROOT) return null;
  return target;
}

/** @param {string} filePath */
async function statFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
}

/** @param {import('node:http').ServerResponse} res @param {string} filePath */
function sendFile(res, filePath, status = 200) {
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(status, {
    'content-type': type,
    // Development-friendly: always revalidate so edits show up on refresh.
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(filePath).pipe(res);
}

const { port, host } = parseArgs(process.argv.slice(2));

const server = createServer(async (req, res) => {
  const urlPath = req.url ?? '/';
  const target = safeJoin(urlPath);

  if (!target) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('403 — forbidden path');
    return;
  }

  /** @type {string|null} */
  let filePath = (await statFile(target)) ? target : null;
  if (!filePath) {
    const directoryIndex = join(target, 'index.html');
    if (await statFile(directoryIndex)) filePath = directoryIndex;
  }

  if (filePath) {
    sendFile(res, filePath);
    return;
  }

  // Unknown path: hand it to the hash router instead of 404-ing.
  const fallback = join(ROOT, 'index.html');
  if (await statFile(fallback)) {
    sendFile(res, fallback);
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('404 — not found');
});

/** @param {number} attempt */
function listen(attempt = 0) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < 10) {
      console.warn(`port ${port + attempt} is busy, trying ${port + attempt + 1}…`);
      listen(attempt + 1);
      return;
    }
    console.error(error.message);
    process.exit(1);
  });
  server.listen(port + attempt, host, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`\n  القرآن الكريم — Quran Web\n`);
    console.log(`  ➜  http://${host}:${actualPort}/`);
    console.log(`  ➜  serving ${ROOT}\n`);
    console.log('  اضغط Ctrl+C للإيقاف\n');
  });
}

listen();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
