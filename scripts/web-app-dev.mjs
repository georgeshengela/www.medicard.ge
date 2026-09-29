#!/usr/bin/env node
// Local preview of the signed-in web app (/app) with local files and the main API.
//   node scripts/web-app-dev.mjs [port]                  → /api proxied to https://medicard.ge (owner signs in)
//   node scripts/web-app-dev.mjs [port] --api <url>      → /api proxied to another server (e.g. http://localhost:4390)
//   node scripts/web-app-dev.mjs [port] --mock <dir>     → /api answered by fixture modules in <dir> (no network, no DB writes)
// A fixture module default-exports { 'GET /api/x': (req, body, url) => json | { status, body } }.
// Patterns may use :param segments.
import http from 'node:http';
import https from 'node:https';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server/public');
const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a))) || 4400;
const apiIdx = args.indexOf('--api');
const mockIdx = args.indexOf('--mock');
const API = apiIdx >= 0 ? args[apiIdx + 1] : 'https://medicard.ge';
const MOCK_DIR = mockIdx >= 0 ? path.resolve(args[mockIdx + 1]) : null;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

let mockRoutes = [];
const mockVersions = new Map();
// Fixture modules are re-imported only when their file changes, so their in-memory state survives requests.
async function loadMocks() {
  if (!MOCK_DIR) return;
  const out = [];
  for (const f of await readdir(MOCK_DIR)) {
    if (!/\.m?js$/.test(f)) continue;
    const mtime = (await stat(path.join(MOCK_DIR, f))).mtimeMs;
    if (!mockVersions.has(f) || mockVersions.get(f).mtime !== mtime) {
      mockVersions.set(f, { mtime, mod: await import(`${pathToFileURL(path.join(MOCK_DIR, f)).href}?t=${mtime}`) });
    }
    const { mod } = mockVersions.get(f);
    for (const [key, fn] of Object.entries(mod.default || {})) {
      const [method, pattern] = key.split(' ');
      const parts = pattern.split('/').filter(Boolean);
      out.push({ method, parts, fn, file: f });
    }
  }
  // Static segments beat params.
  out.sort((a, b) => b.parts.filter((p) => !p.startsWith(':')).length - a.parts.filter((p) => !p.startsWith(':')).length);
  mockRoutes = out;
}

function matchMock(method, pathname) {
  const segs = pathname.split('/').filter(Boolean);
  for (const r of mockRoutes) {
    if (r.method !== method || r.parts.length !== segs.length) continue;
    const params = {};
    if (r.parts.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(segs[i])), true) : p === segs[i]))) return { r, params };
  }
  return null;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function serveMock(req, res, url) {
  await loadMocks();
  const raw = await readBody(req);
  let body = {};
  try { body = raw.length ? JSON.parse(raw.toString('utf8')) : {}; } catch { body = {}; }
  const m = matchMock(req.method, url.pathname);
  if (!m) {
    console.log(`[mock] 404 ${req.method} ${url.pathname}`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `mock: no fixture for ${req.method} ${url.pathname}` }));
  }
  const out = await m.r.fn({ params: m.params, query: Object.fromEntries(url.searchParams), headers: req.headers }, body, url);
  const status = out && typeof out === 'object' && out.__status ? out.__status : 200;
  const payload = out && typeof out === 'object' && out.__status ? out.body : out;
  if (out && out.__raw) {
    const raw = out.__raw;
    res.writeHead(200, { 'Content-Type': raw.contentType || 'application/octet-stream' });
    return res.end(Buffer.isBuffer(raw.body) ? raw.body : Buffer.from(raw.body || '', raw.encoding || 'utf8'));
  }
  if (out && out.__sse) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    for (const ev of out.__sse) {
      res.write(`event: ${ev.event || 'message'}\ndata: ${JSON.stringify(ev.data)}\n\n`);
      await new Promise((r) => setTimeout(r, ev.delay ?? 40));
    }
    return res.end();
  }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload ?? {}));
}

function proxy(req, res) {
  const target = new URL(req.url, API);
  const lib = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host };
  delete headers.origin;
  delete headers.referer;
  const up = lib.request(target, { method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502); res.end(String(e.message)); });
  req.pipe(up);
}

async function serveFile(res, file) {
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
    return true;
  } catch { return false; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    return MOCK_DIR ? serveMock(req, res, url).catch((e) => { res.writeHead(500); res.end(String(e.stack)); }) : proxy(req, res);
  }
  const safe = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (await serveFile(res, file)) return;
  if (url.pathname === '/app' || url.pathname.startsWith('/app/')) return serveFile(res, path.join(ROOT, 'app', 'index.html'));
  if (await serveFile(res, path.join(ROOT, 'index.html'))) return;
  res.writeHead(404); res.end();
}).listen(port, () => {
  console.log(`web app → http://localhost:${port}/app  (${MOCK_DIR ? `mock: ${MOCK_DIR}` : `api: ${API}`})`);
});
