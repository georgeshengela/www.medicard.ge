#!/usr/bin/env node
// MEDICARD web-QA mock API. Dependency-free; never proxies to the real server.
//
//   node mock-api.mjs [port=4499]          PERSONA=women|man (default women)
//   GET  /__state                          dump in-memory state
//   POST /__reset?persona=&layout=&onboarding=tail
//
// Fixture modules live in ./fixtures/*.mjs. Each may export:
//   init(state, ctx)   — seed its slice of state  (ctx: { persona, today, layout, onboarding })
//   routes             — [{ method, path: '/api/x/:id' | RegExp, handler(rq) }]
// A handler returns a JSON-able body (200) or rq.reply(status, body).
import { setMockNow } from './clock.mjs';
import http from 'node:http';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tbilisiToday } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 4499);
const VERBOSE = process.env.MOCK_VERBOSE === '1';

const modules = [];
for (const file of readdirSync(join(here, 'fixtures')).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')).sort()) {
  try {
    const mod = await import(pathToFileURL(join(here, 'fixtures', file)).href);
    modules.push({ name: file.replace(/\.mjs$/, ''), ...mod });
  } catch (error) {
    console.error(`FIXTURE LOAD FAILED ${file}: ${error?.message || error}`);
  }
}

class Reply {
  constructor(status, body, headers = {}) {
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

function compile(path) {
  if (path instanceof RegExp) return { re: path, keys: [] };
  const keys = [];
  const re = new RegExp(
    '^' +
      path.replace(/[.+*?^${}()|[\]\\]/g, '\\$&').replace(/\\?:([A-Za-z_]\w*)/g, (_, k) => {
        keys.push(k);
        return '([^/]+)';
      }) +
      '/?$',
  );
  return { re, keys };
}

const table = [];
for (const mod of modules) {
  for (const route of mod.routes ?? []) {
    table.push({ ...route, method: (route.method || 'GET').toUpperCase(), module: mod.name, ...compile(route.path) });
  }
}

let state = {};
function reset({ persona, layout, onboarding, now } = {}) {
  if (now !== undefined) setMockNow(now || null);
  const ctx = {
    persona: persona === 'man' ? 'man' : persona === 'women' ? 'women' : process.env.PERSONA === 'man' ? 'man' : 'women',
    today: tbilisiToday(),
    layout: layout || null,
    onboarding: onboarding || null,
  };
  state = { persona: ctx.persona, createdForDay: ctx.today, resetAt: new Date().toISOString(), options: ctx };
  for (const mod of modules) mod.init?.(state, ctx);
  return ctx;
}
reset({});

const unmocked = new Map();

function cors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  const asked = req.headers['access-control-request-headers'];
  res.setHeader(
    'Access-Control-Allow-Headers',
    asked ||
      'Accept, Authorization, Content-Type, X-Medicard-Lang, X-Client-Timezone, X-Medicard-Platform, X-Medicard-App-Version, Idempotency-Key, X-Requested-With',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Retry-After, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

function send(res, status, body, headers = {}) {
  if (Buffer.isBuffer(body) || typeof body === 'string') {
    res.writeHead(status, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', ...headers });
    res.end(body);
    return;
  }
  const text = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  if (!raw.length) return undefined;
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/json')) {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return undefined;
    }
  }
  return { __raw: raw.length, __type: type };
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, `http://localhost:${port}`);
  const path = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());
  try {
    if (path === '/__state') return send(res, 200, { state, unmocked: Object.fromEntries(unmocked) });
    if (path === '/__unmocked') return send(res, 200, Object.fromEntries(unmocked));
    if (path === '/__reset') {
      const ctx = reset({ persona: query.persona, layout: query.layout, onboarding: query.onboarding, now: query.now ?? '' });
      if (query.clearUnmocked !== '0') unmocked.clear();
      console.log(`RESET persona=${ctx.persona} layout=${ctx.layout ?? '-'} onboarding=${ctx.onboarding ?? '-'} today=${ctx.today}`);
      return send(res, 200, { ok: true, ...ctx, now: new Date().toISOString() });
    }
    if (path === '/' || path === '/health' || path === '/healthz') return send(res, 200, { ok: true, mock: true });

    const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : undefined;
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    for (const route of table) {
      if (route.method !== method && route.method !== 'ANY') continue;
      const m = route.re.exec(path);
      if (!m) continue;
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const rq = {
        req,
        method,
        path,
        query,
        params,
        body,
        state,
        persona: state.persona,
        today: tbilisiToday(),
        auth: String(req.headers.authorization || ''),
        lang: String(req.headers['x-medicard-lang'] || 'ka'),
        reply: (status, b, h) => new Reply(status, b, h),
      };
      const out = await route.handler(rq);
      if (VERBOSE) console.log(`${method} ${path}${url.search} -> ${route.module}`);
      if (out instanceof Reply) return send(res, out.status, out.body, out.headers);
      return send(res, 200, out ?? {});
    }
    if (path.startsWith('/api/')) {
      const key = `${req.method} ${path}`;
      unmocked.set(key, (unmocked.get(key) || 0) + 1);
      console.log(`UNMOCKED ${req.method} ${path}${url.search}`);
      return send(res, 404, { error: 'mock: not found' });
    }
    return send(res, 404, { error: 'mock: not found' });
  } catch (error) {
    console.error(`MOCK ERROR ${req.method} ${path}:`, error?.stack || error);
    return send(res, 500, { error: 'mock: handler crashed', detail: String(error?.message || error) });
  }
});

// Minimal socket.io v4 (engine.io v4, websocket transport only): open, connect the default
// namespace, answer pings. Lets the app's quest/community sockets connect quietly; no events.
const sockets = new Set();
function wsFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  const head = len < 126 ? Buffer.from([0x81, len]) : len < 65536 ? Buffer.from([0x81, 126, len >> 8, len & 255]) : null;
  if (!head) {
    const h = Buffer.alloc(10);
    h[0] = 0x81;
    h[1] = 127;
    h.writeBigUInt64BE(BigInt(len), 2);
    return Buffer.concat([h, payload]);
  }
  return Buffer.concat([head, payload]);
}
function wsParse(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const opcode = b0 & 0x0f;
    let len = b1 & 0x7f;
    let pos = offset + 2;
    if (len === 126) {
      if (pos + 2 > buffer.length) break;
      len = buffer.readUInt16BE(pos);
      pos += 2;
    } else if (len === 127) {
      if (pos + 8 > buffer.length) break;
      len = Number(buffer.readBigUInt64BE(pos));
      pos += 8;
    }
    const masked = (b1 & 0x80) !== 0;
    const mask = masked ? buffer.subarray(pos, pos + 4) : null;
    if (masked) pos += 4;
    if (pos + len > buffer.length) break;
    const data = Buffer.from(buffer.subarray(pos, pos + len));
    if (mask) for (let i = 0; i < data.length; i += 1) data[i] ^= mask[i % 4];
    messages.push({ opcode, text: data.toString('utf8') });
    offset = pos + len;
  }
  return { messages, rest: buffer.subarray(offset) };
}
server.on('upgrade', async (req, socket) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (!url.pathname.startsWith('/socket.io') || !req.headers['sec-websocket-key']) {
    socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
    return;
  }
  const { createHash, randomUUID } = await import('node:crypto');
  const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const sid = randomUUID().replace(/-/g, '').slice(0, 20);
  socket.write(wsFrame(`0${JSON.stringify({ sid, upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1000000 })}`));
  sockets.add(socket);
  const ping = setInterval(() => socket.writable && socket.write(wsFrame('2')), 25000);
  let pending = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    const { messages, rest } = wsParse(Buffer.concat([pending, chunk]));
    pending = rest;
    for (const { opcode, text } of messages) {
      if (opcode === 0x8) {
        socket.end();
        return;
      }
      if (opcode === 0x9) continue;
      if (text.startsWith('40')) {
        // Socket.io CONNECT to a namespace: "40" or "40/ns,{auth}".
        let ns = text.startsWith('40/') ? text.slice(2, text.indexOf(',') > 0 ? text.indexOf(',') + 1 : undefined) : '';
        if (ns && !ns.endsWith(',')) ns += ',';
        socket.write(wsFrame(`40${ns}${JSON.stringify({ sid: randomUUID().replace(/-/g, '').slice(0, 20) })}`));
      }
      if (VERBOSE) console.log(`WS <- ${url.pathname} ${text.slice(0, 120)}`);
    }
  });
  const done = () => {
    clearInterval(ping);
    sockets.delete(socket);
  };
  socket.on('close', done);
  socket.on('error', done);
});

server.listen(port, () => {
  console.log(`MEDICARD mock API on http://localhost:${port}  persona=${state.persona}  modules=${modules.map((m) => m.name).join(',')}  routes=${table.length}`);
});
