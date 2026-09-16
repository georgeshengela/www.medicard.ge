import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../server.js'), 'utf8');
const adminSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../routes/admin.routes.js'),
  'utf8',
);

describe('API request-count limiters', () => {
  it('does not mount a wait-N-seconds limiter on all of /api', () => {
    assert.equal(src.includes("attachRateLimitHandler('api-global')"), false);
    assert.match(src, /Do not request-count all of \/api/);
  });

  it('mounts a write-only auth limiter that skips GET /me', () => {
    assert.match(src, /attachRateLimitHandler\('auth-write'\)/);
    assert.match(src, /skip:\s*\(req\)\s*=>\s*!isAuthWriteRequest\(req\)/);
    assert.match(src, /app\.use\('\/api\/auth', authWriteLimiter, authRouter\)/);
  });

  it('rate-limits admin login separately from user auth writes', () => {
    assert.match(adminSrc, /attachRateLimitHandler\('admin-login'\)/);
    assert.match(adminSrc, /adminLoginLimiter/);
  });

  it('trusts a single proxy hop so Render X-Forwarded-For keys the auth-write bucket', () => {
    assert.match(src, /trust proxy',\s*1/);
  });
});
