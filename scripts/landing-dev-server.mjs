// Local preview of server/public with the same clean URLs as production (server/src/server.js):
//   node scripts/landing-dev-server.mjs [port]   → http://localhost:4374/
// /api/* is forwarded to [apiBase] / LANDING_API (default https://medicard.ge; e.g.
// http://localhost:4390 for scripts/admin-local-server.mjs) so forms such as /contact work.
//   node scripts/landing-dev-server.mjs 4375 http://localhost:4390
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server/public');
const PORT = Number(process.argv[2] || process.env.PORT || 4374);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};
const PAGES = {
  '/': 'index.html', '/about': 'about.html', '/contact': 'contact.html', '/privacy': 'privacy.html',
  '/terms': 'terms.html', '/delete-account': 'delete-account.html', '/calculators': 'calculators/index.html',
};

function resolve(urlPath) {
  const p = urlPath.replace(/\/+$/, '') || '/';
  if (PAGES[p]) return PAGES[p];
  const calc = /^\/calculators\/([a-z0-9-]+)$/.exec(p);
  if (calc) return `calculators/${calc[1]}.html`;
  const file = path.normalize(decodeURIComponent(p)).replace(/^[\\/]+/, '');
  if (existsSync(path.join(ROOT, file)) && statSync(path.join(ROOT, file)).isDirectory()) return path.join(file, 'index.html');
  return file;
}

const API = (process.argv[3] || process.env.LANDING_API || 'https://medicard.ge').replace(/\/+$/, '');

async function proxyApi(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = {};
  for (const h of ['content-type', 'accept', 'authorization', 'x-medicard-lang']) if (req.headers[h]) headers[h] = req.headers[h];
  try {
    const upstream = await fetch(API + req.url, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `API proxy: ${error.message}` }));
  }
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return void proxyApi(req, res);
  const rel = resolve(new URL(req.url, 'http://x').pathname);
  const full = path.join(ROOT, rel);
  if (!full.startsWith(ROOT) || !existsSync(full) || statSync(full).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(full).pipe(res);
}).listen(PORT, () => console.log(`landing → http://localhost:${PORT}/`));
