import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  packageCalendarDateToIso,
  toPackageDateInput,
  todayKey,
} from './billing.js';

describe('package calendar dates (Asia/Tbilisi)', () => {
  it('round-trips a Tbilisi calendar day without UTC midnight shift', () => {
    const ymd = '2026-03-15';
    const startIso = packageCalendarDateToIso(ymd, { endOfDay: false });
    const endIso = packageCalendarDateToIso(ymd, { endOfDay: true });
    assert.ok(startIso);
    assert.ok(endIso);
    assert.equal(toPackageDateInput(startIso), ymd);
    assert.equal(toPackageDateInput(endIso), ymd);
    // Legacy UTC midnight would land on 14 Mar in Tbilisi for evening UTC days;
    // our +04 encoding must stay on the same business day.
    assert.equal(todayKey(new Date(startIso)), ymd);
    assert.equal(todayKey(new Date(endIso)), ymd);
  });

  it('rejects invalid ymd', () => {
    assert.equal(packageCalendarDateToIso('15/03/2026'), null);
    assert.equal(packageCalendarDateToIso(''), null);
    assert.equal(toPackageDateInput(null), '');
  });

  it('does not match naive UTC midnight encoding for evening Tbilisi days', () => {
    // 2026-06-01 in Tbilisi start is 2026-05-31T20:00:00.000Z
    const iso = packageCalendarDateToIso('2026-06-01', { endOfDay: false });
    assert.equal(iso, '2026-05-31T20:00:00.000Z');
    assert.notEqual(iso, new Date('2026-06-01T00:00:00.000Z').toISOString());
    assert.equal(toPackageDateInput(iso), '2026-06-01');
  });
});
