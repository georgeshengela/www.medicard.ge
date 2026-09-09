import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyConsume,
  applyExpiration,
  bumpOutOfQuietTbilisi,
  inferResetKind,
  isTbilisiQuiet,
  nextTbilisiMidnight,
  publicResetAt,
  quotaResetKey,
} from './usageWindow.js';

/** 2026-09-09 00:00 in Tbilisi. */
const MIDNIGHT = new Date('2026-09-08T20:00:00.000Z');
/** 2026-09-08 15:00 in Tbilisi. */
const AFTERNOON = new Date('2026-09-08T11:00:00.000Z');
/** 2026-09-08 23:30 in Tbilisi. */
const LATE = new Date('2026-09-08T19:30:00.000Z');
/** 2026-09-09 08:15 in Tbilisi. */
const MORNING = new Date('2026-09-09T04:15:00.000Z');

describe('usageWindow', () => {
  it('treats Tbilisi midnight and late evening as quiet, afternoon as open', () => {
    assert.equal(isTbilisiQuiet(MIDNIGHT), true);
    assert.equal(isTbilisiQuiet(LATE), true);
    assert.equal(isTbilisiQuiet(AFTERNOON), false);
    assert.equal(isTbilisiQuiet(MORNING), false);
  });

  it('keeps an afternoon fire time exact and bumps midnight to 08:15', () => {
    assert.equal(bumpOutOfQuietTbilisi(AFTERNOON).toISOString(), AFTERNOON.toISOString());
    assert.equal(bumpOutOfQuietTbilisi(MIDNIGHT).toISOString(), MORNING.toISOString());
    assert.equal(bumpOutOfQuietTbilisi(LATE).toISOString(), MORNING.toISOString());
  });

  it('points unused credits at the next Tbilisi midnight', () => {
    const next = nextTbilisiMidnight(AFTERNOON);
    assert.equal(next.toISOString(), MIDNIGHT.toISOString());
  });

  it('resets leftover 1/3 with no clock immediately (old open window)', () => {
    const result = applyExpiration({ count: 1, resetAt: null }, 3, AFTERNOON);
    assert.equal(result.expired, true);
    assert.equal(result.stale, true);
    assert.equal(result.count, 0);
    assert.equal(result.notifyAt, null);
    assert.match(result.resetKey, /^stale:/);
  });

  it('keeps unused credits until Tbilisi midnight, then zeros them', () => {
    const open = applyExpiration({ count: 1, resetAt: MIDNIGHT }, 3, AFTERNOON);
    assert.equal(open.expired, false);
    assert.equal(open.count, 1);

    const flipped = applyExpiration({ count: 1, resetAt: MIDNIGHT }, 3, MIDNIGHT);
    assert.equal(flipped.expired, true);
    assert.equal(flipped.stale, false);
    assert.equal(flipped.count, 0);
    assert.equal(flipped.resetKind, 'calendar');
    assert.equal(flipped.notifyAt.toISOString(), MORNING.toISOString());
    assert.equal(flipped.resetKey, quotaResetKey(MIDNIGHT, 'calendar'));
  });

  it('starts a 24h lock at the exact moment the last credit is spent', () => {
    const hit = applyConsume({ count: 2, resetAt: MIDNIGHT }, 3, AFTERNOON);
    assert.equal(hit.count, 3);
    assert.equal(hit.resetKind, 'lock');
    assert.equal(hit.resetAt.getTime() - AFTERNOON.getTime(), 86_400_000);
    assert.equal(hit.notifyAt.toISOString(), hit.resetAt.toISOString());
  });

  it('does not let midnight unlock a 24h lock early', () => {
    const lockUntil = new Date(AFTERNOON.getTime() + 86_400_000);
    const atMidnight = applyExpiration({ count: 3, resetAt: lockUntil }, 3, MIDNIGHT);
    assert.equal(atMidnight.expired, false);
    assert.equal(atMidnight.count, 3);
    assert.equal(atMidnight.resetKind, 'lock');
  });

  it('unlocks the 24h lock at the original moment', () => {
    const lockUntil = new Date(AFTERNOON.getTime() + 86_400_000);
    const after = applyExpiration({ count: 3, resetAt: lockUntil }, 3, lockUntil);
    assert.equal(after.expired, true);
    assert.equal(after.count, 0);
    assert.equal(after.resetKind, 'lock');
    assert.equal(after.resetKey, quotaResetKey(lockUntil, 'lock'));
    assert.equal(after.notifyAt.toISOString(), lockUntil.toISOString());
  });

  it('bumps a lock that ends in quiet hours to 08:15', () => {
    const hit = applyConsume({ count: 2, resetAt: MIDNIGHT }, 3, LATE);
    assert.equal(hit.resetKind, 'lock');
    assert.equal(isTbilisiQuiet(hit.resetAt), true);
    assert.equal(hit.notifyAt.toISOString(), bumpOutOfQuietTbilisi(hit.resetAt).toISOString());
  });

  it('hides a past resetAt once the counter is already zero', () => {
    assert.equal(publicResetAt({ count: 0, resetAt: MIDNIGHT }, 3), null);
    assert.ok(publicResetAt({ count: 1, resetAt: MIDNIGHT }, 3));
    assert.ok(publicResetAt({ count: 3, resetAt: MIDNIGHT }, 3));
  });

  it('keeps a pending morning ping when the user spends a fresh credit after midnight', () => {
    const afterReset = applyConsume(
      { count: 0, resetAt: MIDNIGHT, notifyAt: MORNING },
      3,
      new Date('2026-09-08T20:30:00.000Z'),
    );
    assert.equal(afterReset.count, 1);
    assert.equal(afterReset.notifyAt.toISOString(), MORNING.toISOString());
    assert.equal(afterReset.resetKind, 'calendar');
  });

  it('classifies Tbilisi midnight as a calendar reset and any other hour as a lock', () => {
    assert.equal(inferResetKind(MIDNIGHT), 'calendar');
    assert.equal(inferResetKind(AFTERNOON), 'lock');
  });
});
