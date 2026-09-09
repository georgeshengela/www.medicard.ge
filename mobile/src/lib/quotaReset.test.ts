import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendShownKey,
  parseShownKeys,
  quotaResetKey,
  shouldAnnounceQuotaReady,
  tbilisiYmd,
} from './quotaReset.ts';
import type { Usage } from './api.ts';

function usage(partial: Partial<Usage>): Usage {
  return {
    date: 'roll:daily',
    used: 0,
    limit: 3,
    remaining: 3,
    exceeded: false,
    resetsInMs: 0,
    ...partial,
  };
}

describe('quotaReset', () => {
  it('keys a calendar refill by the Tbilisi day of resetAt', () => {
    const midnight = '2026-09-08T20:00:00.000Z';
    assert.equal(tbilisiYmd(new Date(midnight)), '2026-09-09');
    assert.equal(quotaResetKey(usage({ resetAt: midnight, resetKind: 'calendar' })), 'cal:2026-09-09');
  });

  it('keys a 24h lock by the exact unlock instant', () => {
    const at = '2026-09-09T11:00:00.000Z';
    assert.equal(quotaResetKey(usage({ resetAt: at, exceeded: true, resetKind: 'lock' })), `lock:${at}`);
  });

  it('announces when leftover or exhausted usage flips back to a full day', () => {
    assert.equal(shouldAnnounceQuotaReady(usage({ used: 1, remaining: 2 }), usage({ used: 0, remaining: 3 })), true);
    assert.equal(
      shouldAnnounceQuotaReady(usage({ used: 3, remaining: 0, exceeded: true }), usage({ used: 0, remaining: 3 })),
      true,
    );
    assert.equal(shouldAnnounceQuotaReady(null, usage({ used: 0 })), false);
    assert.equal(shouldAnnounceQuotaReady(usage({ used: 0 }), usage({ used: 0 })), false);
    assert.equal(shouldAnnounceQuotaReady(usage({ used: 1 }), usage({ used: 1, remaining: 2 })), false);
  });

  it('remembers the last few shown reset keys', () => {
    const stored = appendShownKey('[]', 'cal:2026-09-09');
    assert.deepEqual(parseShownKeys(stored), ['cal:2026-09-09']);
    assert.equal(parseShownKeys(appendShownKey(stored, 'cal:2026-09-09')).length, 1);
  });
});
