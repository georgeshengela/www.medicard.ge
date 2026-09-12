import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { civilPeriodKey, isAdventureCacheExpired } from './cacheExpiry.ts';

describe('Adventure cache expiry', () => {
  it('treats a previous local day as expired offline cache', () => {
    const now = new Date('2026-09-13T12:00:00+04:00');
    assert.equal(
      isAdventureCacheExpired({ periodKey: '2026-09-12', timezone: 'Asia/Tbilisi' }, now),
      true,
    );
  });

  it('keeps the current local period as live cache', () => {
    const now = new Date('2026-09-12T12:00:00+04:00');
    const periodKey = civilPeriodKey('Asia/Tbilisi', now);
    assert.equal(isAdventureCacheExpired({ periodKey, timezone: 'Asia/Tbilisi' }, now), false);
  });

  it('marks cache expired after a local-day rollover reconnect', () => {
    const yesterday = new Date('2026-09-12T23:30:00+04:00');
    const nextMorning = new Date('2026-09-13T00:30:00+04:00');
    const cached = {
      periodKey: civilPeriodKey('Asia/Tbilisi', yesterday),
      timezone: 'Asia/Tbilisi',
    };
    assert.equal(isAdventureCacheExpired(cached, yesterday), false);
    assert.equal(isAdventureCacheExpired(cached, nextMorning), true);
  });

  it('uses the stored adventure timezone, not a hopped device zone', () => {
    const now = new Date('2026-09-12T22:00:00+04:00');
    const accepted = civilPeriodKey('Asia/Tbilisi', now);
    assert.equal(accepted, '2026-09-12');
    assert.equal(civilPeriodKey('Pacific/Kiritimati', now), '2026-09-13');
    assert.equal(
      isAdventureCacheExpired({ periodKey: accepted, timezone: 'Asia/Tbilisi' }, now),
      false,
    );
  });
});
