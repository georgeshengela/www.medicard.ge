import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  apiTrafficKey,
  attachRateLimitHandler,
  authWriteKey,
  isAuthWriteRequest,
  RATE_LIMIT_VALIDATE,
} from './rateLimitKey.js';

const JWT_A =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload-aaa.signature-aaa-aaaaaaaaaaaa';
const JWT_B =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload-bbb.signature-bbb-bbbbbbbbbbbb';

function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(
    '/api/',
    rateLimit({
      windowMs: 60_000,
      limit: 5,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      validate: RATE_LIMIT_VALIDATE,
      keyGenerator: apiTrafficKey,
      skip: isAuthWriteRequest,
      handler: attachRateLimitHandler('api-global'),
    }),
  );
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 60_000,
      limit: 3,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      validate: RATE_LIMIT_VALIDATE,
      keyGenerator: authWriteKey,
      skip: (req) => !isAuthWriteRequest(req),
      handler: attachRateLimitHandler('auth-write'),
    }),
  );
  app.get('/api/admin/stats', (_req, res) => res.json({ ok: true, source: 'admin' }));
  app.get('/api/auth/me', (_req, res) => res.json({ ok: true, source: 'me' }));
  app.post('/api/auth/register', (_req, res) => res.status(201).json({ ok: true, source: 'register' }));
  return app;
}

async function listen(app) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { server, url: `http://127.0.0.1:${port}` };
}

async function hit(url, path, { method = 'GET', token, ip = '203.0.113.10' } = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Forwarded-For': ip,
      Accept: 'application/json',
    },
  });
  const limiter = res.headers.get('x-medicard-limiter');
  const retryAfter = res.headers.get('retry-after');
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return { status: res.status, limiter, retryAfter, body };
}

describe('rate-limit separation', () => {
  it('does not collapse two authenticated sessions that share a JWT header prefix', async () => {
    const { server, url } = await listen(buildApp());
    try {
      for (let i = 0; i < 5; i += 1) {
        const a = await hit(url, '/api/admin/stats', { token: JWT_A });
        assert.equal(a.status, 200);
      }
      const blocked = await hit(url, '/api/admin/stats', { token: JWT_A });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.limiter, 'api-global');
      assert.match(String(blocked.body.error || ''), /წამს/);
      assert.equal(String(blocked.body.error || '').includes('ერთ წუთს'), false);

      const other = await hit(url, '/api/admin/stats', { token: JWT_B });
      assert.equal(other.status, 200);
    } finally {
      server.close();
    }
  });

  it('lets ordinary admin/app reads run without consuming the registration allowance', async () => {
    const { server, url } = await listen(buildApp());
    try {
      for (let i = 0; i < 5; i += 1) {
        const read = await hit(url, '/api/admin/stats', { token: JWT_A });
        assert.equal(read.status, 200);
      }
      const register = await hit(url, '/api/auth/register', { method: 'POST', ip: '203.0.113.10' });
      assert.equal(register.status, 201);

      const sixthRead = await hit(url, '/api/admin/stats', { token: JWT_A });
      assert.equal(sixthRead.status, 429);
      assert.equal(sixthRead.limiter, 'api-global');
    } finally {
      server.close();
    }
  });

  it('still limits abusive registration from one IP', async () => {
    const { server, url } = await listen(buildApp());
    try {
      const statuses = [];
      for (let i = 0; i < 4; i += 1) {
        const res = await hit(url, '/api/auth/register', { method: 'POST', ip: '198.51.100.20' });
        statuses.push(res.status);
        if (res.status === 429) {
          assert.equal(res.limiter, 'auth-write');
          assert.equal(Number(res.retryAfter) > 0, true);
        }
      }
      assert.deepEqual(statuses.slice(0, 3), [201, 201, 201]);
      assert.equal(statuses[3], 429);
    } finally {
      server.close();
    }
  });

  it('does not spend auth-write quota on GET /api/auth/me', async () => {
    const { server, url } = await listen(buildApp());
    try {
      for (let i = 0; i < 3; i += 1) {
        const me = await hit(url, '/api/auth/me');
        assert.equal(me.status, 200);
      }
      for (let i = 0; i < 3; i += 1) {
        const register = await hit(url, '/api/auth/register', { method: 'POST' });
        assert.equal(register.status, 201);
      }
      const blocked = await hit(url, '/api/auth/register', { method: 'POST' });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.limiter, 'auth-write');
      const meAfter = await hit(url, '/api/auth/me');
      assert.equal(meAfter.status, 200);
    } finally {
      server.close();
    }
  });
});
