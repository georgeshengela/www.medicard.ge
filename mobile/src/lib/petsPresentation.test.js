import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePetDate, identityAgeBody, approximateAgeError, petCarePlanError } from './petsPresentation.ts';
import { petWeightMeasurements } from './petsHealth.js';
import { normalizePetIdentity, displayAgeParts } from '../../../server/src/lib/petsAge.js';

describe('Pets dates, identity changes and observations', () => {
  const now = new Date(2026, 8, 20, 12);
  it('allows future dates for plans and expiry, rejects them for actual records', () => {
    assert.deepEqual(parsePetDate('21102026', { now, allowFuture: true }), { ok: true, iso: '2026-10-21' });
    assert.equal(parsePetDate('21102026', { now }).ok, false);
    assert.equal(parsePetDate('20092026', { now }).ok, true);
  });
  it('validates complete dates and leap years without silently normalizing them', () => {
    for (const value of ['31022026', '29022025', '32092026', '00122026', '123', '01011899']) assert.equal(parsePetDate(value, { now }).ok, false, value);
    assert.equal(parsePetDate('29022024', { now }).ok, true);
  });
  const base = { name: 'ლუნა', speciesId: 'cat', breedId: 'unknown', ageKind: 'EXACT', birthDate: '2020-01-01', approxAgeYears: null, approxAgeMonths: null, approxAgeRecordedOn: null };
  it('switches an existing exact age to approximate without retaining birth date', () => {
    const payload = { ...base, ...identityAgeBody('APPROXIMATE', '01012020', '4', '2') };
    const saved = normalizePetIdentity(payload, { todayYmd: '2026-09-20' });
    assert.equal(saved.birthDate, null); assert.equal(saved.approxAgeRecordedOn, '2026-09-20'); assert.equal(saved.approxAgeYears, 4);
  });
  it('switches approximate age to unknown or exact without stale fields', () => {
    const old = { ...base, ageKind: 'APPROXIMATE', birthDate: null, approxAgeYears: 3, approxAgeMonths: 2, approxAgeRecordedOn: '2025-01-01' };
    for (const kind of ['EXACT', 'UNKNOWN']) {
      const saved = normalizePetIdentity({ ...old, ...identityAgeBody(kind, '01012020', '3', '2', '2025-01-01') }, { todayYmd: '2026-09-20' });
      assert.equal(saved.ageKind, kind); assert.equal(saved.approxAgeYears, null); assert.equal(saved.approxAgeRecordedOn, null);
    }
  });
  it('keeps the estimate anchor when only the name changes', () => {
    const saved = normalizePetIdentity({ ...base, name: 'ლუნა ახალი', ...identityAgeBody('APPROXIMATE', '', '2', '0', '2025-09-20') }, { todayYmd: '2026-09-20' });
    assert.equal(saved.approxAgeRecordedOn, '2025-09-20');
    assert.deepEqual(displayAgeParts(saved, '2026-09-20'), { kind: 'APPROXIMATE', years: 3, months: 0 });
  });
  it('rejects impossible approximate ages', () => {
    for (const [y, m] of [['', ''], ['-1', '0'], ['81', '0'], ['1.5', '0'], ['0', '12'], ['abc', '2']]) assert.ok(approximateAgeError(y, m));
    assert.equal(approximateAgeError('', '3'), null); assert.equal(approximateAgeError('2', ''), null);
  });
  const plan = { kind: 'MEDICATION', startDigits: '01012027', endDigits: '', dueTime: '09:00', times: '08:00,20:00', recurrence: 'EVERY_N_DAYS', interval: '2', limit: '' };
  it('accepts future plans and validates optional dates and chronology', () => {
    assert.equal(petCarePlanError(plan), null);
    for (const patch of [{ endDigits: '2' }, { endDigits: '31122026' }, { kind: null }, { startDigits: '' }]) assert.ok(petCarePlanError({ ...plan, ...patch }));
  });
  it('validates time, unique daily slots and positive integer limits', () => {
    for (const patch of [{ dueTime: '25:00' }, { dueTime: '9:60' }, { interval: '0' }, { interval: '1.5' }, { limit: '-2' }, { recurrence: 'DAILY_COURSE', times: '08:00,08:00' }, { recurrence: 'DAILY_COURSE', times: '' }]) assert.ok(petCarePlanError({ ...plan, ...patch }));
    assert.ok(petCarePlanError({ ...plan, recurrence: 'DAILY_COURSE' }));
    assert.equal(petCarePlanError({ ...plan, recurrence: 'DAILY_COURSE', limit: '7' }), null);
  });
  it('charts actual observations only, including a single or old reading', () => {
    const row = (id, date, weight) => ({ id, recordedOn: date, weightKg: weight, createdAt: id });
    const rows = [row('b', '2026-09-10', 4.3), row('a', '2026-02-01', 4), row('bad', '2026-09-11', NaN), row('zero', '2026-09-12', 0)];
    assert.deepEqual(petWeightMeasurements(rows).map(item => item.id), ['a', 'b']);
    assert.equal(petWeightMeasurements([rows[1]]).length, 1);
    assert.equal(petWeightMeasurements([]).length, 0);
  });
});
