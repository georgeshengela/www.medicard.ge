import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateRejoin } from './membership.js';
import { addDaysYmd, tbilisiClock, tbilisiMidnight, tbilisiYmd } from './time.js';

describe('tbilisi moves rejoin / clock', () => {
  it('blocks a different district while the original lock is still active', () => {
    const today = '2026-09-14';
    const decision = evaluateRejoin({
      today,
      lockUntilDate: '2026-10-14',
      currentDistrictId: 'gldani',
      requestedDistrictId: 'vake',
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.code, 'DISTRICT_LOCKED');
    assert.equal(decision.lockUntilDate, '2026-10-14');
  });

  it('allows same-district rejoin without resetting the lock', () => {
    const today = '2026-09-14';
    const decision = evaluateRejoin({
      today,
      lockUntilDate: '2026-10-14',
      currentDistrictId: 'gldani',
      requestedDistrictId: 'gldani',
      todayPeriodDistrictId: 'gldani',
    });
    assert.equal(decision.ok, true);
    assert.equal(decision.preserveLock, true);
    assert.equal(decision.lockUntilDate, '2026-10-14');
  });

  it('never rewrites today\'s period to a second district', () => {
    const today = '2026-09-14';
    const decision = evaluateRejoin({
      today,
      lockUntilDate: today,
      currentDistrictId: 'gldani',
      requestedDistrictId: 'vake',
      todayPeriodDistrictId: 'gldani',
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.code, 'SAME_DAY_DISTRICT_CHANGE');
  });

  it('exposes Asia/Tbilisi day bounds independent of the host offset', () => {
    const winter = new Date('2026-01-15T22:30:00.000Z');
    const clock = tbilisiClock(winter);
    assert.equal(clock.timezone, 'Asia/Tbilisi');
    assert.equal(clock.date, '2026-01-16');
    assert.equal(tbilisiYmd(winter), '2026-01-16');
    assert.equal(tbilisiMidnight('2026-01-16').toISOString(), '2026-01-15T20:00:00.000Z');
    assert.equal(addDaysYmd('2026-01-16', 1), '2026-01-17');
  });
});
