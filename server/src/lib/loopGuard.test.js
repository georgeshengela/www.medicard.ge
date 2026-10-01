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

describe('AI daily cap', async () => {
  const { aiDailyCap, aiDailyCapMessage, AI_DAILY_CAPS } = await import('./aiDailyCap.js');

  it('caps are far above real daily use', () => {
    assert.ok(AI_DAILY_CAPS.nutritionEstimate >= 100);
    assert.ok(AI_DAILY_CAPS.assistantPlan >= 300);
    assert.ok(AI_DAILY_CAPS.onboardingAnalysis >= 10);
  });

  it('refuses one user past the cap with an hours message, others keep going', async () => {
    const app = express();
    app.use((req, _res, next) => { req.user = { id: String(req.headers['x-user'] || 'u1') }; next(); });
    app.post('/x', aiDailyCap('nutritionEstimate', { limit: 2 }), (_req, res) => res.json({ ok: true }));
    await withServer(app, async (url) => {
      const post = (user) => fetch(`${url}/x`, { method: 'POST', headers: { 'x-user': user } });
      assert.equal((await post('u1')).status, 200);
      assert.equal((await post('u1')).status, 200);
      const blocked = await post('u1');
      assert.equal(blocked.status, 429);
      const body = await blocked.json();
      assert.equal(body.code, 'AI_DAILY_CAP');
      assert.match(body.error, /საათში/);
      assert.equal((await post('u2')).status, 200);
    });
  });

  it('message rounds up to whole hours', () => {
    assert.match(aiDailyCapMessage(90).error, /1 საათში/);
    assert.match(aiDailyCapMessage(5 * 3600 + 1).error, /6 საათში/);
  });
});

describe('pharmacy scrape in the web process', async () => {
  const { pharmacySyncInWebEnabled } = await import('./pharmacy/scheduler.js');
  it('stays on unless explicitly switched off', () => {
    assert.equal(pharmacySyncInWebEnabled({}), true);
    assert.equal(pharmacySyncInWebEnabled({ PHARMACY_SYNC_IN_WEB: 'OFF' }), false);
  });
});

describe('pharmacy sync runs once a day at 06:00 Tbilisi', async () => {
  const { pharmacySyncDue } = await import('./pharmacy/scheduler.js');
  // 06:00 Tbilisi = 02:00 UTC.
  const at = (iso) => new Date(iso);
  it('never runs during the day or night outside the morning slot', () => {
    assert.equal(pharmacySyncDue(at('2026-10-02T14:40:00Z'), null), false); // 18:40 Tbilisi
    assert.equal(pharmacySyncDue(at('2026-10-02T01:59:00Z'), null), false); // 05:59
    assert.equal(pharmacySyncDue(at('2026-10-02T05:00:00Z'), null), false); // 09:00
  });
  it('runs once inside the slot', () => {
    assert.equal(pharmacySyncDue(at('2026-10-02T02:00:00Z'), at('2026-10-01T02:01:00Z')), true);
    assert.equal(pharmacySyncDue(at('2026-10-02T04:30:00Z'), at('2026-10-01T14:19:00Z')), true);
    assert.equal(pharmacySyncDue(at('2026-10-02T02:30:00Z'), at('2026-10-02T02:01:00Z')), false);
  });
  it('honours another hour', () => {
    assert.equal(pharmacySyncDue(at('2026-10-02T01:10:00Z'), null, 5), true); // 05:10 Tbilisi
  });
});

describe('owner notices never leave a test run', async () => {
  it('notifyOwner is a no-op under node --test (2026-09-29: a cap test sent real Telegram notices)', async () => {
    const { notifyOwner } = await import('./director/service.js');
    const result = await notifyOwner('test run — must not be delivered');
    assert.deepEqual(result, { delivered: false, suppressed: 'test' });
  });
});
