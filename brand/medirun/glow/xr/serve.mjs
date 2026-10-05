// MEDIRUN XR — local server for the Quest prototype.
//   node brand/medirun/glow/xr/serve.mjs
//   PC:    http://localhost:4470/            (WebXR works on localhost, plus the desktop fallback)
//   Quest: https://<this PC's LAN IP>:4471/  (WebXR needs HTTPS; the certificate is self-signed → Advanced → Proceed)
// Serves only the XR page, the Glow engine with its node_modules, the runner models and the city detail tiles.
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const glow = path.resolve(here, '..');
const repo = path.resolve(glow, '../../..');
const HTTP_PORT = Number(process.env.XR_HTTP_PORT || 4470), HTTPS_PORT = Number(process.env.XR_HTTPS_PORT || 4471);

const ROOTS = [
  ['/xr/', path.join(glow, 'xr')],
  ['/engine/', path.join(glow, 'engine')],
  ['/assets/', path.join(glow, 'assets')],
  ['/detail/', path.join(repo, 'server/public/medirun/glow/detail')],
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.bin': 'application/octet-stream' };

function lanIps() {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}

function certificate() {
  const dir = path.join(here, '.cert'), key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem');
  if (existsSync(key) && existsSync(cert)) return { key: readFileSync(key), cert: readFileSync(cert) };
  mkdirSync(dir, { recursive: true });
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...lanIps().map((ip) => `IP:${ip}`)].join(',');
  const candidates = ['openssl', 'C:/Program Files/Git/usr/bin/openssl.exe', 'C:/Program Files/Git/mingw64/bin/openssl.exe'];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825', '-subj', '/CN=medirun-xr', '-addext', `subjectAltName=${san}`, '-keyout', key, '-out', cert], { stdio: 'ignore' });
      return { key: readFileSync(key), cert: readFileSync(cert) };
    } catch { /* try the next one */ }
  }
  return null;
}

function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === '/xr') { res.writeHead(302, { Location: '/xr/' + url.search }); return res.end(); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const root = ROOTS.find(([prefix]) => pathname.startsWith(prefix));
  if (!root || pathname.split('/').some((part) => part.startsWith('.'))) { res.writeHead(404); return res.end('not found'); }
  const file = path.join(root[1], pathname.slice(root[0].length));
  if (!file.startsWith(root[1] + path.sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}

http.createServer(handler).listen(HTTP_PORT, '127.0.0.1', () => console.log(`PC     http://localhost:${HTTP_PORT}/`));
const tls = certificate();
if (tls) {
  https.createServer(tls, handler).listen(HTTPS_PORT, '0.0.0.0', () => {
    for (const ip of lanIps()) console.log(`Quest  https://${ip}:${HTTPS_PORT}/`);
  });
} else {
  console.warn('openssl not found — no HTTPS, so the Quest cannot enter XR. Install Git for Windows (it ships openssl) and run again.');
}
