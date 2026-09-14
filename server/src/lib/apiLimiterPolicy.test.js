import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../server.js'), 'utf8');

describe('API request-count limiters', () => {
  it('does not mount a wait-N-seconds limiter on /api or /api/auth', () => {
    assert.equal(src.includes("attachRateLimitHandler('api-global')"), false);
    assert.equal(src.includes("attachRateLimitHandler('auth-write')"), false);
    assert.match(src, /Do not request-count \/api or \/api\/auth/);
  });
});
