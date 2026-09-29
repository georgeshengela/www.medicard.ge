import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestBreaker, reportRoute, type BreakerTrip } from './requestBreaker.ts';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('request breaker', () => {
  it('lets a normal burst through (cold start, busy screen)', () => {
    const c = clock();
    const b = createRequestBreaker({ now: c.now });
    for (let i = 0; i < 60; i += 1) assert.equal(b.check('GET', `/api/route-${i % 20}`).ok, true);
    for (let i = 0; i < 30; i += 1) assert.equal(b.check('GET', '/api/auth/me').ok, true);
  });

  it('stops the same request repeated in a loop and reports it once', () => {
    const c = clock();
    const trips: BreakerTrip[] = [];
    const b = createRequestBreaker({ now: c.now, onTrip: (t) => trips.push(t) });
    let blocked = 0;
    for (let i = 0; i < 100; i += 1) {
      if (!b.check('POST', '/api/health-metrics/sync').ok) blocked += 1;
      c.advance(50);
    }
    assert.equal(blocked, 100 - 30);
    assert.equal(trips.length, 1);
    assert.equal(trips[0].scope, 'route');
    assert.equal(trips[0].route, '/api/health-metrics/sync');
    // Other requests keep working while one route is paused.
    assert.equal(b.check('GET', '/api/medications').ok, true);
  });

  it('opens again after the cool-down', () => {
    const c = clock();
    const b = createRequestBreaker({ now: c.now });
    for (let i = 0; i < 31; i += 1) b.check('GET', '/api/x');
    const refused = b.check('GET', '/api/x');
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.ok(refused.retryAfterMs > 0 && refused.retryAfterMs <= 30_000);
    c.advance(30_001);
    assert.equal(b.check('GET', '/api/x').ok, true);
  });

  it('does not count different queries or ids as one loop (search typing, paging)', () => {
    const c = clock();
    const b = createRequestBreaker({ now: c.now });
    for (let i = 0; i < 60; i += 1) {
      assert.equal(b.check('GET', `/api/pharmacy/search?q=${'a'.repeat(i + 1)}`).ok, true);
    }
  });

  it('pauses everything when total traffic looks like a loop with changing URLs', () => {
    const c = clock();
    const trips: BreakerTrip[] = [];
    const b = createRequestBreaker({ now: c.now, onTrip: (t) => trips.push(t) });
    let firstBlocked = -1;
    for (let i = 0; i < 400; i += 1) {
      if (!b.check('GET', `/api/health-metrics?at=${i}`).ok && firstBlocked < 0) firstBlocked = i;
    }
    assert.equal(firstBlocked, 300);
    assert.equal(trips.length, 1);
    assert.equal(trips[0].scope, 'global');
    assert.equal(b.check('GET', '/api/auth/me').ok, false);
    c.advance(30_001);
    assert.equal(b.check('GET', '/api/auth/me').ok, true);
  });

  it('spaced requests never trip (polling every few seconds)', () => {
    const c = clock();
    const b = createRequestBreaker({ now: c.now });
    for (let i = 0; i < 500; i += 1) {
      assert.equal(b.check('GET', '/api/medipulsi/state').ok, true);
      c.advance(1_000);
    }
  });
});

describe('reportRoute', () => {
  it('drops the query and replaces ids and tokens', () => {
    assert.equal(reportRoute('/api/pets/ckz9x2abcdefghij0123456789/chat/query?x=secret'), '/api/pets/:id/chat/query');
    assert.equal(reportRoute('/api/files/123'), '/api/files/:id');
    assert.equal(reportRoute('/api/cycle/share/Ab3dEf6hIj9kLm2nOp'), '/api/cycle/share/:id');
    assert.equal(reportRoute('/api/visits/3f2b8c1e-1234-4abc-9def-0123456789ab'), '/api/visits/:id');
  });

  it('keeps ordinary route words', () => {
    assert.equal(reportRoute('/api/health-metrics/sync'), '/api/health-metrics/sync');
    assert.equal(reportRoute('/api/medi-companion/journey'), '/api/medi-companion/journey');
  });
});
