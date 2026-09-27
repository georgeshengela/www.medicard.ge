// Local admin preview: serves server/admin from disk and forwards /api, /socket.io
// and /fonts to the main MEDICARD API (https://medicard.ge). No local server,
// no schedulers — only the static admin changes locally.
//   node scripts/admin-dev-proxy.mjs   →  http://localhost:4380/admin/
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 4380);
const UPSTREAM = new URL(process.env.ADMIN_UPSTREAM || 'https://medicard.ge');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server/admin');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json',
};

function forward(req, res) {
  const headers = { ...req.headers, host: UPSTREAM.host };
  delete headers.origin;
  delete headers.referer;
  const up = https.request({ hostname: UPSTREAM.hostname, port: 443, path: req.url, method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502); res.end(String(e.message)); });
  req.pipe(up);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (/^\/(api|socket\.io|fonts|uploads)\//.test(url.pathname)) return forward(req, res);
  if (url.pathname === '/' || url.pathname === '/admin') { res.writeHead(302, { location: `/admin/${url.hash}` }); return res.end(); }
  const rel = decodeURIComponent(url.pathname.replace(/^\/admin\/?/, '')) || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

server.on('upgrade', (req, socket, head) => {
  const up = tls.connect({ host: UPSTREAM.hostname, port: 443, servername: UPSTREAM.hostname }, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers)) {
      if (k === 'origin') continue;
      lines.push(`${k}: ${k === 'host' ? UPSTREAM.host : v}`);
    }
    up.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) up.write(head);
    up.pipe(socket).pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(PORT, () => console.log(`admin preview → http://localhost:${PORT}/admin/  (API: ${UPSTREAM.origin})`));
