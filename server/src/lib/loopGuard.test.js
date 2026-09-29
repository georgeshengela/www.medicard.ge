import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { apiTrafficKey, attachRateLimitHandler, RATE_LIMIT_VALIDATE } from './rateLimitKey.js';
import {
  createLoopNotifier,
  isCeilingExempt,
  parseClientGuardReport,
  routeTemplate,
  USER_CEILING_PER_MIN,
} from './loopGuard.js';

const TOKEN_A = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload-aaa.signature-aaa-aaaaaaaaaaaa';
const TOKEN_B = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload-bbb.signature-bbb-bbbbbbbbbbbb';

function buildApp(limit, notifier) {
  const app = express();
  app.set('trust proxy', 1);
  const handler = attachRateLimitHandler('user-ceiling');
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: RATE_LIMIT_VALIDATE,
    keyGenerator: apiTrafficKey,
    skip: isCeilingExempt,
    handler: (req, res, next, options) => {
      if (req.rateLimit?.used === limit + 1) notifier.ceilingHit(req);
      return handler(req, res, next, options);
    },
  }));
  app.get('/api/x', (_req, res) => res.json({ ok: true }));
  return app;
}

async function withServer(app, fn) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

const get = (url, token) =>
  fetch(`${url}/api/x`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => ({
    status: r.status,
    limiter: r.headers.get('x-medicard-limiter'),
  }));

describe('per-session ceiling', () => {
  it('is far above any real session (≥ 600/min)', () => {
    assert.ok(USER_CEILING_PER_MIN >= 600);
  });

  it('stops one runaway session, leaves other sessions and guests alone, notifies once', async () => {
    const sent = [];
    const notifier = createLoopNotifier({ notify: async (t) => sent.push(t) });
    await withServer(buildApp(5, notifier), async (url) => {
      for (let i = 0; i < 5; i += 1) assert.equal((await get(url, TOKEN_A)).status, 200);
      const blocked = await get(url, TOKEN_A);
      assert.equal(blocked.status, 429);
      assert.equal(blocked.limiter, 'user-ceiling');
      await get(url, TOKEN_A);
      assert.equal((await get(url, TOKEN_B)).status, 200);
      for (let i = 0; i < 20; i += 1) assert.equal((await get(url)).status, 200);
    });
    await new Promise((r) => setImmediate(r));
    assert.equal(sent.length, 1);
    assert.match(sent[0], /GET \/api\/x/);
  });
});

describe('loop notifier', () => {
  it('throttles owner notices', () => {
    let t = 0;
    const sent = [];
    const n = createLoopNotifier({ notify: async (x) => sent.push(x), now: () => t, gapMs: 1000 });
    const req = { method: 'POST', originalUrl: '/api/health-metrics/sync', headers: {} };
    assert.equal(n.ceilingHit(req), true);
    assert.equal(n.ceilingHit(req), false);
    t = 1001;
    assert.equal(n.ceilingHit(req), true);
    const report = { scope: 'route', method: 'GET', route: '/api/x', count: 31 };
    assert.equal(n.clientReport(req, report), true);
    assert.equal(n.clientReport(req, report), false);
    assert.equal(n.clientReport(req, { ...report, route: '/api/y' }), true);
  });
});

describe('client-guard report', () => {
  it('accepts a well-formed report and strips ids / query', () => {
    assert.deepEqual(
      parseClientGuardReport({ scope: 'route', method: 'post', route: '/api/pets/ckz9x2abcdefghij0123456789/chat?q=1', count: 40 }),
      { scope: 'route', method: 'POST', route: '/api/pets/:id/chat', count: 40 },
    );
  });

  it('rejects anything malformed', () => {
    assert.equal(parseClientGuardReport(null), null);
    assert.equal(parseClientGuardReport({ scope: 'x', method: 'GET', route: '/api/x', count: 1 }), null);
    assert.equal(parseClientGuardReport({ scope: 'route', method: 'GET', route: 'https://evil', count: 1 }), null);
    assert.equal(parseClientGuardReport({ scope: 'route', method: 'TRACE', route: '/api/x', count: 1 }), null);
    assert.equal(parseClientGuardReport({ scope: 'route', method: 'GET', route: '/api/x', count: 0 }), null);
  });

  it('route template matches the app rule', () => {
    assert.equal(routeTemplate('/api/files/123?t=abc'), '/api/files/:id');
    assert.equal(routeTemplate('/api/health-metrics/sync'), '/api/health-metrics/sync');
  });
});
